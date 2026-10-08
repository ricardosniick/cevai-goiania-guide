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

const rpc = vi.fn();
const upsert = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: (...a: unknown[]) => rpc(...a), from: () => ({ upsert }) },
}));

import { searchPlaces, getPlaceDetails, ensurePlace, postSituation } from "./places.functions";
import { RATE_MSG, RATE_UNAVAILABLE_MSG } from "./rate-limit";

const fetchMock = vi.fn();
const PLACE_ID = "ChIJtestPlaceId1234";

// ensurePlace: no stored row, so it truly needs Google.
const context = {
  userId: "00000000-0000-0000-0000-000000000001",
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) },
};

type Call = (data: unknown, ctx: unknown) => Promise<unknown>;
// Each input passes validation and every earlier check, so the next step would be a Google request.
const handlers: Array<{ name: string; fn: Call; input: unknown; bucket: string }> = [
  { name: "searchPlaces", fn: searchPlaces as unknown as Call, input: { query: "pizza", lat: -16.68, lng: -49.25 }, bucket: "search" },
  { name: "getPlaceDetails", fn: getPlaceDetails as unknown as Call, input: { placeId: PLACE_ID }, bucket: "details" },
  { name: "ensurePlace", fn: ensurePlace as unknown as Call, input: { placeId: PLACE_ID }, bucket: "ensure_place" },
  { name: "postSituation", fn: postSituation as unknown as Call, input: { placeId: PLACE_ID, lat: -16.68, lng: -49.25, accuracy: 20, situations: ["Tranquilo"] }, bucket: "situation_try" },
];

const blocked: Array<{ label: string; setup: () => void; message: string }> = [
  { label: "retorna false", setup: () => rpc.mockResolvedValue({ data: false, error: null }), message: RATE_MSG },
  { label: "retorna erro", setup: () => rpc.mockResolvedValue({ data: null, error: { message: "db down" } }), message: RATE_UNAVAILABLE_MSG },
  { label: "lança exceção", setup: () => rpc.mockRejectedValue(new Error("network")), message: RATE_UNAVAILABLE_MSG },
  { label: "retorna valor inesperado", setup: () => rpc.mockResolvedValue({ data: "yes", error: null }), message: RATE_UNAVAILABLE_MSG },
];

beforeEach(() => {
  rpc.mockReset();
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
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[0]).toBe("hit_rate_limit");
    expect((rpc.mock.calls[0]?.[1] as { _bucket: string })._bucket).toBe(bucket);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("hit_rate_limit true → segue para o Google", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await fn(input, context).catch(() => {}); // later steps may reject the fake reply; only the gate matters here
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/places/v1/places");
  });
});
