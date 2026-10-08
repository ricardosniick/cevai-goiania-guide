import { supabase } from "@/integrations/supabase/client";

export async function deleteExperience(userId: string, id: string): Promise<{ photoCleanupFailed: boolean }> {
  // Do not depend on signed URLs or a stale card to enumerate linked files.
  const photos = await supabase.from("experience_photos").select("storage_path").eq("experience_id", id).eq("user_id", userId);
  if (photos.error || !Array.isArray(photos.data)) throw photos.error ?? new Error("photo_links_unavailable");
  const result = await supabase.from("experiences").delete().eq("id", id).eq("user_id", userId).select("id").single();
  if (result.error || !result.data) throw result.error ?? new Error("experience_not_deleted");

  const paths = [...new Set(photos.data.map((photo) => photo.storage_path))];
  if (!paths.length) return { photoCleanupFailed: false };
  const ownedPaths = paths.filter((path) => path.startsWith(`${userId}/`));
  let photoCleanupFailed = ownedPaths.length !== paths.length;
  if (!ownedPaths.length) return { photoCleanupFailed };
  try {
    // Another own experience or book may still reference a file: never delete that file.
    const photoRefs = await supabase.from("experience_photos").select("storage_path").in("storage_path", ownedPaths);
    const bookRefs = await supabase.from("books").select("photo_path").in("photo_path", ownedPaths);
    if (photoRefs.error || bookRefs.error || !Array.isArray(photoRefs.data) || !Array.isArray(bookRefs.data)) {
      console.error("[experience] cleanup verification failed");
      return { photoCleanupFailed: true };
    }
    const referenced = new Set([...photoRefs.data.map((photo) => photo.storage_path), ...bookRefs.data.map((book) => book.photo_path)]);
    const unused = ownedPaths.filter((path) => !referenced.has(path));
    if (unused.length) {
      const cleanup = await supabase.storage.from("experience-photos").remove(unused);
      if (cleanup.error) { console.error("[experience] photo cleanup failed", cleanup.error); photoCleanupFailed = true; }
    }
  } catch (error) {
    console.error("[experience] cleanup outcome unknown", error);
    photoCleanupFailed = true;
  }
  return { photoCleanupFailed };
}
