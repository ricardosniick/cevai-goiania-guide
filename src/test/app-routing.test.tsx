import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";

// The real root shell renders <html>/<head>/<body>, which jsdom can't mount inside a test
// container (the page body never renders). Swap only the shell for a fragment so the
// actual routes, root component and error boundaries render into the container.
function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  (router.routesById["__root__"].options as { shellComponent?: unknown }).shellComponent = ({ children }: { children: ReactNode }) => <>{children}</>;
  const errors = vi.spyOn(console, "error");
  const { container } = render(<RouterProvider router={router} />);
  return { router, container, errors };
}

// Fails if the router doesn't settle, nothing paints, or a route throws while rendering
// (React reports caught render errors to console.error with the Error object).
async function expectMounted({ router, container, errors }: ReturnType<typeof renderAt>) {
  await waitFor(() => {
    expect(router.state.status).toBe("idle");
    expect(router.state.matches.length).toBeGreaterThan(0);
    expect(router.state.matches.every((m) => m.status === "success")).toBe(true);
    expect(container.querySelector("*")).not.toBeNull();
  }, { timeout: 10000 });
  const thrown = errors.mock.calls.flat().filter((a) => a instanceof Error);
  expect(thrown).toEqual([]);
}

afterEach(() => {
  cleanup();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

// Assert only that the router mounts and paints, never page content:
// routes are rewritten as the app is built and this must keep passing.
describe("App routing", () => {
  it("renders the index route", async () => {
    await expectMounted(renderAt("/"));
  }, 15000);

  it("renders the not-found route", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expectMounted(renderAt("/this-route-does-not-exist"));
  }, 15000);
});
