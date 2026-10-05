import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { it } from "vitest";
import { routeTree } from "@/routeTree.gen";
it("dbg", async () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() }, history: createMemoryHistory({ initialEntries: ["/"] }) });
  const r = render(<RouterProvider router={router} />, { container: document as unknown as HTMLElement, baseElement: document.documentElement });
  await new Promise(r => setTimeout(r, 1500));
  process.stdout.write("S " + router.state.matches.map(m => `${m.routeId}:${m.status}:${String(m.error ?? "")}`).join(" | ") + "\nHEAD " + document.head.innerHTML.slice(0,300) + "\nDOC " + document.documentElement.outerHTML.length + "\nBODY " + document.body.innerHTML.slice(0,200) + "\n");
}, 10000);
