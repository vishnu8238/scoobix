import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const INSFORGE_URL = "https://awvs3seh.us-east.insforge.app";
const INSFORGE_ANON_KEY = "anon_f8c2fce9afe385f45eb6d00d434eb365833a70386175df3707743df3b751b102";

export const getUploadStrategy = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    bucket: z.string(),
    filename: z.string(),
    contentType: z.string(),
    size: z.number(),
  }))
  .handler(async ({ data }) => {
    const key = process.env.INSFORGE_API_KEY || INSFORGE_ANON_KEY;
    
    const res = await fetch(`${INSFORGE_URL}/api/storage/buckets/${data.bucket}/upload-strategy`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: data.filename,
        contentType: data.contentType,
        size: data.size,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to get upload strategy: ${res.status} ${errorText}`);
    }

    return res.json();
  });

export const confirmStorageUpload = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    bucket: z.string(),
    confirmUrl: z.string(),
    size: z.number(),
    contentType: z.string(),
  }))
  .handler(async ({ data }) => {
    const key = process.env.INSFORGE_API_KEY || INSFORGE_ANON_KEY;
    
    const url = data.confirmUrl.startsWith("http") 
      ? data.confirmUrl 
      : `${INSFORGE_URL}${data.confirmUrl.startsWith("/") ? "" : "/"}${data.confirmUrl}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        size: data.size,
        contentType: data.contentType,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to confirm upload: ${res.status} ${errorText}`);
    }

    return res.json();
  });
