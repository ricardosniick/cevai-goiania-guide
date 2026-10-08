import { supabase } from "@/integrations/supabase/client";

/** Compensate only after confirming that a successfully uploaded file has no link. */
export async function saveExperiencePhoto(userId: string, experienceId: string, file: File): Promise<boolean> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${experienceId}/${crypto.randomUUID()}.${ext}`;
  const bucket = supabase.storage.from("experience-photos");
  try {
    const upload = await bucket.upload(path, file, { contentType: file.type });
    if (upload.error) { console.error("[photo] upload failed", upload.error); return false; }
  } catch (error) {
    console.error("[photo] upload outcome unknown", error);
    return false;
  }

  try {
    const link = await supabase.from("experience_photos").insert({ experience_id: experienceId, user_id: userId, storage_path: path });
    if (!link.error) return true;
    console.error("[photo] link failed", link.error);
  } catch (error) {
    console.error("[photo] link outcome unknown", error);
  }

  try {
    // A lost response may hide a committed INSERT. Never remove its file.
    const check = await supabase.from("experience_photos").select("experience_id, user_id").eq("storage_path", path).maybeSingle();
    if (check.error) { console.error("[photo] reconciliation failed; file preserved", check.error); return false; }
    if (check.data) return check.data.experience_id === experienceId && check.data.user_id === userId;
    const cleanup = await bucket.remove([path]);
    if (cleanup.error) console.error("[photo] orphan cleanup failed", cleanup.error);
  } catch (error) {
    console.error("[photo] reconciliation/cleanup failed; manual review may be needed", error);
  }
  return false;
}
