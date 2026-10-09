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
const qc = () => new QueryClient();
beforeEach(() => {
  vi.clearAllMocks(); m.rows = []; m.error = null;
  m.sign.mockImplementation(async (paths: string[]) => ({ data: paths.map(path => ({ path, signedUrl: `signed:${path}` })), error: null }));
});
describe("experience photo delivery", () => {
  it("signs only the owner's photos and keeps community photos as authenticated paths", async () => {
    m.rows = [row("a", ["a/photo"]), row("b", ["b/photo"])];
    const out = await loadExperiences({ placeId: "p", viewerId: "a" }, qc());
    expect(m.sign).toHaveBeenCalledTimes(1);
    expect(m.sign).toHaveBeenCalledWith(["a/photo"], 3600);
    expect(out[0]!.photos).toEqual(["signed:a/photo"]);
    expect(out[1]!.photos).toEqual([]);
    expect(out[1]!.sharedPhotoPaths).toEqual(["b/photo"]);
    expect(m.eq).not.toHaveBeenCalledWith("user_id", "a");
  });
  it("preserves diary URLs and editable photoItems", async () => {
    m.rows = [row("a", ["a/photo"])];
    const out = await loadExperiences({ userId: "a" }, qc());
    expect(m.sign).toHaveBeenCalledWith(["a/photo"], 3600);
    expect(out[0]!.photoItems).toEqual([{ path: "a/photo", url: "signed:a/photo" }]);
  });
  it("without a viewer it never signs another person's files", async () => {
    m.rows = [row("a", ["a/photo"])];
    const out = await loadExperiences({ placeId: "p" }, qc());
    expect(m.sign).not.toHaveBeenCalled();
    expect(out[0]!.sharedPhotoPaths).toEqual(["a/photo"]);
  });
  it("deduplicates paths, rejects foreign folders and unexpected signing responses", async () => {
    m.rows = [row("a", ["a/photo", "a/photo", "b/private"]), row("b", ["b/photo", "b/photo", "c/private"])];
    m.sign.mockResolvedValue({ data: [{ path: "c/private", signedUrl: "wrong" }, { path: "a/photo", signedUrl: "right" }], error: null });
    const out = await loadExperiences({ viewerId: "a" }, qc());
    expect(m.sign).toHaveBeenCalledWith(["a/photo"], 3600);
    expect(out[0]!.photos).not.toContain("wrong");
    expect(out[1]!.sharedPhotoPaths).toEqual(["b/photo"]);
  });
  it.each(["denied", "thrown"])("%s signing preserves the experience without old photo URLs", async kind => {
    m.rows = [row("a", ["a/photo"])];
    if (kind === "thrown") m.sign.mockRejectedValue(new Error("offline"));
    else m.sign.mockResolvedValue({ data: [{ path: "a/photo", signedUrl: "old" }], error: { message: "denied" } });
    const out = await loadExperiences({ viewerId: "a" }, qc());
    expect(out).toHaveLength(1);
    expect(out[0]!.photos).toEqual([]);
  });
  it("an experience removed by RLS disappears on refresh", async () => {
    m.rows = [];
    expect(await loadExperiences({ viewerId: "a" }, qc())).toEqual([]);
    expect(m.sign).not.toHaveBeenCalled();
  });
});
