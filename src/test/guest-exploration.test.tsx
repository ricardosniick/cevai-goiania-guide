import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

const mocks = vi.hoisted(() => ({
  search: vi.fn(), details: vi.fn(), memberSearch: vi.fn(), memberDetails: vi.fn(),
  from: vi.fn(), rpc: vi.fn(), pendingLink: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
  },
  from: mocks.from, rpc: mocks.rpc,
} }));
vi.mock("@/integrations/lovable", () => ({ lovable: {} }));
vi.mock("@/lib/places.functions", () => ({
  GOIANIA: { lat: -16.6869, lng: -49.2648 },
  searchGuestPlaces: mocks.search, getGuestPlaceDetails: mocks.details,
  searchPlaces: mocks.memberSearch, getPlaceDetails: mocks.memberDetails,
  ensurePlace: vi.fn(), postSituation: vi.fn(), resolvePlacePhotos: vi.fn(),
}));
vi.mock("@/components/cevai/InstallPrompt", () => ({
  InstallPrompt: () => null, captureSharedLink: () => false, takePendingLink: mocks.pendingLink,
  shareUrlFor: () => "https://example.test/?lugar=test",
}));
vi.mock("@/components/cevai/MapView", () => ({
  hasCoords: () => true,
  MapView: ({ onIdle, onSelect, markers }: {
    onIdle?: (area: { lat: number; lng: number; radius: number }) => void;
    onSelect?: (id: string) => void;
    markers: Array<{ id: string; label: string }>;
  }) => <div data-testid="guest-map">
    <button onClick={() => onIdle?.({ lat: -16.68, lng: -49.25, radius: 1000 })}>Finalizar movimento do mapa</button>
    {markers.map((m) => <button key={m.id} onClick={() => onSelect?.(m.id)}>Selecionar marcador {m.label}</button>)}
  </div>,
}));

import { Route } from "@/routes/index";
const App = Route.options.component as ComponentType;
const place = {
  id: "ChIJguestTestPlace123", name: "Restaurante de teste", address: "Goiânia",
  category: "Restaurantes", typeLabel: "Restaurante", lat: -16.68, lng: -49.25,
  rating: 4.5, ratingCount: 12, photoUrl: null, photoName: null, photoAttribution: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.pendingLink.mockReset();
  mocks.pendingLink.mockReturnValue(null);
  mocks.search.mockResolvedValue([place]);
  mocks.details.mockResolvedValue({ ...place, summary: null, phone: null, website: null, mapsUrl: null, hours: [], photos: [] });
  mocks.from.mockImplementation(() => { throw new Error("Visitor must not access personal tables"); });
  mocks.rpc.mockImplementation(() => { throw new Error("Visitor must not access community RPCs"); });
});
afterEach(cleanup);

function mountApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><App /></QueryClientProvider>);
}
async function explore() {
  mountApp();
  await waitFor(() => expect(screen.getByRole("button", { name: "Criar conta" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Explorar sem entrar" }));
  await screen.findByText(place.name);
}
async function openDetails() {
  await explore();
  fireEvent.click(screen.getByText(place.name));
  await screen.findByText("Avaliação do Google");
}

describe("visitor exploration", () => {
  it("shows real discovery results and Google details without a session or private queries", async () => {
    await openDetails();
    expect(mocks.search).toHaveBeenCalled();
    expect(mocks.details).toHaveBeenCalledWith({ data: { placeId: place.id } });
    expect(mocks.memberSearch).not.toHaveBeenCalled();
    expect(mocks.memberDetails).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Fotos" }));
    expect(screen.getByText("Fotos do local")).toBeInTheDocument();
  });
  it.each(["Quero ir", "Favoritar", "Eu fui"])("requires login for %s", async (action) => {
    await openDetails();
    fireEvent.click(screen.getByRole("button", { name: action }));
    await screen.findByText("Esqueci minha senha");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("prompts for login instead of claiming the community has no experiences", async () => {
    await openDetails();
    fireEvent.click(screen.getByRole("button", { name: "Experiências" }));
    expect(screen.getByText("Entre para ver e compartilhar experiências da comunidade.")).toBeInTheDocument();
    expect(screen.queryByText("Ninguém registrou este lugar ainda. Foi lá? Registre sua experiência.")).not.toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("allows map navigation without the previous login overlay", async () => {
    await explore();
    fireEvent.click(screen.getByRole("button", { name: "Mapa" }));
    expect(screen.getByTestId("guest-map")).toBeInTheDocument();
    expect(screen.queryByText("Entre para ver lugares reais perto de você no mapa.")).not.toBeInTheDocument();
  });
  it("opens a shared place link without requiring login or querying personal data", async () => {
    mocks.pendingLink.mockReturnValueOnce(place.id);
    mountApp();
    await screen.findByText("Avaliação do Google");
    expect(mocks.details).toHaveBeenCalledWith({ data: { placeId: place.id } });
    expect(screen.queryByText("Esqueci minha senha")).not.toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("searches the map viewport, selects a marker and opens visitor details", async () => {
    await explore();
    fireEvent.click(screen.getByRole("button", { name: "Mapa" }));
    mocks.search.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Finalizar movimento do mapa" }));
    await waitFor(() => expect(mocks.search).toHaveBeenCalledWith({ data: {
      category: undefined, query: undefined, lat: -16.68, lng: -49.25, radius: 1000, withPhotos: false, rank: "distance",
    } }));
    fireEvent.click(await screen.findByRole("button", { name: `Selecionar marcador ${place.name}` }));
    fireEvent.click(screen.getByRole("button", { name: "Ver lugar" }));
    await screen.findByText("Avaliação do Google");
    expect(mocks.details).toHaveBeenCalledWith({ data: { placeId: place.id } });
    expect(mocks.memberSearch).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

});
