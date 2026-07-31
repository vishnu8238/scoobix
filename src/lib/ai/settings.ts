/**
 * Shared AI configuration contract (client + server safe — no secrets).
 *
 * Persisted as a JSON row in `app_settings` under key `ai_settings`, edited
 * only from Admin → AI Console.
 */

export type ProviderId = "gemini" | "glm" | "lovable" | "openai" | "anthropic" | "deepseek" | "grok" | "mistral" | "ollama" | "qwen" | "llama";

export type AiSettings = {
  /** Master kill-switch. */
  enabled: boolean;
  /** Ordered provider priority — first healthy + configured provider wins. */
  priority: ProviderId[];
  /** Per-provider enable flags. */
  providers: Partial<Record<ProviderId, boolean>>;
  /** Disabled task ids (feature-level kill switches). */
  disabledTasks: string[];
  /** Response cache on/off + global TTL multiplier. */
  cache: boolean;
  cacheTtlFactor: number;
  /** Requests per minute, per user. */
  rateLimitPerMin: number;
  /** Max retries per provider before failing over. */
  maxRetries: number;
  /** Hard timeout for a single provider call (ms). */
  timeoutMs: number;
  /** Monthly request budget per provider (0 = unlimited) — soft quota guard. */
  monthlyQuota: Partial<Record<ProviderId, number>>;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: true,
  priority: ["gemini", "glm", "lovable"],
  providers: { gemini: true, glm: true, lovable: true },
  disabledTasks: [],
  cache: true,
  cacheTtlFactor: 1,
  rateLimitPerMin: 30,
  maxRetries: 2,
  timeoutMs: 20000,
  monthlyQuota: {},
};

export const AI_SETTINGS_KEY = "ai_settings";

export function mergeAiSettings(raw: unknown): AiSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_AI_SETTINGS;
  const r = raw as Partial<AiSettings>;
  return {
    ...DEFAULT_AI_SETTINGS,
    ...r,
    providers: { ...DEFAULT_AI_SETTINGS.providers, ...(r.providers ?? {}) },
    monthlyQuota: { ...(r.monthlyQuota ?? {}) },
    priority: Array.isArray(r.priority) && r.priority.length ? r.priority : DEFAULT_AI_SETTINGS.priority,
    disabledTasks: Array.isArray(r.disabledTasks) ? r.disabledTasks : [],
  };
}
