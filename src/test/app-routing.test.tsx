import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";

function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

// The root route renders the whole document (<html>/<head>/<body>); React 19 hoists it into the
// real document, so assert on router state + document.body instead of the test container.
async function expectMounted(router: ReturnType<typeof renderAt>) {
  await waitFor(() => {
    expect(router.state.status).toBe("idle");
    expect(router.state.matches.length).toBeGreaterThan(0);
    expect(document.body.innerHTML.trim().length).toBeGreaterThan(0);
    expect(document.body.querySelector("*")).not.toBeNull();
  });
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
  });

  it("renders the not-found route", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expectMounted(renderAt("/this-route-does-not-exist"));
  });
});
