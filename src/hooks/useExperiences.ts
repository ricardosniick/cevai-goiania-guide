import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { resolvePlacePhotos } from "@/lib/places.functions";
import type { Experience } from "@/components/cevai/types";

export const SHARED_PHOTO_TTL_SECONDS = 300;
export const SHARED_PHOTO_REFRESH_MS = 240_000;

export async function loadExperiences(filter: { userId?: string; viewerId?: string; placeId?: string; stallId?: string }, qc: QueryClient): Promise<Experience[]> {
  let q = supabase.from("experiences").select("id, place_id, stall_id, stall:fair_stalls(name, emoji), category, rating, comment, would_return, is_public, created_at, user_id, place:places(name, address, lat, lng, photo_url, photo_name), scores:experience_scores(criterion, score), photos:experience_photos(storage_path)").order("created_at", { ascending: false });
  if (filter.userId) q = q.eq("user_id", filter.userId);
  if (filter.placeId) q = q.eq("place_id", filter.placeId);
  if (filter.stallId) q = q.eq("stall_id", filter.stallId);
  const { data, error } = await q;
  if (error) throw error;
  const paths = [...new Set((data ?? []).flatMap((e) => (e.photos ?? []).map((p) => p.storage_path)))];
  const urls: Record<string, string> = {};
  // viewerId chooses expiry only; Storage RLS remains the authority for access.
  const viewerId = filter.viewerId ?? filter.userId;
  const own = paths.filter(p => !!viewerId && p.split("/")[0] === viewerId);
  const shared = paths.filter(p => !own.includes(p));
  await Promise.all([{ paths: own, ttl: 3600 }, { paths: shared, ttl: SHARED_PHOTO_TTL_SECONDS }].map(async batch => {
    if (!batch.paths.length) return;
    try {
      const { data: signed, error } = await supabase.storage.from("experience-photos").createSignedUrls(batch.paths, batch.ttl);
      if (error) return;
      signed?.forEach(s => { if (s.path && s.signedUrl && batch.paths.includes(s.path)) urls[s.path] = s.signedUrl; });
    } catch { /* No reuse of an old shared link when renewal is denied or fails. */ }
  }));
  return (await withFreshPhotos(data ?? [], qc)).map((e) => ({ ...e, place: e.place as Experience["place"], stall: e.stall as Experience["stall"], scores: e.scores ?? [], photos: (e.photos ?? []).map((p) => urls[p.storage_path]).filter((u): u is string => !!u), photoItems: (e.photos ?? []).filter((p) => urls[p.storage_path]).map((p) => ({ path: p.storage_path, url: urls[p.storage_path]! })) }));
}

/** Rows joined with `places`: replace photo_url with a fresh URL generated from photo_name (old rows keep their stored URL). */
export async function withFreshPhotos<T extends { place: unknown }>(rows: T[], qc: QueryClient): Promise<T[]> {
  const names = [...new Set(rows.map((r) => (r.place as { photo_name?: string | null } | null)?.photo_name).filter((n): n is string => !!n))].sort();
  if (!names.length) return rows;
  // Up to 30 names per server request (one rate-limit hit each); cached ~20 min so returning to a screen doesn't ask again.
  const chunks: string[][] = [];
  for (let i = 0; i < names.length; i += 30) chunks.push(names.slice(i, i + 30));
  const urls: Record<string, string> = {};
  await Promise.all(chunks.map(async (chunk) => {
    try {
      Object.assign(urls, await qc.fetchQuery({ queryKey: ["photo-urls", chunk.join("|")], queryFn: () => resolvePlacePhotos({ data: { names: chunk } }), staleTime: 20 * 60 * 1000, gcTime: 25 * 60 * 1000, retry: false }));
    } catch { /* keep stored URLs / "sem foto" */ }
  }));
  return rows.map((r) => {
    const p = r.place as { photo_name?: string | null; photo_url: string | null } | null;
    if (!p?.photo_name || !urls[p.photo_name]) return r;
    return { ...r, place: { ...p, photo_url: urls[p.photo_name] } };
  });
}

export function useSaved(user: User | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["saved", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_places").select("place_id, list, created_at, place:places(name, address, category, photo_url, photo_name, lat, lng)").order("created_at", { ascending: false });
      if (error) throw error;
      return withFreshPhotos(data ?? [], qc);
    },
  });
}
