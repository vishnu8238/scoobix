/**
 * Image service — InsForge Storage backed.
 */

import { INSFORGE_URL, INSFORGE_ANON_KEY, getAccessToken } from "./insforge";
import { getUploadStrategy, confirmStorageUpload } from "./storage.functions";
import { optimizeUpload, type OptimizationOptions } from "./file-optimizer";

const BUCKET = "images";
const DOC_BUCKET = "documents";

const insforgeHeaders = async () => {
  const token = await getAccessToken();
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
    headers: { ...await insforgeHeaders() },
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
  opts?: { oldKey?: string | null; skipOptimization?: boolean },
): Promise<{ url: string; key: string; metadata?: any }> {
  let activeFile: File | Blob = file;
  let metadata: any = {
    original_size: file.size,
    mime_type: file.type,
    original_filename: file.name
  };

  if (!opts?.skipOptimization) {
    const optimized = await optimizeUpload(file);
    activeFile = optimized.file;
    metadata = {
      ...metadata,
      optimized_size: optimized.optimizedSize,
      compression_ratio: optimized.compressionRatio,
      mime_type: optimized.mimeType
    };
  }

  const safeBase = (file.name.replace(/\.[^.]+$/, "") || "doc")
    .toLowerCase().replace(/[^a-z0-9-_]+/g, "-").slice(0, 40);
  const ext = activeFile instanceof File ? activeFile.name.split(".").pop() : (metadata.mime_type.split("/")[1] || "bin");
  const filename = `${folder}/${safeBase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const res = await withRetry(async () => {
    const strat = await getUploadStrategy({ data: { bucket: DOC_BUCKET, filename, contentType: metadata.mime_type, size: activeFile.size } });
    if (strat.method === "presigned") {
      await postPresigned(strat, activeFile as Blob);
      let finalUrl = "";
      if (strat.confirmRequired && strat.confirmUrl) {
        await confirmStorageUpload({ data: { bucket: DOC_BUCKET, confirmUrl: strat.confirmUrl, size: activeFile.size, contentType: metadata.mime_type } });
        finalUrl = toAbsolute(`/api/storage/buckets/${DOC_BUCKET}/objects/${strat.key}`);
      }
      if (!finalUrl) {
        finalUrl = toAbsolute(`/api/storage/buckets/${DOC_BUCKET}/objects/${strat.key}`);
      }
      return { url: finalUrl, key: strat.key, metadata };
    }
    await putDirect(strat.uploadUrl, activeFile as Blob);
    return {
      url: toAbsolute(`/api/storage/buckets/${DOC_BUCKET}/objects/${strat.key}`),
      key: strat.key,
      metadata
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
  opts?: { oldRef?: ImageRef | null; skipOptimization?: boolean },
): Promise<ImageRef & { metadata?: any }> {
  const cfg = IMAGE_SIZES[type];
  
  let activeFile: File | Blob = file;
  let metadata: any = {
    original_size: file.size,
    mime_type: file.type,
    original_filename: file.name
  };

  if (!opts?.skipOptimization) {
    const optimized = await optimizeUpload(file, {
      maxWidth: cfg.w,
      maxHeight: cfg.h,
      quality: cfg.quality
    });
    activeFile = optimized.file;
    metadata = {
      ...metadata,
      optimized_size: optimized.optimizedSize,
      compression_ratio: optimized.compressionRatio,
      mime_type: optimized.mimeType,
      width: optimized.width,
      height: optimized.height
    };
  }

  const mime = metadata.mime_type;
  const safeBase = (file.name.replace(/\.[^.]+$/, "") || "img")
    .toLowerCase().replace(/[^a-z0-9-_]+/g, "-").slice(0, 40);
  const ext = mime.split("/")[1] || "webp";
  const filename = `${cfg.folder}/${safeBase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const ref = await withRetry(async () => {
    const strat = await getUploadStrategy({ data: { bucket: BUCKET, filename, contentType: mime, size: activeFile.size } });
    if (strat.method === "presigned") {
      await postPresigned(strat, activeFile as Blob);
      if (strat.confirmRequired && strat.confirmUrl) {
        await confirmStorageUpload({ data: { bucket: BUCKET, confirmUrl: strat.confirmUrl, size: activeFile.size, contentType: mime } });
      }
      const finalUrl = toAbsolute(`/api/storage/buckets/${BUCKET}/objects/${strat.key}`);
      return { image_url: finalUrl, image_type: type, optimized_reference: strat.key, metadata };
    }
    await putDirect(strat.uploadUrl, activeFile as Blob);
    return {
      image_url: toAbsolute(`/api/storage/buckets/${BUCKET}/objects/${strat.key}`),
      image_type: type,
      optimized_reference: strat.key,
      metadata
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
        headers: { ...await insforgeHeaders() },
      });
    } catch { /* ignore */ }
  }
}

export { deleteObject as deleteImage };
