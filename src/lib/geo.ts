// Geofence math shared by the presence and "Situação agora" server checks.
export type LatLngPoint = { latitude: number; longitude: number };
export type Viewport = { low: LatLngPoint; high: LatLngPoint };

const EARTH_RADIUS_M = 6371000;
const rad = (x: number) => (x * Math.PI) / 180;

/** Haversine distance in meters between (lat1, lng1) and (lat2, lng2). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2));
}

export const PARK_MAX_RADIUS_M = 1500;
export const MAX_ACCURACY_TOLERANCE_M = 50;

/** Base radius, widened for parks to half the Google viewport diagonal (capped at 1500 m). */
export function effectiveRadius(baseRadius: number, category: string, viewport?: Viewport): number {
  if (!viewport || category !== "Parques") return baseRadius;
  const half = distanceMeters(viewport.low.latitude, viewport.low.longitude, viewport.high.latitude, viewport.high.longitude) / 2;
  return Math.min(PARK_MAX_RADIUS_M, Math.max(baseRadius, half));
}

/** True when a device at `pos` (with GPS accuracy in meters) is inside the area around `center`. */
export function isInsideArea(pos: { lat: number; lng: number; accuracy: number }, center: LatLngPoint, radius: number): boolean {
  return distanceMeters(pos.lat, pos.lng, center.latitude, center.longitude) <= radius + Math.min(pos.accuracy, MAX_ACCURACY_TOLERANCE_M);
}
