import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { PlaceSummary } from "@/lib/places.functions";
const m = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn(), ensure: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/places.functions", () => ({ ensurePlace: m.ensure }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: (columns: string) => { m.select(columns); return { eq: () => ({ order: async () => ({ data: [{ id: "stall", place_id: "place", name: "Barraquinha", kind: "Comida", emoji: "🍔" }], error: null }) }) }; }, insert: m.insert }),
  rpc: async () => ({ data: [], error: null }),
} }));
import { StallsPanel } from "@/components/cevai/StallsPanel";
beforeEach(() => { vi.clearAllMocks(); m.insert.mockResolvedValue({ error: null }); m.ensure.mockResolvedValue({}); });
afterEach(cleanup);
function mount() {
  const onRegister = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><StallsPanel place={{ id: "place" } as PlaceSummary} user={{ id: "user" } as User} onRegister={onRegister} notify={vi.fn()} /></QueryClientProvider>);
  return onRegister;
}
it("reads catalog fields without creator ID and still opens an experience for the stall", async () => {
  const onRegister = mount(); await screen.findByText("Barraquinha");
  expect(m.select).toHaveBeenCalledWith("id, place_id, name, kind, emoji");
  fireEvent.click(screen.getByRole("button", { name: "Eu fui" }));
  expect(onRegister).toHaveBeenCalledWith({ id: "stall", place_id: "place", name: "Barraquinha", kind: "Comida", emoji: "🍔" });
});
it("continues identifying the owner on INSERT without reading other owners", async () => {
  mount(); await screen.findByText("Barraquinha");
  fireEvent.click(screen.getByRole("button", { name: /Adicionar barraquinha/ }));
  fireEvent.change(screen.getByLabelText("Nome da barraquinha"), { target: { value: "Minha barraca" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
  await waitFor(() => expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ created_by: "user", place_id: "place", name: "Minha barraca" })));
});
