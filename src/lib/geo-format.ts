type Coordinates = { lat: number | null; lng: number | null };

const valid = (p: Coordinates): p is { lat: number; lng: number } => typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);

export function distanceKm(a: Coordinates, b: Coordinates) {
  // JavaScript otherwise coerces null to zero and invents a distance after expiry.
  if (!valid(a) || !valid(b)) return NaN;
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
export const formatKm = (km: number) => (!Number.isFinite(km) || km < 0 ? "" : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`);
/** Explorar searches again only when the center moved more than ~1 km. */
export const shouldRecenter = (prev: Coordinates, next: Coordinates) => distanceKm(prev, next) > 1;
