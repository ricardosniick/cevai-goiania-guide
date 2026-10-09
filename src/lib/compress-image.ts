export const MAX_IMAGE_SIDE = 1600;
export const JPEG_QUALITY = 0.82;

/** Target size keeping aspect ratio, never upscaling. */
export function fitWithin(w: number, h: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Resize on-device to JPEG (EXIF orientation applied). Falls back to the original on any failure. */
export async function compressImage(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = fitWithin(bmp.width, bmp.height);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bmp.close?.(); return file; }
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size === 0) return file;
    if (blob.size >= file.size && file.type === "image/jpeg") return file;
    const name = (file.name.replace(/\.[^.]*$/, "") || "foto") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
