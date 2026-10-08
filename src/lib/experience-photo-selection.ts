export const MAX_EXPERIENCE_PHOTOS = 5;

/** Existing photos and selected uploads share the same five-photo capacity. */
export function selectExperiencePhotos(current: File[], incoming: File[], keptCount: number): File[] {
  const valid = incoming.filter((file) => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024);
  return [...current, ...valid].slice(0, Math.max(0, MAX_EXPERIENCE_PHOTOS - keptCount));
}
