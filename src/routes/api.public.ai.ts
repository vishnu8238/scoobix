/**
 * Public AI endpoint — the single ingress for every AI request in Scoobix.
 *
 * Placed under /api/public/* so all six apps (including the marketing site)
 * can reach it; the handler owns its own validation, sanitisation, rate
 * limiting and auditing. Provider secrets never leave the server.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runAiTask } from "@/lib/ai/gateway.server";

const BodySchema = z.object({
  task: z.string().min(2).max(64),
  input: z.unknown(),
  app: z.string().max(24).optional(),
  userId: z.string().max(64).optional(),
  fresh: z.boolean().optional(),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const Route = createFileRoute("/api/public/ai")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400, headers: CORS });
        }

        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "invalid_request" }, { status: 400, headers: CORS });
        }

        const result = await runAiTask(parsed.data);
        // Degraded results are still 200 so the UI can fall back silently.
        return Response.json(result, { headers: CORS });
      },
    },
  },
});
