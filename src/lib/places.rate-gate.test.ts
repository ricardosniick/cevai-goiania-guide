import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Mocks: no network, no real backend, no paid calls ----

// createServerFn → plain callable: validates input like the real chain, then runs the handler with a fake context.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (d: unknown) => unknown = (d) => d;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: (d: unknown) => unknown) => { validate = fn; return builder; },
      handler: (fn: (a: { data: unknown; context: unknown }) => unknown) =>
        (data: unknown, context: unknown) => fn({ data: validate(data), context }),
    };
    return builder;
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

// Dispatches by RPC name so per-user and global limiters can be driven separately.
const userRpc = vi.fn();
const globalRpc = vi.fn();
const rpc = vi.fn((name: string, args: Record<string, unknown>) =>
  name === "hit_rate_limit" ? userRpc(args) : name === "reserve_global_budget" ? globalRpc(args) : Promise.resolve({ data: null, error: null }));
const upsert = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: (name: string, args: Record<string, unknown>) => rpc(name, args), from: () => ({ upsert }) },
}));

import { searchPlaces, getPlaceDetails, searchGuestPlaces, getGuestPlaceDetails, ensurePlace, postSituation } from "./places.functions";
import { GLOBAL_UNAVAILABLE_MSG, RATE_MSG, RATE_UNAVAILABLE_MSG } from "./rate-limit";
import { resolvePlacePhotos } from "./places.functions";

const fetchMock = vi.fn();
const PLACE_ID = "ChIJtestPlaceId1234";

// ensurePlace: no stored row, so it truly needs Google.
const context = {
  userId: "00000000-0000-0000-0000-000000000001",
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) },
};

type Call = (data: unknown, ctx: unknown) => Promise<unknown>;
// Each input passes validation and every earlier check, so the next step would be a Google request.
const handlers: Array<{ name: string; fn: Call; input: unknown; bucket: string; global: string }> = [
  { name: "searchPlaces", fn: searchPlaces as unknown as Call, input: { query: "pizza", lat: -16.68, lng: -49.25 }, bucket: "search", global: "text_search" },
  { name: "getPlaceDetails", fn: getPlaceDetails as unknown as Call, input: { placeId: PLACE_ID }, bucket: "details", global: "details_full" },
  { name: "searchGuestPlaces", fn: searchGuestPlaces as unknown as Call, input: { query: "pizza" }, bucket: "guest_search", global: "text_search" },
  { name: "getGuestPlaceDetails", fn: getGuestPlaceDetails as unknown as Call, input: { placeId: PLACE_ID }, bucket: "guest_details", global: "details_full" },
  { name: "ensurePlace", fn: ensurePlace as unknown as Call, input: { placeId: PLACE_ID }, bucket: "ensure_place", global: "details_basic" },
  { name: "postSituation", fn: postSituation as unknown as Call, input: { placeId: PLACE_ID, lat: -16.68, lng: -49.25, accuracy: 20, situations: ["Tranquilo"] }, bucket: "situation_try", global: "details_basic" },
];

const blocked: Array<{ label: string; setup: () => void; message: string }> = [
  { label: "retorna false", setup: () => userRpc.mockResolvedValue({ data: false, error: null }), message: RATE_MSG },
  { label: "retorna erro", setup: () => userRpc.mockResolvedValue({ data: null, error: { message: "db down" } }), message: RATE_UNAVAILABLE_MSG },
  { label: "lança exceção", setup: () => userRpc.mockRejectedValue(new Error("network")), message: RATE_UNAVAILABLE_MSG },
  { label: "retorna valor inesperado", setup: () => userRpc.mockResolvedValue({ data: "yes", error: null }), message: RATE_UNAVAILABLE_MSG },
];

