import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ links: vi.fn(), deleted: vi.fn(), photoRefs: vi.fn(), bookRefs: vi.fn(), remove: vi.fn(), eq: vi.fn(), del: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const q = { select: () => q, eq: (...args: unknown[]) => { m.eq(...args); return q; }, delete: () => { m.del(); return q; }, single: m.deleted, in: () => table === "books" ? m.bookRefs() : m.photoRefs(), then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => m.links().then(resolve, reject) };
    return q;
  }, storage: { from: () => ({ remove: m.remove }) },
} }));
import { deleteExperience } from "./delete-experience";
const path = "user/experience/photo.jpg";
beforeEach(() => {
  vi.resetAllMocks();
  m.links.mockResolvedValue({ data: [{ storage_path: path }], error: null });
  m.deleted.mockResolvedValue({ data: { id: "experience" }, error: null });
  m.photoRefs.mockResolvedValue({ data: [], error: null });
  m.bookRefs.mockResolvedValue({ data: [], error: null });
  m.remove.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("confirmed experience deletion", () => {
  it("enumerates linked paths, confirms own deletion, then cleans unused files", async () => {
    expect(await deleteExperience("user", "experience")).toEqual({ photoCleanupFailed: false });
    expect(m.eq).toHaveBeenCalledWith("experience_id", "experience");
    expect(m.eq).toHaveBeenCalledWith("id", "experience");
    expect(m.eq).toHaveBeenCalledWith("user_id", "user");
    expect(m.remove).toHaveBeenCalledWith([path]);
    expect(m.deleted.mock.invocationCallOrder[0]!).toBeLessThan(m.remove.mock.invocationCallOrder[0]!);
  });
  it.each(["denied", "zero", "lost"])("does not clean files when deletion is not confirmed (%s)", async (kind) => {
    if (kind === "lost") m.deleted.mockRejectedValue(new Error("lost response"));
    else m.deleted.mockResolvedValue({ data: null, error: kind === "denied" ? new Error("denied") : null });
    await expect(deleteExperience("user", "experience")).rejects.toBeDefined();
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("does not delete when linked paths cannot be read", async () => {
    m.links.mockResolvedValue({ data: null, error: new Error("offline") });
    await expect(deleteExperience("user", "experience")).rejects.toThrow("offline");
    expect(m.del).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled();
  });
  it("deletes an experience without photos without storage access", async () => {
    m.links.mockResolvedValue({ data: [], error: null });
    expect(await deleteExperience("user", "experience")).toEqual({ photoCleanupFailed: false });
    expect(m.remove).not.toHaveBeenCalled();
  });
  it.each(["experience", "book"])("preserves a photo still referenced by another %s", async (kind) => {
    if (kind === "experience") m.photoRefs.mockResolvedValue({ data: [{ storage_path: path }], error: null });
    else m.bookRefs.mockResolvedValue({ data: [{ photo_path: path }], error: null });
    expect(await deleteExperience("user", "experience")).toEqual({ photoCleanupFailed: false });
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("reports uncertain reference checks as pending after a confirmed deletion", async () => {
    m.bookRefs.mockResolvedValue({ data: null, error: new Error("offline") });
    expect(await deleteExperience("user", "experience")).toEqual({ photoCleanupFailed: true });
    expect(m.remove).not.toHaveBeenCalled();
  });
  it.each(["returned", "thrown"])("reports cleanup failure separately (%s)", async (kind) => {
    if (kind === "returned") m.remove.mockResolvedValue({ error: new Error("offline") });
    else m.remove.mockRejectedValue(new Error("offline"));
    expect(await deleteExperience("user", "experience")).toEqual({ photoCleanupFailed: true });
  });
  it("deduplicates paths and never deletes another user's file", async () => {
    m.links.mockResolvedValue({ data: [{ storage_path: path }, { storage_path: path }, { storage_path: "other/file.jpg" }], error: null });
    expect(await deleteExperience("user", "experience")).toEqual({ photoCleanupFailed: true });
    expect(m.remove).toHaveBeenCalledWith([path]);
  });
});
