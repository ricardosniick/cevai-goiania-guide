import { createServerFn } from "@tanstack/react-start";
import { effectiveRadius, isInsideArea } from "./geo";
import { PHOTO_NEW_PER_MINUTE } from "./photo-budget";
import { GLOBAL_UNAVAILABLE_MSG, RATE_MSG, RATE_UNAVAILABLE_MSG, globalDecision, rateDecision, resolvePhotoBatch, type GlobalBucket, type RateDecision } from "./rate-limit";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveFilter, categoryFromTypes, ALL_PLACE_TYPES, isActivePlace } from "./categories";
/** Searches keep only places of active categories; set false to revert. */
export const RESTRICT_TEXT_TO_ACTIVE = true;

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
  photoName: string | null;
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

/** Atomic per-user limit (SQL advisory lock). Always fail-closed: only an explicit grant lets the call continue. */
async function checkRate(userId: string, bucket: string, max: number, windowSeconds: number): Promise<RateDecision> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("hit_rate_limit", { _user: userId, _bucket: bucket, _max: max, _window_seconds: windowSeconds });
    const d = rateDecision(data, error);
    if (d === "unavailable") console.error(`[rate-limit] check failed bucket=${bucket} user=${userId}`, error ?? data);
    return d;
  } catch (e) {
    console.error(`[rate-limit] check threw bucket=${bucket} user=${userId}`, e);
    return "unavailable";
  }
}
async function rateLimit(userId: string, bucket: string, max: number, windowSeconds: number, message = RATE_MSG) {
  const d = await checkRate(userId, bucket, max, windowSeconds);
  if (d === "limited") throw new Error(message);
  if (d === "unavailable") throw new Error(RATE_UNAVAILABLE_MSG);
}

/**
 * App-wide Google budget (reserve_global_budget, service_role only). Ceilings live in the database table
 * global_api_limits; only bucket/amount/partial are sent and never come from the client. Returns how many
 * calls were granted; any failure grants 0.
 */
async function reserveGlobal(bucket: GlobalBucket, requested: number, allowPartial = false): Promise<number> {
  if (requested <= 0) return 0;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
      "reserve_global_budget", { _bucket: bucket, _requested: requested, _allow_partial: allowPartial },
    );
    const d = globalDecision(data, error, requested);
    if (d.status !== "granted") console.error(`[global-budget] ${d.status} bucket=${bucket} requested=${requested}`, error ?? data);
    return d.granted;
  } catch (e) {
    console.error(`[global-budget] threw bucket=${bucket}`, e);
    return 0;
  }
}
async function requireGlobal(bucket: GlobalBucket) {
  if ((await reserveGlobal(bucket, 1)) !== 1) throw new Error(GLOBAL_UNAVAILABLE_MSG);
}