beforeEach(() => {
  rpc.mockClear();
  userRpc.mockReset();
  globalRpc.mockReset();
  userRpc.mockImplementation(async () => ({ data: true, error: null }));
  // Default: global grants what was asked (fictitious values, tests only).
  globalRpc.mockImplementation(async (a: { _requested: number }) => ({ data: a._requested, error: null }));
  upsert.mockClear();
  fetchMock.mockReset();
  // Fake gateway reply; never reaches the internet.
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ places: [], id: PLACE_ID }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("LOVABLE_API_KEY", "test-key");
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-maps-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each(handlers)("$name: limite antes do Google", ({ fn, input, bucket }) => {
  it.each(blocked)("hit_rate_limit $label → bloqueia sem chamar o Google", async ({ setup, message }) => {
    setup();
    await expect(fn(input, context)).rejects.toThrow(message);
    expect(userRpc).toHaveBeenCalledTimes(1);
    expect((userRpc.mock.calls[0]?.[0] as { _bucket: string })._bucket).toBe(bucket);
    expect(globalRpc).not.toHaveBeenCalled(); // per-user limit runs first
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("hit_rate_limit true → segue para o Google", async () => {
    await fn(input, context).catch(() => {}); // later steps may reject the fake reply; only the gate matters here
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/places/v1/places");
  });
});

const globalBlocked: Array<{ label: string; setup: () => void }> = [
  { label: "retorna 0 (teto atingido)", setup: () => globalRpc.mockResolvedValue({ data: 0, error: null }) },
  { label: "retorna -1 (não configurado)", setup: () => globalRpc.mockResolvedValue({ data: -1, error: null }) },
  { label: "retorna erro", setup: () => globalRpc.mockResolvedValue({ data: null, error: { message: "db down" } }) },
  { label: "lança exceção", setup: () => globalRpc.mockRejectedValue(new Error("network")) },
  { label: "retorna valor inesperado", setup: () => globalRpc.mockResolvedValue({ data: "1", error: null }) },
  { label: "retorna mais que o pedido", setup: () => globalRpc.mockResolvedValue({ data: 2, error: null }) },
];

describe.each(handlers)("$name: teto global antes do Google", ({ fn, input, global }) => {
  it.each(globalBlocked)("reserve_global_budget $label → bloqueia sem Google", async ({ setup }) => {
    setup();
    await expect(fn(input, context)).rejects.toThrow(GLOBAL_UNAVAILABLE_MSG);
    expect(userRpc).toHaveBeenCalledTimes(1);
    expect(globalRpc).toHaveBeenCalledTimes(1);
    expect(globalRpc.mock.calls[0]?.[0]).toEqual({ _bucket: global, _requested: 1, _allow_partial: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
  it("ordem: limite por pessoa e depois reserva global", async () => {
    await fn(input, context).catch(() => {});
    const names = rpc.mock.calls.map((c) => c[0]);
    expect(names.slice(0, 2)).toEqual(["hit_rate_limit", "reserve_global_budget"]);
  });
});

it("busca por proximidade reserva nearby_search", async () => {
  await (searchPlaces as unknown as Call)({ category: "Comer", lat: -16.68, lng: -49.25 } as never, context as never).catch(() => {});
  expect(globalRpc.mock.calls[0]?.[0]).toMatchObject({ _bucket: "nearby_search", _requested: 1 });
  expect(String(fetchMock.mock.calls[0]?.[0])).toContain("searchNearby");
});

// ---- Fotos: todos os caminhos passam pelo teto ----
const photo = (i: number) => ({ name: `places/${PLACE_ID}/photos/p${i}` });
const isPhotoCall = (c: unknown[]) => String(c[0]).includes("/media?");
function gatewayReply(body: unknown) {
  fetchMock.mockImplementation(async (url: string) =>
    String(url).includes("/media?") ? new Response(JSON.stringify({ photoUri: `https://img/${encodeURIComponent(url)}` })) : new Response(JSON.stringify(body)));
}

describe("fotos e teto global", () => {
  it("busca: reserva parcial de fotos gera no máximo o concedido", async () => {
    const places = [1, 2, 3, 4].map((i) => ({ id: `ChIJsearchPlace${i}xxxx`, displayName: { text: `Restaurante ${i}` }, primaryType: "restaurant", types: ["restaurant"], location: { latitude: -16.6, longitude: -49.2 }, photos: [photo(100 + i)] }));
    gatewayReply({ places });
    globalRpc.mockImplementation(async (a: { _bucket: string; _requested: number }) => ({ data: a._bucket === "photo" ? 2 : 1, error: null }));
    const out = (await (searchPlaces as unknown as Call)({ query: "restaurante", lat: -16.68, lng: -49.25 } as never, context as never)) as Array<{ photoUrl: string | null }>;
    expect(globalRpc.mock.calls.map((c) => c[0])).toContainEqual({ _bucket: "photo", _requested: 4, _allow_partial: true });
    expect(fetchMock.mock.calls.filter(isPhotoCall)).toHaveLength(2);
    expect(out.filter((p) => p.photoUrl).length).toBe(2);
    expect(out).toHaveLength(4); // places still listed, without photo
  });
  it("detalhes: foto bloqueada pelo teto não chama Google e o lugar abre sem fotos", async () => {
    gatewayReply({ id: PLACE_ID, displayName: { text: "Parque" }, photos: [photo(1), photo(2), photo(3)] });
    globalRpc.mockImplementation(async (a: { _bucket: string }) => ({ data: a._bucket === "photo" ? -1 : 1, error: null }));
    const out = (await (getPlaceDetails as unknown as Call)({ placeId: PLACE_ID } as never, context as never)) as { photos: unknown[]; photoUrl: string | null };
    expect(globalRpc.mock.calls.map((c) => c[0])).toContainEqual({ _bucket: "photo", _requested: 4, _allow_partial: true });
    expect(fetchMock.mock.calls.filter(isPhotoCall)).toHaveLength(0);
    expect(out.photos).toEqual([]);
    expect(out.photoUrl).toBeNull();
  });
  it("fotos salvas: limite por pessoa, depois teto; concessão parcial respeitada", async () => {
    gatewayReply({});
    globalRpc.mockResolvedValue({ data: 1, error: null });
    const names = [photo(201).name, photo(202).name, photo(203).name];
    const out = (await (resolvePlacePhotos as unknown as Call)({ names } as never, context as never)) as Record<string, string>;
    expect(userRpc).toHaveBeenCalledTimes(3);
    expect(globalRpc).toHaveBeenCalledWith({ _bucket: "photo", _requested: 3, _allow_partial: true });
    expect(fetchMock.mock.calls.filter(isPhotoCall)).toHaveLength(1);
    expect(Object.keys(out)).toHaveLength(1);
  });
  it("fotos em cache não reservam nem chamam o Google", async () => {
    gatewayReply({});
    const names = [photo(301).name];
    await (resolvePlacePhotos as unknown as Call)({ names } as never, context as never); // fills cache
    rpc.mockClear(); globalRpc.mockClear(); userRpc.mockClear(); fetchMock.mockClear();
    const out = (await (resolvePlacePhotos as unknown as Call)({ names } as never, context as never)) as Record<string, string>;
    expect(Object.keys(out)).toEqual(names);
    expect(globalRpc).not.toHaveBeenCalled();
    expect(userRpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("o servidor só envia bucket, quantidade e parcial; nunca valores de limite", async () => {
    await (getPlaceDetails as unknown as Call)({ placeId: PLACE_ID, per_day: 999 } as never, context as never).catch(() => {});
    for (const c of globalRpc.mock.calls) expect(Object.keys(c[0] as object).sort()).toEqual(["_allow_partial", "_bucket", "_requested"]);
    expect(rpc.mock.calls.some((c) => c[0] === "set_global_api_limit")).toBe(false);
  });
});


describe("visitor discovery boundaries", () => {
  it("ignores supplied identity and shares the visitor allowance without writing places", async () => {
    gatewayReply({ places: [{ id: PLACE_ID, displayName: { text: "Restaurante de teste" }, primaryType: "restaurant", types: ["restaurant"], location: { latitude: -16.6, longitude: -49.2 } }] });
    const call = searchGuestPlaces as unknown as Call;
    const out = await call({ query: "restaurante", userId: "forged", bucket: "search", limit: 999999 }, undefined);
    expect(out).toHaveLength(1);
    expect(userRpc.mock.calls[0]?.[0]).toEqual({ _user: "00000000-0000-0000-0000-000000000000", _bucket: "guest_search", _max: 30, _window_seconds: 60 });
    expect(upsert).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["hit_rate_limit", "reserve_global_budget"]);
  });
  it("opens Google details without a session, without writing places or reading personal data", async () => {
    gatewayReply({ id: PLACE_ID, displayName: { text: "Lugar de teste" } });
    const out = await (getGuestPlaceDetails as unknown as Call)({ placeId: PLACE_ID }, undefined);
    expect(out).toMatchObject({ id: PLACE_ID, name: "Lugar de teste" });
    expect(upsert).not.toHaveBeenCalled();
    expect(userRpc.mock.calls[0]?.[0]).toMatchObject({ _bucket: "guest_details", _max: 60, _window_seconds: 60 });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["hit_rate_limit", "reserve_global_budget"]);
  });
  it("rejects invalid visitor input before consuming either limit", async () => {
    expect(() => (getGuestPlaceDetails as unknown as Call)({ placeId: "../private" }, undefined)).toThrow();
    expect(() => (searchGuestPlaces as unknown as Call)({ radius: 999999 }, undefined)).toThrow();
    expect(rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
