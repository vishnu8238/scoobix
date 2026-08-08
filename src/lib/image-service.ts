/**
 * Image service — InsForge Storage backed.
 */

import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { getAccessToken } from "./insforge-auth";
import { getUploadStrategy, confirmStorageUpload } from "./storage.functions";

const BUCKET = "images";
const DOC_BUCKET = "documents";

const insforgeHeaders = () => {
  const token = getAccessToken();
  return {
    apikey: INSFORGE_ANON_KEY,
    Authorization: `Bearer ${token || INSFORGE_ANON_KEY}`,
  };
};

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
  image_url: string;
  image_type: ImageType;
  optimized_reference?: string;
};

/** Resolve a string URL or ImageRef into a final URL for consumption. */
export function resolveImage(src: string | ImageRef | undefined | null, type?: ImageType): string {
  if (!src) return "";
  if (typeof src === "string") return src;
  return src.image_url;
}

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
  scratch:   { w: 600,  h: 600,  quality: 0.82, folder: "scratch" },
  coupon:    { w: 800,  h: 400,  quality: 0.82, folder: "coupons" },
  ad:        { w: 1200, h: 600,  quality: 0.82, folder: "ads" },
};

type Strategy = {
  uploadUrl: string;
  method: string;
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

function toAbsolute(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${INSFORGE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
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
    const strat = await getUploadStrategy({ data: { bucket: DOC_BUCKET, filename, contentType: file.type, size: file.size } });
    if (strat.method === "presigned") {
      await postPresigned(strat, file);
      let finalUrl = "";
      if (strat.confirmRequired && strat.confirmUrl) {
        await confirmStorageUpload({ data: { bucket: DOC_BUCKET, confirmUrl: strat.confirmUrl, size: file.size, contentType: file.type } });
        finalUrl = toAbsolute(`/api/storage/buckets/${DOC_BUCKET}/objects/${strat.key}`);
      }
      if (!finalUrl) {
        finalUrl = toAbsolute(`/api/storage/buckets/${DOC_BUCKET}/objects/${strat.key}`);
      }
      return { url: finalUrl, key: strat.key };
    }
    await putDirect(strat.uploadUrl, file);
    return {
      url: toAbsolute(`/api/storage/buckets/${DOC_BUCKET}/objects/${strat.key}`),
      key: strat.key,
    };
  });

  if (opts?.oldKey && opts.oldKey !== res.key) {
    void deleteObject(opts.oldKey).catch(() => {});
  }
  return res;
}

export async function uploadImage(
  file: File,
  type: ImageType,
  opts?: { oldRef?: ImageRef | null },
): Promise<ImageRef> {
  const cfg = IMAGE_SIZES[type];
  // Simple pass-through for now to focus on the permission fix
  const blob = file;
  const ext = file.name.split(".").pop() || "jpg";
  const mime = file.type;

  const safeBase = (file.name.replace(/\.[^.]+$/, "") || "img")
    .toLowerCase().replace(/[^a-z0-9-_]+/g, "-").slice(0, 40);
  const filename = `${cfg.folder}/${safeBase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const ref: ImageRef = await withRetry(async () => {
    const strat = await getUploadStrategy({ data: { bucket: BUCKET, filename, contentType: mime, size: blob.size } });
    if (strat.method === "presigned") {
      await postPresigned(strat, blob);
      if (strat.confirmRequired && strat.confirmUrl) {
        await confirmStorageUpload({ data: { bucket: BUCKET, confirmUrl: strat.confirmUrl, size: blob.size, contentType: mime } });
      }
      const finalUrl = toAbsolute(`/api/storage/buckets/${BUCKET}/objects/${strat.key}`);
      return { image_url: finalUrl, image_type: type, optimized_reference: strat.key };
    }
    await putDirect(strat.uploadUrl, blob);
    return {
      image_url: toAbsolute(`/api/storage/buckets/${BUCKET}/objects/${strat.key}`),
      image_type: type,
      optimized_reference: strat.key,
    };
  });

  const oldKey = opts?.oldRef?.optimized_reference;
  if (oldKey && oldKey !== ref.optimized_reference) {
    void deleteObject(oldKey).catch(() => {});
  }
  return ref;
}

export async function deleteObject(key: string): Promise<void> {
  if (!key) return;
  // Best effort: try images bucket then documents bucket
  const buckets = [BUCKET, DOC_BUCKET];
  for (const b of buckets) {
    try {
      await fetch(`${INSFORGE_URL}/api/storage/buckets/${b}/objects/${encodeURI(key)}`, {
        method: "DELETE",
        headers: { ...insforgeHeaders() },
      });
    } catch { /* ignore */ }
  }
}

export { deleteObject as deleteImage };
