import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { searchGuestPlaces, searchPlaces } from "@/lib/places.functions";
import type { LatLng } from "@/components/cevai/types";

export function usePlaces(user: User | null, center: LatLng, category: string | null, query: string, radius?: number, ready = true, opts: { withPhotos?: boolean; rank?: "distance" | "popularity"; maxRadius?: number } = {}) {
  const withPhotos = opts.withPhotos ?? true; const rank = opts.rank ?? "popularity";
  const search = useServerFn(user ? searchPlaces : searchGuestPlaces);
  // ~1km grid + radius bucket: nearby repeat searches reuse the cached result instead of calling Google again.
  const lat = Math.round(center.lat * 100) / 100; const lng = Math.round(center.lng * 100) / 100;
  const r = radius ? Math.min(25000, Math.max(300, Math.round(Math.min(radius, opts.maxRadius ?? 25000) / 500) * 500)) : undefined;
  return useQuery({
    queryKey: ["places", user ? "member" : "guest", category, query, lat, lng, r ?? null, withPhotos, rank],
    queryFn: () => search({ data: { query: query || undefined, category: category ?? undefined, lat, lng, ...(r ? { radius: r } : {}), ...(withPhotos ? {} : { withPhotos: false }), ...(rank === "distance" ? { rank } : {}) } }),
    enabled: ready,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
