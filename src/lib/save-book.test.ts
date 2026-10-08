import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ upload: vi.fn(), insert: vi.fn(), check: vi.fn(), remove: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
  from: () => ({ insert: m.insert, select: () => ({ eq: () => ({ maybeSingle: m.check }) }) }),
} }));
import { saveBook } from "./save-book";
const input = { user_id: "user", title: "Livro", status: "terminei", rating: 4, would_recommend: true };
const file = new File(["image"], "book.jpg", { type: "image/jpeg" });
beforeEach(() => {
  vi.resetAllMocks();
  m.upload.mockResolvedValue({ error: null });
  m.insert.mockResolvedValue({ error: null });
  m.check.mockResolvedValue({ data: null, error: null });
  m.remove.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("book photo cleanup", () => {
  it("saves without a photo, without upload or cleanup", async () => {
    expect(await saveBook(input, null)).toEqual({ photoFailed: false });
    expect(m.insert).toHaveBeenCalledWith({ ...input, photo_path: null });
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("saves the uploaded photo and keeps it", async () => {
    await saveBook(input, file);
    expect(m.insert).toHaveBeenCalledWith({ ...input, photo_path: m.upload.mock.calls[0]?.[0] });
    expect(m.check).not.toHaveBeenCalled();
    expect(m.remove).not.toHaveBeenCalled();
  });
  it.each(["returned", "thrown"])("cleans a confirmed orphan after a %s insert error", async (kind) => {
    const error = new Error("book failed");
    if (kind === "returned") m.insert.mockResolvedValue({ error });
    else m.insert.mockRejectedValue(error);
    await expect(saveBook(input, file)).rejects.toBe(error);
    expect(m.remove).toHaveBeenCalledWith([m.upload.mock.calls[0]?.[0]]);
  });
  it("preserves the photo and reports success if the insert response was lost but the book exists", async () => {
    m.insert.mockRejectedValue(new Error("lost response"));
    m.check.mockResolvedValue({ data: { id: "book" }, error: null });
    expect(await saveBook(input, file)).toEqual({ photoFailed: false });
    expect(m.remove).not.toHaveBeenCalled();
  });
  it.each(["returned", "thrown"])("preserves a photo if reconciliation fails (%s)", async (kind) => {
    const error = new Error("insert failed");
    m.insert.mockResolvedValue({ error });
    if (kind === "returned") m.check.mockResolvedValue({ data: null, error: new Error("offline") });
    else m.check.mockRejectedValue(new Error("offline"));
    await expect(saveBook(input, file)).rejects.toBe(error);
    expect(m.remove).not.toHaveBeenCalled();
  });
  it.each(["returned", "thrown"])("preserves the original insert error when cleanup fails (%s)", async (kind) => {
    const error = new Error("insert failed");
    m.insert.mockResolvedValue({ error });
    if (kind === "returned") m.remove.mockResolvedValue({ error: new Error("cleanup denied") });
    else m.remove.mockRejectedValue(new Error("offline"));
    await expect(saveBook(input, file)).rejects.toBe(error);
  });
  it("keeps the existing behavior: upload rejection saves the book without photo and warns", async () => {
    m.upload.mockResolvedValue({ error: new Error("denied") });
    expect(await saveBook(input, file)).toEqual({ photoFailed: true });
    expect(m.insert).toHaveBeenCalledWith({ ...input, photo_path: null });
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("does not insert a book after an upload exception with unknown outcome", async () => {
    m.upload.mockRejectedValue(new Error("offline"));
    await expect(saveBook(input, file)).rejects.toThrow("offline");
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.remove).not.toHaveBeenCalled();
  });
});
