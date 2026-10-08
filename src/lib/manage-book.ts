import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

type BookChanges = Pick<TablesInsert<"books">, "title" | "author" | "status" | "rating" | "comment" | "would_recommend">;

async function cleanupPhoto(userId: string, path: string | null): Promise<boolean> {
  if (!path) return true;
  // Only book uploads in this user's folder can be considered for cleanup.
  if (!path.startsWith(`${userId}/books/`)) return false;
  try {
    const refs = await supabase.from("books").select("id").eq("photo_path", path).limit(1);
    if (refs.error || !Array.isArray(refs.data)) return false;
    if (refs.data?.length) return true;
    const result = await supabase.storage.from("experience-photos").remove([path]);
    if (result.error) { console.error("[books] photo cleanup failed", result.error); return false; }
    return true;
  } catch (error) { console.error("[books] photo cleanup uncertain", error); return false; }
}

export async function updateBook(userId: string, book: { id: string; photo_path: string | null }, changes: BookChanges, file: File | null, removePhoto: boolean): Promise<{ photoCleanupFailed: boolean }> {
  let newPath: string | null = removePhoto ? null : book.photo_path;
  let uploadedPath: string | null = null;
  if (file) {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new Error("invalid_photo");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    uploadedPath = `${userId}/books/${crypto.randomUUID()}.${ext}`;
    const upload = await supabase.storage.from("experience-photos").upload(uploadedPath, file, { contentType: file.type });
    if (upload.error) throw upload.error;
    newPath = uploadedPath;
  }

  try {
    let q = supabase.from("books").update({ ...changes, photo_path: newPath }).eq("id", book.id).eq("user_id", userId);
    // A stale editor must not overwrite a photo replaced in another tab.
    q = book.photo_path === null ? q.is("photo_path", null) : q.eq("photo_path", book.photo_path);
    const result = await q.select("id").single();
    if (result.error || !result.data) throw result.error ?? new Error("book_not_updated");
  } catch (error) {
    if (uploadedPath) {
      const cleaned = await cleanupPhoto(userId, uploadedPath);
      if (!cleaned) console.error("[books] new photo preserved or cleanup pending");
    }
    throw error;
  }
  const photoCleanupFailed = book.photo_path !== newPath && !(await cleanupPhoto(userId, book.photo_path));
  return { photoCleanupFailed };
}

export async function deleteBook(userId: string, id: string): Promise<{ photoCleanupFailed: boolean }> {
  // RETURNING supplies the current file, even if it changed since opening the dialog.
  const result = await supabase.from("books").delete().eq("id", id).eq("user_id", userId).select("photo_path").single();
  if (result.error || !result.data) throw result.error ?? new Error("book_not_deleted");
  return { photoCleanupFailed: !(await cleanupPhoto(userId, result.data.photo_path)) };
}
