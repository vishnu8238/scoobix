/**
 * AI operations endpoint for the admin console: provider health + cache purge.
 * Mutating actions require the caller to be listed in `platform_admins`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clearAiCache, invalidateSettingsCache, providerHealth } from "@/lib/ai/gateway.server";
import { dbSelect } from "@/lib/ai/db.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ActionSchema = z.object({
  action: z.enum(["clear_cache", "refresh_settings"]),
  task: z.string().max(64).optional(),
  email: z.string().email().max(120),
});

async function isPlatformAdmin(email: string): Promise<boolean> {
  const rows = await dbSelect("platform_admins", { email: `eq.${email.toLowerCase()}`, limit: 1 });
  return rows.length > 0;
}

export const Route = createFileRoute("/api/public/ai/health")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => Response.json({ ok: true, providers: await providerHealth() }, { headers: CORS }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400, headers: CORS });
        }
        const parsed = ActionSchema.safeParse(body);
        if (!parsed.success) return Response.json({ ok: false, error: "invalid_request" }, { status: 400, headers: CORS });
        if (!(await isPlatformAdmin(parsed.data.email))) {
          return Response.json({ ok: false, error: "forbidden" }, { status: 403, headers: CORS });
        }
        if (parsed.data.action === "clear_cache") await clearAiCache(parsed.data.task);
        invalidateSettingsCache();
        return Response.json({ ok: true }, { headers: CORS });
      },
    },
  },
});
