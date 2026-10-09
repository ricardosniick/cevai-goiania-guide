export const MAX_EXPERIENCE_PHOTOS = 5;

/** Existing photos and selected uploads share the same five-photo capacity. */
export function selectExperiencePhotos(current: File[], incoming: File[], keptCount: number): File[] {
  const valid = incoming.filter((file) => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024);
  return [...current, ...valid].slice(0, Math.max(0, MAX_EXPERIENCE_PHOTOS - keptCount));
}

export type PhotoRejection = "too_large" | "not_image";
export const PHOTO_REJECTION_MESSAGE: Record<PhotoRejection, string> = {
  too_large: "Foto grande demais (máx. 10 MB).",
  not_image: "Arquivo não é uma imagem.",
};

/** First reason a picked file would be refused, if any. */
export function photoRejection(files: File[]): PhotoRejection | null {
  if (files.some((f) => !f.type.startsWith("image/"))) return "not_image";
  if (files.some((f) => f.size > 10 * 1024 * 1024)) return "too_large";
  return null;
}
