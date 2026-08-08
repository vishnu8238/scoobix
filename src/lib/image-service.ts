/**
 * Image service — InsForge Storage backed.
 *
 * Pipeline:
 *   1. Client-side compress + resize (canvas → WebP when supported, JPEG fallback).
 *   2. POST /api/storage/buckets/{bucket}/upload-strategy to get a direct or
 *      presigned upload URL.
 *   3. PUT the file (local backend) or POST to the presigned URL (S3 backend).
 *   4. Optional confirm-upload step for S3.
 *   5. Return an ImageRef with the fully qualified public URL and the storage
 *      key so callers can delete orphans on replacement.
 *
 * All uploads share a single `images` bucket, partitioned by folder per
 * feature (logos/, covers/, dishes/, ...). The bucket must be created once
 * in the InsForge dashboard — anon clients cannot create buckets.
 */

import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";

const insforgeHeaders = () => ({
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
});

export type ImageType =
  | "logo"
  | "cover"
  | "dish"
  | "banner"
  | "avatar"
  | "category"
  | "discover"
  | "trending"
  | "license"
  | "vehicle"
  | "scratch"
  | "coupon"
  | "ad";

export type ImageRef = {
  /** Public URL — what the <img> tag consumes. */
  image_url: string;
  /** Category that drives default sizing/quality. */
  image_type: ImageType;
  /** Storage key inside the bucket — required for delete/replace. */
  optimized_reference?: string;
};

/** Pixel widths + quality per usage. Kept generous so quality stays high. */
export const IMAGE_SIZES: Record<ImageType, { w: number; h: number; quality: number; folder: string }> = {
  logo:      { w: 256,  h: 256,  quality: 0.85, folder: "logos" },
  cover:     { w: 1600, h: 900,  quality: 0.82, folder: "covers" },
  dish:      { w: 900,  h: 900,  quality: 0.82, folder: "dishes" },
  banner:    { w: 1920, h: 900,  quality: 0.82, folder: "banners" },
  avatar:    { w: 320,  h: 320,  quality: 0.85, folder: "avatars" },
  category:  { w: 512,  h: 512,  quality: 0.82, folder: "categories" },
  discover:  { w: 1200, h: 900,  quality: 0.82, folder: "discover" },
  trending:  { w: 800,  h: 800,  quality: 0.82, folder: "trending" },
  license:   { w: 1600, h: 1200, quality: 0.85, folder: "licenses" },
  vehicle:   { w: 1400, h: 1050, quality: 0.82, folder: "vehicles" },
  scratch:   { w: 900,  h: 900,  quality: 0.82, folder: "scratch-cards" },
  coupon:    { w: 1200, h: 600,  quality: 0.82, folder: "coupons" },
  ad:        { w: 1600, h: 900,  quality: 0.82, folder: "ads" },
};

const BUCKET = "images";

/** Resolve a stored reference (string or ImageRef) into a renderable URL. */
export function resolveImage(ref: ImageRef | string | null | undefined, _type: ImageType = "dish"): string {
  if (!ref) return "";
  if (typeof ref === "string") return ref;
  return ref.image_url;
}

// ---------- Compression --------------------------------------------------

let webpSupport: boolean | null = null;
function supportsWebP(): boolean {
  if (webpSupport !== null) return webpSupport;
  if (typeof document === "undefined") { webpSupport = false; return false; }
  try {
    const c = document.createElement("canvas");
    webpSupport = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Revoked after draw completes in the caller.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

async function compressToWebP(
  file: File,
  target: { w: number; h: number; quality: number },
): Promise<{ blob: Blob; ext: string; mime: string }> {
  // Skip re-encoding for already-small SVGs / GIFs (animated) — upload as-is.
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return { blob: file, ext: file.type.split("/")[1], mime: file.type };
  }

  if (typeof document === "undefined") {
    return { blob: file, ext: (file.type.split("/")[1] || "bin"), mime: file.type || "application/octet-stream" };
  }

  const img = await loadImage(file);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  // Scale down to fit inside target box; never upscale.
  const scale = Math.min(1, target.w / srcW, target.h / srcH);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: file, ext: "jpg", mime: file.type };
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const useWebP = supportsWebP();
  const mime = useWebP ? "image/webp" : "image/jpeg";
  const ext = useWebP ? "webp" : "jpg";
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), mime, target.quality);
  });

  // If our re-encoded blob is somehow larger than the source, keep the source.
  if (blob.size > file.size && file.size < 1_500_000) {
    return { blob: file, ext: (file.type.split("/")[1] || "jpg"), mime: file.type || "image/jpeg" };
  }
  return { blob, ext, mime };
}

// ---------- Upload -------------------------------------------------------

type Strategy = {
  method: "direct" | "presigned";
  uploadUrl: string;
  key: string;
  fields?: Record<string, string>;
  confirmRequired?: boolean;
  confirmUrl?: string;
};

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i + Math.random() * 200));
    }
  }
  throw lastErr;
}

