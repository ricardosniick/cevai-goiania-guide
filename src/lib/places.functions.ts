import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
export const GOIANIA = { lat: -16.6869, lng: -49.2648 };

const CATEGORY_TYPES: Record<string, string[]> = {
  Restaurantes: ["restaurant"],
  Cafés: ["cafe", "coffee_shop"],
  Parques: ["park"],
  Hotéis: ["lodging"],
  Lojas: ["shopping_mall", "store"],
  Cultura: ["museum", "art_gallery", "performing_arts_theater", "cultural_center"],
  Saúde: ["hospital", "doctor", "dental_clinic", "pharmacy"],
};

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
  const types = [place.primaryType, ...(place.types ?? [])].filter(Boolean) as string[];
  for (const [category, list] of Object.entries(CATEGORY_TYPES)) {
    if (types.some((t) => list.includes(t))) return category;
  }
  if (types.some((t) => ["bakery", "bar", "meal_takeaway"].includes(t))) return "Restaurantes";
  if (types.some((t) => ["hotel", "motel"].includes(t))) return "Hotéis";
  if (types.some((t) => t.includes("clinic") || t.includes("health"))) return "Saúde";
  return "Outros";
}

async function toSummary(place: GPlace, width = 600): Promise<PlaceSummary> {
  const first = place.photos?.[0];
  return {
    id: place.id,
    name: place.displayName?.text ?? "Lugar",
    address: place.shortFormattedAddress ?? place.formattedAddress ?? "",
    category: categoryOf(place),
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
  category: z.string().max(30).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => searchSchema.parse(data))
  .handler(async ({ data, context }) => {
    const center = { latitude: data.lat ?? GOIANIA.lat, longitude: data.lng ?? GOIANIA.lng };
    const types = data.category ? CATEGORY_TYPES[data.category] : undefined;
    let result: { places?: GPlace[] };
    if (data.query) {
      result = await gateway(`/places/v1/places:searchText`, {
        method: "POST",
        headers: headers(SEARCH_MASK),
        body: JSON.stringify({
          textQuery: data.query,
          pageSize: 12,
          languageCode: "pt-BR",
          regionCode: "BR",
          ...(types?.[0] ? { includedType: types[0] } : {}),
          locationBias: { circle: { center, radius: 20000 } },
        }),
      });
    } else {
      result = await gateway(`/places/v1/places:searchNearby`, {
        method: "POST",
        headers: headers(SEARCH_MASK),
        body: JSON.stringify({
          includedTypes: types ?? ["restaurant", "cafe", "park", "tourist_attraction", "shopping_mall", "museum"],
          maxResultCount: 12,
          rankPreference: "POPULARITY",
          languageCode: "pt-BR",
          regionCode: "BR",
          locationRestriction: { circle: { center, radius: 6000 } },
        }),
      });
    }
    const places = await Promise.all((result.places ?? []).slice(0, 12).map((p) => toSummary(p)));
    if (places.length) {
      await context.supabase.from("places").upsert(
        places.map((p) => ({ google_place_id: p.id, name: p.name, address: p.address, category: p.category, lat: p.lat, lng: p.lng, photo_url: p.photoUrl, updated_at: new Date().toISOString() })),
        { onConflict: "google_place_id" },
      );
    }
    return places;
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/) }).parse(data))
  .handler(async ({ data, context }): Promise<PlaceDetails> => {
    const mask = "id,displayName,formattedAddress,shortFormattedAddress,location,primaryType,types,primaryTypeDisplayName,rating,userRatingCount,photos,editorialSummary,nationalPhoneNumber,websiteUri,googleMapsUri,regularOpeningHours.weekdayDescriptions";
    const place = await gateway<GPlace>(`/places/v1/places/${data.placeId}?languageCode=pt-BR`, { headers: headers(mask) });
    const summary = await toSummary(place, 1000);
    const photos = (await Promise.all((place.photos ?? []).slice(0, 6).map(async (p) => {
      const url = await photoUrl(p, 800);
      return url ? { url, attribution: p.authorAttributions?.[0]?.displayName ?? null } : null;
    }))).filter((p): p is { url: string; attribution: string | null } => p !== null);
    await context.supabase.from("places").upsert({ google_place_id: summary.id, name: summary.name, address: place.formattedAddress ?? summary.address, category: summary.category, lat: summary.lat, lng: summary.lng, photo_url: summary.photoUrl, updated_at: new Date().toISOString() }, { onConflict: "google_place_id" });
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
