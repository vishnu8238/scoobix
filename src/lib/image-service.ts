/**
 * Image service — backend-ready abstraction over image storage.
 *
 * Today: returns the URL as-is (mock data already hosts WebP/JPEG on a CDN).
 * Tomorrow: swap the implementation of `resolveImage` / `uploadImage` to call
 * InsForge storage. Call sites stay unchanged.
 */

export type ImageType = "logo" | "cover" | "dish" | "banner" | "avatar";

export type ImageRef = {
  /** Public URL — what the <img> tag consumes. */
  image_url: string;
  /** Category that drives default sizing/quality. */
  image_type: ImageType;
  /** Storage key / CDN id (filled in once InsForge is wired). */
  optimized_reference?: string;
};

/** Pixel widths we render images at, per usage. Backend should generate these variants. */
export const IMAGE_SIZES: Record<ImageType, { w: number; h: number; quality: number }> = {
  logo:   { w: 96,   h: 96,  quality: 80 },
  cover:  { w: 1200, h: 600, quality: 78 },
  dish:   { w: 480,  h: 480, quality: 78 },
  banner: { w: 1600, h: 720, quality: 78 },
  avatar: { w: 128,  h: 128, quality: 80 },
};

/**
 * Resolve a stored image reference into a renderable URL.
 * The InsForge implementation will rewrite this to request a WebP variant
 * at the right size, e.g. `${cdn}/${key}?format=webp&w=${w}&q=${q}`.
 */
export function resolveImage(ref: ImageRef | string, type: ImageType = "dish"): string {
  if (typeof ref === "string") return ref;
  return ref.image_url;
}

/** Mock upload — returns an ImageRef shaped like the future backend response. */
export async function uploadImage(file: File, type: ImageType): Promise<ImageRef> {
  // Backend swap point. For now we just create an object URL so previews work
  // during the demo. No compression is performed client-side — InsForge will
  // handle WebP conversion + resize server-side using IMAGE_SIZES[type].
  const url = typeof URL !== "undefined" ? URL.createObjectURL(file) : "";
  return {
    image_url: url,
    image_type: type,
    optimized_reference: `mock/${type}/${file.name}`,
  };
}