/** Bounded photo URL cache: max 500 entries, 30-min validity, oldest evicted first. */
const PHOTO_CACHE_MAX = 500;
const PHOTO_CACHE_TTL = 30 * 60 * 1000;
const photoCache = new Map<string, { url: string; at: number }>();
function cacheGet(key: string): string | null {
  const hit = photoCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > PHOTO_CACHE_TTL) { photoCache.delete(key); return null; }
  return hit.url;
}
function cacheSet(key: string, url: string) {
  photoCache.delete(key);
  photoCache.set(key, { url, at: Date.now() });
  while (photoCache.size > PHOTO_CACHE_MAX) { const oldest = photoCache.keys().next().value; if (oldest === undefined) break; photoCache.delete(oldest); }
}
const PHOTO_NAME_RE = /^places\/[^/]+\/photos\/[^/]+$/;

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
  if (!photo?.name || !PHOTO_NAME_RE.test(photo.name)) return null;
  const key = `${photo.name}:${width}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const data = await gateway<{ photoUri?: string }>(`/places/v1/${photo.name}/media?maxWidthPx=${width}&skipHttpRedirect=true`, { headers: headers() });
    if (data.photoUri) cacheSet(key, data.photoUri);
    return data.photoUri ?? null;
  } catch {
    return null;
  }
}

function categoryOf(place: GPlace): string {
  return categoryFromTypes([place.primaryType, ...(place.types ?? [])].filter(Boolean) as string[], place.displayName?.text ?? "", place.primaryType);
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
    photoName: first?.name && PHOTO_NAME_RE.test(first.name) ? first.name : null,
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
  .handler(async ({ data, context }) => {
    await rateLimit(context.userId, "search", 30, 60);
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
    // Filtered searches (Destaques, categories, text) keep only places of active categories; dropped places get no photo calls and are not stored.
    const raw = RESTRICT_TEXT_TO_ACTIVE ? (result.places ?? []).filter((p) => isActivePlace(p.primaryType, p.types ?? [], p.displayName?.text ?? "", forced)) : (result.places ?? []);
    const places = await Promise.all(raw.slice(0, 20).map((p) => toSummary(p, 600, forced)));
    if (places.length) {
      // Written server-side from Google data only; clients can no longer write `places`.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("places").upsert(
        places.map((p) => ({ google_place_id: p.id, name: p.name, address: p.address, category: p.category, lat: p.lat, lng: p.lng, photo_name: p.photoName, updated_at: new Date().toISOString(), coords_fetched_at: new Date().toISOString() })),
        { onConflict: "google_place_id" },
      );
    }
    return places;
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/) }).parse(data))
  .handler(async ({ data, context }): Promise<PlaceDetails> => {
    await rateLimit(context.userId, "details", 60, 60);
    const mask = "id,displayName,formattedAddress,shortFormattedAddress,location,primaryType,types,primaryTypeDisplayName,rating,userRatingCount,photos,editorialSummary,nationalPhoneNumber,websiteUri,googleMapsUri,regularOpeningHours.weekdayDescriptions";
    const place = await gateway<GPlace>(`/places/v1/places/${data.placeId}?languageCode=pt-BR`, { headers: headers(mask) });
    const summary = await toSummary(place, 1000);
    const photos = (await Promise.all((place.photos ?? []).slice(0, 6).map(async (p) => {
      const url = await photoUrl(p, 800);
      return url ? { url, attribution: p.authorAttributions?.[0]?.displayName ?? null } : null;
    }))).filter((p): p is { url: string; attribution: string | null } => p !== null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("places").upsert({ google_place_id: summary.id, name: summary.name, address: place.formattedAddress ?? summary.address, category: summary.category, lat: summary.lat, lng: summary.lng, photo_name: summary.photoName, updated_at: new Date().toISOString(), coords_fetched_at: new Date().toISOString() }, { onConflict: "google_place_id" });
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

/** Turns stored Google photo names into fresh display URLs (cover size). Missing/failed ones are simply omitted. */
export const resolvePlacePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ names: z.array(z.string().regex(PHOTO_NAME_RE)).max(30) }).parse(data))
  .handler(async ({ data, context }) => {
    // Cached photos are free; each missing one needs an explicit grant (errors/unexpected results deny).
    return resolvePhotoBatch(data.names, {
      cacheGet: (n) => cacheGet(`${n}:600`),
      checkLimit: () => checkRate(context.userId, "photos_new", PHOTO_NEW_PER_MINUTE, 60),
      fetchUrl: (n) => photoUrl({ name: n }, 600),
    });
  });

/** Makes sure a place row exists before user content references it. Client sends only the id; data comes from Google. */
export const ensurePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase.from("places").select("google_place_id, lat, lng").eq("google_place_id", data.placeId).maybeSingle();
    // Existing rows with coordinates are kept; rows whose coordinates expired (Google 30-day cache rule) are refreshed below.
    if (existing && existing.lat != null && existing.lng != null) return { ok: true };
    await rateLimit(context.userId, "ensure_place", 20, 60);
    const g = await gateway<GPlace>(`/places/v1/places/${data.placeId}?languageCode=pt-BR`, { headers: headers("id,displayName,formattedAddress,location,primaryType,types") });
    if (!g.id || !g.location) throw new Error("Lugar não encontrado no Google.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("places").upsert({ google_place_id: g.id, name: g.displayName?.text ?? "Lugar", address: g.formattedAddress ?? null, category: categoryOf(g), lat: g.location.latitude, lng: g.location.longitude, coords_fetched_at: new Date().toISOString() }, { onConflict: "google_place_id" });
    if (error) { console.error(error); throw new Error("Não foi possível registrar o lugar."); }
    return { ok: true };
  });

export const PRESENCE_DISABLED = true;

/** Starts presence only after confirming, with the place's real Google data, that the category allows it and the device is inside the presence area. */
export const startPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100000),
    mode: z.enum(["meet", "appear", "invisible"]),
    interests: z.array(z.string().max(40)).max(8),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Social features ("Estou aqui") are disabled in this version; the code below is kept so they can return later.
    if (PRESENCE_DISABLED) throw new Error("O recurso “Estou aqui” não está disponível nesta versão.");
    const { allowsPresence, presenceRadius, presenceInterests } = await import("./categories");
    if (data.accuracy > 150) throw new Error("Sua localização está imprecisa. Tente de novo ao ar livre ou com o GPS ativado.");
    await rateLimit(context.userId, "presence_try", 30, 3600);
    const g = await gateway<GPlace & { viewport?: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } } }>(
      `/places/v1/places/${encodeURIComponent(data.placeId)}`,
      { headers: headers("id,displayName,formattedAddress,location,primaryType,types,viewport") },
    );
    const category = categoryOf(g);
    if (!allowsPresence(category)) throw new Error("Este local não tem o recurso “Estou aqui”.");
    if (!g.location) throw new Error("Não foi possível confirmar a localização deste local.");
    const radius = effectiveRadius(presenceRadius(category), category, g.viewport);
    if (!isInsideArea(data, g.location, radius)) throw new Error("Você precisa estar no local para usar “Estou aqui”.");
    const allowed = new Set(presenceInterests(category));
    const interests = data.mode === "meet" ? data.interests.filter((i) => allowed.has(i)) : [];
    // Only accepted (on-site) attempts spend the 6/hour presence limit.
    await rateLimit(context.userId, "presence", 6, 3600);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("places").upsert({ google_place_id: g.id, name: g.displayName?.text ?? "", address: g.formattedAddress ?? null, category, lat: g.location.latitude, lng: g.location.longitude, coords_fetched_at: new Date().toISOString() }, { onConflict: "google_place_id" });
    // Single atomic statement: replaces any previous presence, so a failure never leaves the user without one.
    const { error } = await supabaseAdmin.rpc("upsert_presence", { _user: context.userId, _place_id: g.id!, _mode: data.mode, _interests: interests });
    if (error) { console.error(error); throw new Error("Não foi possível marcar presença."); }
    await supabaseAdmin.rpc("cleanup_presence");
    return { radius };
  });

/** "Situação agora": only someone physically inside the place's area may publish. */
export const postSituation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100000),
    situations: z.array(z.string().max(60)).min(1).max(4),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { situationKind, situationRadius, SITUATION_OPTIONS } = await import("./categories");
    if (data.accuracy > 150) throw new Error("Sua localização está imprecisa. Tente de novo com o GPS ativado.");
    await rateLimit(context.userId, "situation_try", 30, 3600);
    const g = await gateway<GPlace & { viewport?: { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } } }>(
      `/places/v1/places/${encodeURIComponent(data.placeId)}`,
      { headers: headers("id,displayName,formattedAddress,location,primaryType,types,viewport") },
    );
    const category = categoryOf(g);
    const kind = situationKind(category, `${g.displayName?.text ?? ""} ${(g.types ?? []).join(" ")}`);
    if (!kind) throw new Error("Este local não tem “Situação agora”.");
    if (!g.location) throw new Error("Não foi possível confirmar a localização deste local.");
    const radius = effectiveRadius(situationRadius(category), category, g.viewport);
    if (!isInsideArea(data, g.location, radius)) throw new Error("Você precisa estar no local para informar a situação.");
    const allowed = new Set(SITUATION_OPTIONS[kind]);
    const situations = [...new Set(data.situations.filter((s) => allowed.has(s)))];
    if (!situations.length) throw new Error("Escolha uma situação.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("places").upsert({ google_place_id: g.id, name: g.displayName?.text ?? "", address: g.formattedAddress ?? null, category, lat: g.location.latitude, lng: g.location.longitude, coords_fetched_at: new Date().toISOString() }, { onConflict: "google_place_id" });
    // Both limits (10 min per place, 10/hour per person) and the insert run in one locked DB operation; only accepted posts count.
    const { data: result, error } = await supabaseAdmin.rpc("post_situation", { _user: context.userId, _place_id: g.id!, _kind: kind, _situations: situations });
    if (error) { console.error(error); throw new Error("Não foi possível publicar a situação."); }
    if (result === "recent") throw new Error("Você atualizou há pouco. Tente de novo em alguns minutos.");
    if (result === "hourly") throw new Error(RATE_MSG);
    return { ok: true };
  });
