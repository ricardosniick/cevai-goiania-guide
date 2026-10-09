import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
const m = vi.hoisted(() => ({ rows: [] as unknown[], error: null as unknown, sign: vi.fn(), eq: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => { const q = { select: () => q, order: () => q, eq: (...args: unknown[]) => { m.eq(...args); return q; }, then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: m.rows, error: m.error }).then(resolve) }; return q; },
  storage: { from: () => ({ createSignedUrls: m.sign }) },
} }));
vi.mock("@/lib/places.functions", () => ({ resolvePlacePhotos: vi.fn() }));
import { loadExperiences } from "./useExperiences";
const row = (owner: string, paths: string[]) => ({ id: owner, user_id: owner, is_public: true, place: null, stall: null, photos: paths.map(storage_path => ({ storage_path })), scores: [] });
const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
beforeEach(() => {
  vi.clearAllMocks(); m.rows = []; m.error = null;
  m.sign.mockImplementation(async (paths: string[], ttl: number) => ({ data: paths.map(path => ({ path, signedUrl: `signed:${ttl}:${path}` })), error: null }));
});
describe("experience photo privacy", () => {
  it("gives other owners five-minute links and keeps the owner's one-hour links", async () => {
    m.rows = [row("a", ["a/photo"]), row("b", ["b/photo"])];
    const out = await loadExperiences({ placeId: "p", viewerId: "a" }, qc());
    expect(m.sign).toHaveBeenCalledWith(["a/photo"], 3600);
    expect(m.sign).toHaveBeenCalledWith(["b/photo"], 300);
    expect(out[1]!.photoItems).toEqual([{ path: "b/photo", url: "signed:300:b/photo" }]);
    expect(m.eq).toHaveBeenCalledWith("place_id", "p");
    expect(m.eq).not.toHaveBeenCalledWith("user_id", "a"); // viewer identity must not filter community rows
  });
  it("the private diary preserves original signing without a viewerId", async () => {
    m.rows = [row("a", ["a/photo"])];
    await loadExperiences({ userId: "a" }, qc());
    expect(m.sign).toHaveBeenCalledWith(["a/photo"], 3600);
    expect(m.eq).toHaveBeenCalledWith("user_id", "a");
  });
  it("uses short-lived links when viewer identity is missing", async () => {
    m.rows = [row("a", ["a/photo"])];
    await loadExperiences({ placeId: "p" }, qc());
    expect(m.sign).toHaveBeenCalledWith(["a/photo"], 300);
  });
  it("deduplicates paths and does not expose an unrelated path returned by the SDK", async () => {
    m.rows = [row("b", ["b/photo", "b/photo"])];
    m.sign.mockResolvedValue({ data: [{ path: "c/private", signedUrl: "wrong" }, { path: "b/photo", signedUrl: "right" }], error: null });
    const out = await loadExperiences({ viewerId: "a" }, qc());
    expect(m.sign).toHaveBeenCalledTimes(1);
    expect(m.sign).toHaveBeenCalledWith(["b/photo"], 300);
    expect(out[0]!.photos).not.toContain("wrong");
  });
  it("a signing denial clears photo URLs without preventing the experience from loading", async () => {
    m.rows = [row("b", ["b/photo"])];
    const client = qc();
    const first = await client.fetchQuery({ queryKey: ["experiences", "place", "p", "a"], queryFn: () => loadExperiences({ viewerId: "a" }, client) });
    expect(first[0]!.photos).toHaveLength(1);
    m.sign.mockResolvedValue({ data: [{ path: "b/photo", signedUrl: "old" }], error: { message: "denied" } });
    const renewed = await client.fetchQuery({ queryKey: ["experiences", "place", "p", "a"], queryFn: () => loadExperiences({ viewerId: "a" }, client) });
    expect(renewed).toHaveLength(1);
    expect(renewed[0]!.photos).toEqual([]);
    expect(renewed[0]!.photoItems).toEqual([]);
  });
  it("a thrown signing failure keeps the place's experience readable without old photo links", async () => {
    m.rows = [row("b", ["b/photo"])];
    m.sign.mockRejectedValue(new Error("network"));
    const out = await loadExperiences({ viewerId: "a" }, qc());
    expect(out[0]!.photos).toEqual([]);
  });
  it("refresh removes an experience that the backend no longer permits and issues no new link", async () => {
    m.rows = [row("b", ["b/photo"])];
    const client = qc();
    await client.fetchQuery({ queryKey: ["experiences", "place", "p", "a"], queryFn: () => loadExperiences({ viewerId: "a" }, client) });
    m.rows = []; m.sign.mockClear();
    const out = await client.fetchQuery({ queryKey: ["experiences", "place", "p", "a"], queryFn: () => loadExperiences({ viewerId: "a" }, client) });
    expect(out).toEqual([]);
    expect(m.sign).not.toHaveBeenCalled();
  });
});
