import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";

const m = vi.hoisted(() => ({ oauth: vi.fn(), session: null as unknown, search: vi.fn(), memberSearch: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: m.session } }),
    getUser: async () => ({ data: { user: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }), in: async () => ({ data: [] }), order: async () => ({ data: [] }) }) }),
  rpc: async () => ({ data: [], error: null }),
} }));
vi.mock("@/integrations/lovable", () => ({ lovable: { auth: { signInWithOAuth: m.oauth } } }));
vi.mock("@/lib/places.functions", () => ({
  GOIANIA: { lat: -16.6869, lng: -49.2648 },
  searchGuestPlaces: m.search, getGuestPlaceDetails: vi.fn(), searchPlaces: m.memberSearch, getPlaceDetails: vi.fn(),
  ensurePlace: vi.fn(), postSituation: vi.fn(), resolvePlacePhotos: vi.fn(),
}));
vi.mock("@/components/cevai/InstallPrompt", () => ({ InstallPrompt: () => null, captureSharedLink: () => false, takePendingLink: () => null, shareUrlFor: () => "" }));
vi.mock("@/components/cevai/MapView", () => ({ hasCoords: () => true, MapView: () => null }));

import { Route } from "@/routes/index";
const App = Route.options.component as ComponentType;
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>);

beforeEach(() => { vi.clearAllMocks(); m.session = null; m.search.mockResolvedValue([]); m.memberSearch.mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openLogin() {
  mount();
  await waitFor(() => expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  return screen.findByRole("button", { name: /Continuar com Google/ });
}

describe("Google sign-in feedback", () => {
  it("shows loading, blocks repeat taps and stays loading on redirect", async () => {
    let resolve!: (v: unknown) => void;
    m.oauth.mockReturnValue(new Promise((r) => { resolve = r; }));
    const btn = await openLogin();
    fireEvent.click(btn); fireEvent.click(btn);
    const busy = await screen.findByRole("button", { name: /Entrando com Google…/ });
    expect(busy).toBeDisabled();
    expect(m.oauth).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ redirected: true }); });
    expect(screen.getByRole("button", { name: /Entrando com Google…/ })).toBeDisabled();
  });
  it("returns to the normal button after an error", async () => {
    m.oauth.mockResolvedValue({ error: new Error("popup closed") });
    fireEvent.click(await openLogin());
    expect(await screen.findByRole("button", { name: /Continuar com Google/ })).toBeEnabled();
  });
});

describe("return from Google", () => {
  it("shows 'Entrando…' instead of the welcome buttons while the session is confirmed", async () => {
    m.session = { user: { id: "u1", email: "a@b.c", user_metadata: {} } };
    mount();
    expect(screen.getByRole("status", { name: "Entrando" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar conta" })).not.toBeInTheDocument();
  });
});

describe("Explorar first search waits for location", () => {
  it("does not search with Goiânia before GPS settles, then searches once with the GPS center", async () => {
    m.session = { user: { id: "u1", email: "a@b.c", user_metadata: {} } };
    let ok!: (p: unknown) => void;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (s: (p: unknown) => void) => { ok = s; } } });
    mount();
    await waitFor(() => expect(ok).toBeTypeOf("function"));
    expect(m.memberSearch).not.toHaveBeenCalled();
    await act(async () => { ok({ coords: { latitude: -16.70, longitude: -49.30 } }); });
    await waitFor(() => expect(m.memberSearch).toHaveBeenCalled());
    expect(m.memberSearch.mock.calls.every((c) => c[0].data.lat === -16.7 && c[0].data.lng === -49.3)).toBe(true);
  });
});

vi.mock("@/lib/guest-challenge.browser", () => ({ getGuestChallengeToken: vi.fn(async () => "guest-proof") }));
