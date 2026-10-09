import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Storage checks the current session and RLS for every new download. No transferable signed URL. */
export function SharedExperiencePhoto({ path, viewerId, className }: { path: string; viewerId?: string; className: string }) {
  const [photo, setPhoto] = useState<{ path: string; viewerId: string; url: string } | null>(null);
  useEffect(() => {
    setPhoto(null);
    if (!viewerId) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let disposed = false;
    void (async () => {
      try {
        const { data, error } = await supabase.storage.from("experience-photos").download(path, {}, { cache: "no-store", signal: controller.signal });
        if (disposed || error || !data) return;
        objectUrl = URL.createObjectURL(data);
        setPhoto({ path, viewerId, url: objectUrl });
      } catch { /* A denied/unavailable image never falls back to an old signed URL. */ }
    })();
    return () => {
      disposed = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, viewerId]);
  if (!photo || photo.path !== path || photo.viewerId !== viewerId) return null;
  return <img src={photo.url} alt="Foto da experiência" className={className} onError={() => setPhoto(null)} />;
}
