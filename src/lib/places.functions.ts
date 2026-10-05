import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveFilter, categoryFromTypes, ALL_PLACE_TYPES } from "./categories";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
export const GOIANIA = { lat: -16.6869, lng: -49.2648 };

export type PlaceSummary = {
  id: string;
  name: string;
  address: string;
  category: string;
  typeLabel: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number | null;
  photoUrl: string | null;
  photoAttribution: string | null;
};

export type PlaceDetails = PlaceSummary & {
  summary: string | null;
  phone: string | null;
  website: string | null;
  mapsUrl: string | null;
  hours: string[];
  photos: Array<{ url: string; attribution: string | null }>;
};

type GPhoto = { name: string; authorAttributions?: Array<{ displayName?: string }> };
type GPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  types?: string[];
  primaryTypeDisplayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  photos?: GPhoto[];
  editorialSummary?: { text: string };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
};

const photoCache = new Map<string, string>();

function headers(fieldMask?: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("A integração com o Google Maps não está configurada.");
  const h: Record<string, string> = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    "Content-Type": "application/json",
  };
  if (fieldMask) h["X-Goog-FieldMask"] = fieldMask;
  return h;
}

async function gateway<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Maps request failed [${res.status}]: ${body}`);
    if (res.status === 403) throw new Error("O Google recusou a consulta (403). Verifique as permissões da chave do Google Maps.");
    throw new Error(`Falha ao consultar o Google [${res.status}]`);
  }
  return (await res.json()) as T;
}

async function photoUrl(photo: GPhoto | undefined, width = 800): Promise<string | null> {
  if (!photo?.name || !/^places\/[^/]+\/photos\/[^/]+$/.test(photo.name)) return null;
  const key = `${photo.name}:${width}`;
  const cached = photoCache.get(key);
  if (cached) return cached;
  try {
    const data = await gateway<{ photoUri?: string }>(`/places/v1/${photo.name}/media?maxWidthPx=${width}&skipHttpRedirect=true`, { headers: headers() });
    if (data.photoUri) photoCache.set(key, data.photoUri);
    return data.photoUri ?? null;
  } catch {
    return null;
  }
}

function categoryOf(place: GPlace): string {
  return categoryFromTypes([place.primaryType, ...(place.types ?? [])].filter(Boolean) as string[], place.displayName?.text ?? "");
}

async function toSummary(place: GPlace, width = 600, forcedCategory?: string): Promise<PlaceSummary> {
  const first = place.photos?.[0];
  return {
    id: place.id,
    name: place.displayName?.text ?? "Lugar",
    address: place.shortFormattedAddress ?? place.formattedAddress ?? "",
    category: forcedCategory ?? categoryOf(place),
    typeLabel: place.primaryTypeDisplayName?.text ?? "",
    lat: place.location?.latitude ?? GOIANIA.lat,
    lng: place.location?.longitude ?? GOIANIA.lng,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? null,
    photoUrl: await photoUrl(first, width),
    photoAttribution: first?.authorAttributions?.[0]?.displayName ?? null,
  };
}

const SEARCH_MASK = [
  "id", "displayName", "formattedAddress", "shortFormattedAddress", "location", "primaryType", "types",
  "primaryTypeDisplayName", "rating", "userRatingCount", "photos",
].map((f) => `places.${f}`).join(",");

const searchSchema = z.object({
  query: z.string().trim().max(120).optional(),
  category: z.string().max(40).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radius: z.number().min(300).max(25000).optional(),
});

export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => searchSchema.parse(data))
  .handler(async ({ data }) => {
    const center = { latitude: data.lat ?? GOIANIA.lat, longitude: data.lng ?? GOIANIA.lng };
    const filter = resolveFilter(data.category);
    let result: { places?: GPlace[] };
    const textQuery = data.query ? (filter.text ? `${filter.text} ${data.query}` : data.query) : filter.text;
    if (textQuery) {
      result = await gateway(`/places/v1/places:searchText`, {
        method: "POST",
        headers: headers(SEARCH_MASK),
        body: JSON.stringify({
          textQuery,
          pageSize: 20,
          languageCode: "pt-BR",
          regionCode: "BR",
          ...(data.query && filter.types?.length === 1 ? { includedType: filter.types[0] } : {}),
          locationBias: { circle: { center, radius: data.radius ? Math.min(data.radius * 1.5, 30000) : 20000 } },
        }),
      });
    } else {
      result = await gateway(`/places/v1/places:searchNearby`, {
        method: "POST",
        headers: headers(SEARCH_MASK),
        body: JSON.stringify({
          includedTypes: filter.types?.length ? filter.types.slice(0, 50) : ALL_PLACE_TYPES,
          maxResultCount: 20,
          rankPreference: "POPULARITY",
          languageCode: "pt-BR",
          regionCode: "BR",
          locationRestriction: { circle: { center, radius: data.radius ?? 6000 } },
        }),
      });
    }
    const forced = !data.query && filter.label ? filter.label : undefined;
    const places = await Promise.all((result.places ?? []).slice(0, 20).map((p) => toSummary(p, 600, forced)));
    if (places.length) {
      // Written server-side from Google data only; clients can no longer write `places`.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("places").upsert(
        places.map((p) => ({ google_place_id: p.id, name: p.name, address: p.address, category: p.category, lat: p.lat, lng: p.lng, photo_url: p.photoUrl, updated_at: new Date().toISOString() })),
        { onConflict: "google_place_id" },
      );
    }
    return places;
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/) }).parse(data))
  .handler(async ({ data }): Promise<PlaceDetails> => {
    const mask = "id,displayName,formattedAddress,shortFormattedAddress,location,primaryType,types,primaryTypeDisplayName,rating,userRatingCount,photos,editorialSummary,nationalPhoneNumber,websiteUri,googleMapsUri,regularOpeningHours.weekdayDescriptions";
    const place = await gateway<GPlace>(`/places/v1/places/${data.placeId}?languageCode=pt-BR`, { headers: headers(mask) });
    const summary = await toSummary(place, 1000);
    const photos = (await Promise.all((place.photos ?? []).slice(0, 6).map(async (p) => {
      const url = await photoUrl(p, 800);
      return url ? { url, attribution: p.authorAttributions?.[0]?.displayName ?? null } : null;
    }))).filter((p): p is { url: string; attribution: string | null } => p !== null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("places").upsert({ google_place_id: summary.id, name: summary.name, address: place.formattedAddress ?? summary.address, category: summary.category, lat: summary.lat, lng: summary.lng, photo_url: summary.photoUrl, updated_at: new Date().toISOString() }, { onConflict: "google_place_id" });
    return {
      ...summary,
      address: place.formattedAddress ?? summary.address,
      summary: place.editorialSummary?.text ?? null,
      phone: place.nationalPhoneNumber ?? null,
      website: place.websiteUri ?? null,
      mapsUrl: place.googleMapsUri ?? null,
      hours: place.regularOpeningHours?.weekdayDescriptions ?? [],
      photos,
    };
  });

/** Makes sure a place row exists before user content references it. Client sends only the id; data comes from Google. */
export const ensurePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase.from("places").select("google_place_id").eq("google_place_id", data.placeId).maybeSingle();
    if (existing) return { ok: true };
    const g = await gateway<GPlace>(`/places/v1/places/${data.placeId}?languageCode=pt-BR`, { headers: headers("id,displayName,formattedAddress,location,primaryType,types") });
    if (!g.id || !g.location) throw new Error("Lugar não encontrado no Google.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("places").upsert({ google_place_id: g.id, name: g.displayName?.text ?? "Lugar", address: g.formattedAddress ?? null, category: categoryOf(g), lat: g.location.latitude, lng: g.location.longitude }, { onConflict: "google_place_id", ignoreDuplicates: true });
    if (error) { console.error(error); throw new Error("Não foi possível registrar o lugar."); }
    return { ok: true };
  });

/** Starts presence only after confirming, with the place's real Google data, that the category allows it and the device is inside the presence area. */
export const startPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    placeId: z.string().min(3).max(300),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100000),
    mode: z.enum(["meet", "appear", "invisible"]),
    interests: z.array(z.string().max(40)).max(8),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { allowsPresence, presenceRadius, presenceInterests } = await import("./categories");
    if (data.accuracy > 150) throw new Error("Sua localização está imprecisa. Tente de novo ao ar livre ou com o GPS ativado.");
    const g = await gateway<GPlace & { viewport?: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } } }>(
      `/places/v1/places/${encodeURIComponent(data.placeId)}`,
      { headers: headers("id,displayName,formattedAddress,location,primaryType,types,viewport") },
    );
    const category = categoryOf(g);
    if (!allowsPresence(category)) throw new Error("Este local não tem o recurso “Estou aqui”.");
    if (!g.location) throw new Error("Não foi possível confirmar a localização deste local.");
    const R = 6371000, rad = (x: number) => (x * Math.PI) / 180;
    const dist = (a: number, b: number, c: number, d: number) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2));
    let radius = presenceRadius(category);
    if (g.viewport && category === "Parques") {
      const half = dist(g.viewport.low.latitude, g.viewport.low.longitude, g.viewport.high.latitude, g.viewport.high.longitude) / 2;
      radius = Math.min(1500, Math.max(radius, half));
    }
    const d = dist(data.lat, data.lng, g.location.latitude, g.location.longitude);
    if (d > radius + Math.min(data.accuracy, 50)) throw new Error("Você precisa estar no local para usar “Estou aqui”.");
    const allowed = new Set(presenceInterests(category));
    const interests = data.mode === "meet" ? data.interests.filter((i) => allowed.has(i)) : [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("places").upsert({ google_place_id: g.id, name: g.displayName?.text ?? "", address: g.formattedAddress ?? null, category, lat: g.location.latitude, lng: g.location.longitude }, { onConflict: "google_place_id", ignoreDuplicates: true });
    await supabaseAdmin.from("place_presence").delete().eq("user_id", context.userId);
    const now = Date.now();
    const { error } = await supabaseAdmin.from("place_presence").insert({
      user_id: context.userId, place_id: g.id, mode: data.mode, visible: data.mode !== "invisible", interests,
      status: null, started_at: new Date(now).toISOString(), expires_at: new Date(now + 3 * 3600 * 1000).toISOString(),
    });
    if (error) { console.error(error); throw new Error("Não foi possível marcar presença."); }
    await supabaseAdmin.rpc("cleanup_presence");
    return { radius };
  });

/** "Situação agora": only someone physically inside the place's area may publish. */
export const postSituation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    placeId: z.string().min(3).max(300),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100000),
    situations: z.array(z.string().max(60)).min(1).max(4),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { situationKind, situationRadius, SITUATION_OPTIONS } = await import("./categories");
    if (data.accuracy > 150) throw new Error("Sua localização está imprecisa. Tente de novo com o GPS ativado.");
    const g = await gateway<GPlace & { viewport?: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } } }>(
      `/places/v1/places/${encodeURIComponent(data.placeId)}`,
      { headers: headers("id,displayName,formattedAddress,location,primaryType,types,viewport") },
    );
    const category = categoryOf(g);
    const kind = situationKind(category, `${g.displayName?.text ?? ""} ${(g.types ?? []).join(" ")}`);
    if (!kind) throw new Error("Este local não tem “Situação agora”.");
    if (!g.location) throw new Error("Não foi possível confirmar a localização deste local.");
    const R = 6371000, rad = (x: number) => (x * Math.PI) / 180;
    const dist = (a: number, b: number, c: number, d: number) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2));
    let radius = situationRadius(category);
    if (g.viewport && category === "Parques") {
      const half = dist(g.viewport.low.latitude, g.viewport.low.longitude, g.viewport.high.latitude, g.viewport.high.longitude) / 2;
      radius = Math.min(1500, Math.max(radius, half));
    }
    if (dist(data.lat, data.lng, g.location.latitude, g.location.longitude) > radius + Math.min(data.accuracy, 50)) throw new Error("Você precisa estar no local para informar a situação.");
    const allowed = new Set(SITUATION_OPTIONS[kind]);
    const situations = [...new Set(data.situations.filter((s) => allowed.has(s)))];
    if (!situations.length) throw new Error("Escolha uma situação.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin.from("place_situations").select("id", { count: "exact", head: true }).eq("user_id", context.userId).eq("place_id", g.id).gte("created_at", since);
    if ((count ?? 0) > 0) throw new Error("Você atualizou há pouco. Tente de novo em alguns minutos.");
    await supabaseAdmin.from("places").upsert({ google_place_id: g.id, name: g.displayName?.text ?? "", address: g.formattedAddress ?? null, category, lat: g.location.latitude, lng: g.location.longitude }, { onConflict: "google_place_id", ignoreDuplicates: true });
    const now = Date.now();
    const { error } = await supabaseAdmin.from("place_situations").insert({ place_id: g.id, user_id: context.userId, kind, situations, created_at: new Date(now).toISOString(), expires_at: new Date(now + 2 * 3600 * 1000).toISOString() });
    if (error) { console.error(error); throw new Error("Não foi possível publicar a situação."); }
    return { ok: true };
  });
