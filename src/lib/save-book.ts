import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

type BookInput = Omit<TablesInsert<"books">, "id" | "photo_path" | "created_at">;

/** Keep a committed book's photo; clean an upload only after confirming no book references it. */
export async function saveBook(input: BookInput, file: File | null): Promise<{ photoFailed: boolean }> {
  let photoPath: string | null = null;
  let photoFailed = false;
  const bucket = supabase.storage.from("experience-photos");
  if (file && file.size <= 10 * 1024 * 1024) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${input.user_id}/books/${crypto.randomUUID()}.${ext}`;
    const upload = await bucket.upload(path, file, { contentType: file.type });
    if (!upload.error) photoPath = path;
    else { console.error("[erro] book photo upload", upload.error); photoFailed = true; }
  }

  let insertError: unknown;
  try {
    const result = await supabase.from("books").insert({ ...input, photo_path: photoPath });
    if (!result.error) return { photoFailed };
    insertError = result.error;
  } catch (error) { insertError = error; }

  if (photoPath) {
    try {
      // A lost response is not proof that the INSERT failed.
      const check = await supabase.from("books").select("id").eq("photo_path", photoPath).maybeSingle();
      if (check.error) console.error("[erro] book reconciliation failed; photo preserved", check.error);
      else if (check.data) return { photoFailed };
      else {
        const cleanup = await bucket.remove([photoPath]);
        if (cleanup.error) console.error("[erro] book orphan cleanup failed", cleanup.error);
      }
    } catch (error) { console.error("[erro] book reconciliation/cleanup failed", error); }
  }
  throw insertError;
}
