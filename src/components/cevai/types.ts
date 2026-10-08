// Shared types and constants for the Cê Vai? screens.
export type Screen = "welcome" | "login" | "signup" | "signup-done" | "forgot" | "new-password" | "home" | "map" | "detail" | "saved" | "profile" | "categories";
export type MainScreen = "home" | "map" | "saved" | "profile";
export type LatLng = { lat: number; lng: number };
export type SavedList = "quero_conhecer" | "ja_fui" | "favoritos";

export const LIST_LABELS: Record<SavedList, string> = { quero_conhecer: "Quero conhecer", ja_fui: "Já fui", favoritos: "Favoritos" };

export type Stall = { id: string; place_id: string; name: string; kind: string; emoji: string };
export type Experience = {
  id: string; place_id: string; stall_id: string | null; stall: { name: string; emoji: string } | null; category: string; rating: number; comment: string | null; would_return: boolean; is_public: boolean; created_at: string; user_id: string;
  place: { name: string; address: string | null; lat: number | null; lng: number | null; photo_url: string | null } | null;
  scores: Array<{ criterion: string; score: number }>;
  photos: string[];
  photoItems: Array<{ path: string; url: string }>;
};

export type PlaceStat = { avg: number; count: number };
