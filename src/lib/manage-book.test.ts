import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ update: vi.fn(), del: vi.fn(), eq: vi.fn(), is: vi.fn(), write: vi.fn(), refs: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => {
    const q = { update: (x: unknown) => { m.update(x); return q; }, delete: () => { m.del(); return q; }, eq: (...a: unknown[]) => { m.eq(...a); return q; }, is: (...a: unknown[]) => { m.is(...a); return q; }, select: () => q, single: m.write, limit: m.refs };
    return q;
  },
  storage: { from: () => ({ upload: m.upload, remove: m.remove }) },
} }));
import { updateBook, deleteBook } from "./manage-book";
const book = { id: "book", photo_path: "user/books/old.jpg" };
const changes = { title: "Updated", status: "terminei", rating: 5 };
const file = new File(["image"], "new.jpg", { type: "image/jpeg" });
beforeEach(() => {
  vi.resetAllMocks();
  m.write.mockResolvedValue({ data: { id: "book", photo_path: book.photo_path }, error: null });
  m.refs.mockResolvedValue({ data: [], error: null });
  m.upload.mockResolvedValue({ error: null }); m.remove.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("book management", () => {
  it("updates own book fields, keeping its existing photo", async () => {
    expect(await updateBook("user", book, changes, null, false)).toEqual({ photoCleanupFailed: false });
    expect(m.eq).toHaveBeenCalledWith("id", "book"); expect(m.eq).toHaveBeenCalledWith("user_id", "user");
    expect(m.eq).toHaveBeenCalledWith("photo_path", book.photo_path);
    expect(m.update).toHaveBeenCalledWith({ ...changes, photo_path: book.photo_path });
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("replaces a photo and cleans the old one only after committing the update", async () => {
    await updateBook("user", book, changes, file, false);
    expect(m.update).toHaveBeenCalledWith({ ...changes, photo_path: m.upload.mock.calls[0]?.[0] });
    expect(m.remove).toHaveBeenCalledWith([book.photo_path]);
    expect(m.write.mock.invocationCallOrder[0]!).toBeLessThan(m.remove.mock.invocationCallOrder[0]!);
  });
  it("removes a photo while retaining the book", async () => {
    await updateBook("user", book, changes, null, true);
    expect(m.update).toHaveBeenCalledWith({ ...changes, photo_path: null });
    expect(m.remove).toHaveBeenCalledWith([book.photo_path]);
  });
  it("cleans only the new unlinked upload if updating fails", async () => {
    const error = new Error("denied"); m.write.mockResolvedValue({ error, data: null });
    await expect(updateBook("user", book, changes, file, false)).rejects.toBe(error);
    expect(m.remove).toHaveBeenCalledWith([m.upload.mock.calls[0]?.[0]]);
    expect(m.remove).not.toHaveBeenCalledWith([book.photo_path]);
  });
  it("preserves a newly linked photo after a lost update response", async () => {
    m.write.mockRejectedValue(new Error("lost")); m.refs.mockResolvedValue({ data: [{ id: "book" }], error: null });
    await expect(updateBook("user", book, changes, file, false)).rejects.toThrow("lost");
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("preserves files when reference verification fails", async () => {
    m.refs.mockResolvedValue({ data: null, error: new Error("offline") });
    expect(await updateBook("user", book, changes, null, true)).toEqual({ photoCleanupFailed: true });
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("does not change the book when uploading fails", async () => {
    m.upload.mockResolvedValue({ error: new Error("upload denied") });
    await expect(updateBook("user", book, changes, file, false)).rejects.toThrow("upload denied");
    expect(m.update).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled();
  });
  it("detects zero affected rows instead of claiming success", async () => {
    m.write.mockResolvedValue({ data: null, error: null });
    await expect(updateBook("user", book, changes, null, false)).rejects.toThrow("book_not_updated");
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("deletes by owner and cleans the actual returned photo, not a stale UI path", async () => {
    m.write.mockResolvedValue({ data: { photo_path: "user/books/current.jpg" }, error: null });
    await deleteBook("user", "book");
    expect(m.eq).toHaveBeenCalledWith("user_id", "user");
    expect(m.remove).toHaveBeenCalledWith(["user/books/current.jpg"]);
  });
  it("never removes a photo when deleting the row fails", async () => {
    m.write.mockResolvedValue({ data: null, error: new Error("denied") });
    await expect(deleteBook("user", "book")).rejects.toThrow("denied"); expect(m.remove).not.toHaveBeenCalled();
  });
  it("reports storage cleanup failure separately from successful deletion", async () => {
    m.remove.mockResolvedValue({ error: new Error("offline") });
    expect(await deleteBook("user", "book")).toEqual({ photoCleanupFailed: true });
  });
  it("preserves photos referenced by another book", async () => {
    m.refs.mockResolvedValue({ data: [{ id: "another" }], error: null });
    await deleteBook("user", "book"); expect(m.remove).not.toHaveBeenCalled();
  });
  it("does not try to clean a file outside the user's book folder", async () => {
    m.write.mockResolvedValue({ data: { photo_path: "other/books/photo.jpg" }, error: null });
    expect(await deleteBook("user", "book")).toEqual({ photoCleanupFailed: true }); expect(m.remove).not.toHaveBeenCalled();
  });
  it("updates books without photos using an explicit null guard", async () => {
    await updateBook("user", { id: "book", photo_path: null }, changes, null, false);
    expect(m.is).toHaveBeenCalledWith("photo_path", null);
    expect(m.remove).not.toHaveBeenCalled();
  });
});
