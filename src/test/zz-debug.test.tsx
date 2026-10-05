import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { it } from "vitest";
import type { ReactNode } from "react";
import { routeTree } from "@/routeTree.gen";
it("dbg", async () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() }, history: createMemoryHistory({ initialEntries: [process.env.P ?? "/"] }) });
  (router.routesById["__root__"].options as { shellComponent?: unknown }).shellComponent = ({ children }: { children: ReactNode }) => <>{children}</>;
  const r = render(<RouterProvider router={router} />);
  await new Promise(r => setTimeout(r, 1500));
  process.stdout.write("S " + router.state.status + " CONT " + r.container.innerHTML.length + " " + r.container.textContent?.slice(0,120) + "\n");
}, 10000);