async function getStrategy(bucket: string, filename: string, contentType: string, size: number): Promise<Strategy> {
  const res = await fetch(`${INSFORGE_URL}/api/storage/buckets/${bucket}/upload-strategy`, {
    method: "POST",
    headers: { ...insforgeHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ filename, contentType, size }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`upload-strategy ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

function toAbsolute(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${INSFORGE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

async function putDirect(uploadUrl: string, blob: Blob): Promise<void> {
  const fd = new FormData();
  fd.append("file", blob);
  const res = await fetch(toAbsolute(uploadUrl), {
    method: "PUT",
    headers: { ...insforgeHeaders() },
    body: fd,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`upload ${res.status}: ${body || res.statusText}`);
  }
}

async function postPresigned(strat: Strategy, blob: Blob): Promise<void> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(strat.fields ?? {})) fd.append(k, v);
  fd.append("file", blob);
  const res = await fetch(strat.uploadUrl, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`s3 upload ${res.status}: ${body || res.statusText}`);
  }
}

async function confirmUpload(confirmUrl: string, size: number, mime: string): Promise<{ url?: string } | null> {
  const res = await fetch(toAbsolute(confirmUrl), {
    method: "POST",
    headers: { ...insforgeHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ size, contentType: mime }),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/** Upload a generic file (like PDF) to storage. */
export async function uploadFile(
  file: File,
  folder: string,
  opts?: { oldKey?: string | null },
): Promise<{ url: string; key: string }> {
  const safeBase = (file.name.replace(/\.[^.]+$/, "") || "doc")
    .toLowerCase().replace(/[^a-z0-9-_]+/g, "-").slice(0, 40);
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const filename = `${folder}/${safeBase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const res = await withRetry(async () => {
    const strat = await getStrategy(BUCKET, filename, file.type, file.size);
    if (strat.method === "presigned") {
      await postPresigned(strat, file);
      let finalUrl = "";
      if (strat.confirmRequired && strat.confirmUrl) {
        const done = await confirmUpload(strat.confirmUrl, file.size, file.type);
        finalUrl = done?.url ? toAbsolute(done.url) : "";
      }
      if (!finalUrl) {
        finalUrl = toAbsolute(`/api/storage/buckets/${BUCKET}/objects/${strat.key}`);
      }
      return { url: finalUrl, key: strat.key };
    }
    await putDirect(strat.uploadUrl, file);
    return {
      url: toAbsolute(`/api/storage/buckets/${BUCKET}/objects/${strat.key}`),
      key: strat.key,
    };
  });

  if (opts?.oldKey && opts.oldKey !== res.key) {
    void deleteObject(opts.oldKey).catch(() => {});
  }
  return res;
}

/** Upload an image and return an ImageRef. Old ref (if any) is deleted after
 *  the new upload succeeds to keep storage clean. */
export async function uploadImage(
  file: File,
  type: ImageType,
  opts?: { oldRef?: ImageRef | null },
): Promise<ImageRef> {
  const cfg = IMAGE_SIZES[type];
  const { blob, ext, mime } = await compressToWebP(file, cfg);

  const safeBase = (file.name.replace(/\.[^.]+$/, "") || "img")
    .toLowerCase().replace(/[^a-z0-9-_]+/g, "-").slice(0, 40);
  const filename = `${cfg.folder}/${safeBase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const ref: ImageRef = await withRetry(async () => {
    const strat = await getStrategy(BUCKET, filename, mime, blob.size);
    if (strat.method === "presigned") {
      await postPresigned(strat, blob);
      let finalUrl = "";
      if (strat.confirmRequired && strat.confirmUrl) {
        const done = await confirmUpload(strat.confirmUrl, blob.size, mime);
        finalUrl = done?.url ? toAbsolute(done.url) : "";
      }
      if (!finalUrl) {
        finalUrl = toAbsolute(`/api/storage/buckets/${BUCKET}/objects/${strat.key}`);
      }
      return { image_url: finalUrl, image_type: type, optimized_reference: strat.key };
    }
    await putDirect(strat.uploadUrl, blob);
    return {
      image_url: toAbsolute(`/api/storage/buckets/${BUCKET}/objects/${strat.key}`),
      image_type: type,
      optimized_reference: strat.key,
    };
  });

  // Orphan cleanup — best-effort, never blocks success.
  const oldKey = opts?.oldRef?.optimized_reference;
  if (oldKey && oldKey !== ref.optimized_reference) {
    void deleteObject(oldKey).catch(() => { /* ignore */ });
  }
  return ref;
}

/** Delete a stored object by key (best-effort). */
export async function deleteObject(key: string): Promise<void> {
  if (!key) return;
  await fetch(`${INSFORGE_URL}/api/storage/buckets/${BUCKET}/objects/${encodeURI(key)}`, {
    method: "DELETE",
    headers: { ...insforgeHeaders() },
  }).catch(() => { /* ignore */ });
}

export { deleteObject as deleteImage };
