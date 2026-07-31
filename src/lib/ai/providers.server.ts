/**
 * Provider registry — the only place that knows about model vendors.
 *
 * Every provider is expressed as an OpenAI-compatible chat endpoint, so adding
 * OpenAI, Claude, DeepSeek, Grok, Mistral, Ollama, Qwen or Llama later is a
 * config entry here plus a secret — zero application code changes.
 *
 * Server-only: reads API keys from process.env inside the call.
 */
import type { ProviderId } from "./settings";

export type ProviderSpec = {
  id: ProviderId;
  label: string;
  /** OpenAI-compatible chat-completions URL. */
  url: string;
  /** Default model id for this provider. */
  model: string;
  /** Env var holding the API key. */
  envKey: string;
  /** How the key is attached. */
  auth: "bearer" | "query" | "lovable";
  /** Free tier / no direct cost to Scoobix. */
  free: boolean;
  /** Extra body fields the provider requires. */
  extraBody?: Record<string, unknown>;
};

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "gemini",
    label: "Gemini 2.5 Flash (Google AI Studio)",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
    envKey: "GEMINI_API_KEY",
    auth: "bearer",
    free: true,
  },
  {
    id: "glm",
    label: "GLM-4 Flash (Zhipu)",
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4-flash",
    envKey: "GLM_API_KEY",
    auth: "bearer",
    free: true,
  },
  {
    id: "lovable",
    label: "Lovable AI Gateway",
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    model: "openai/gpt-5.6-sol",
    envKey: "LOVABLE_API_KEY",
    auth: "lovable",
    free: false,
    extraBody: { reasoning_effort: "none" },
  },
  {
    id: "openai",
    label: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    envKey: "OPENAI_API_KEY",
    auth: "bearer",
    free: false,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    url: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
    auth: "bearer",
    free: false,
  },
  {
    id: "mistral",
    label: "Mistral",
    url: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-small-latest",
    envKey: "MISTRAL_API_KEY",
    auth: "bearer",
    free: true,
  },
  {
    id: "grok",
    label: "xAI Grok",
    url: "https://api.x.ai/v1/chat/completions",
    model: "grok-2-latest",
    envKey: "XAI_API_KEY",
    auth: "bearer",
    free: false,
  },
  {
    id: "qwen",
    label: "Qwen (DashScope)",
    url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen-plus",
    envKey: "QWEN_API_KEY",
    auth: "bearer",
    free: false,
  },
  {
    id: "ollama",
    label: "Ollama (self-hosted)",
    url: process.env.OLLAMA_URL ?? "http://localhost:11434/v1/chat/completions",
    model: process.env.OLLAMA_MODEL ?? "llama3.1",
    envKey: "OLLAMA_API_KEY",
    auth: "bearer",
    free: true,
  },
];

export function providerById(id: ProviderId): ProviderSpec | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** A provider is usable when its secret exists (Ollama runs keyless). */
export function providerConfigured(p: ProviderSpec): boolean {
  if (p.id === "ollama") return Boolean(process.env.OLLAMA_URL);
  return Boolean(process.env[p.envKey]);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderResult = {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

/** Single OpenAI-compatible chat call. Throws on non-2xx so the caller can retry/fail over. */
export async function callProvider(
  p: ProviderSpec,
  messages: ChatMessage[],
  opts: { json?: boolean; maxTokens?: number; timeoutMs: number },
): Promise<ProviderResult> {
  const apiKey = process.env[p.envKey] ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let url = p.url;

  if (p.auth === "lovable") headers["Lovable-API-Key"] = apiKey;
  else if (p.auth === "query") url = `${url}?key=${encodeURIComponent(apiKey)}`;
  else if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const body: Record<string, unknown> = {
    model: p.model,
    messages,
    ...(p.extraBody ?? {}),
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.json && p.id !== "lovable") body.response_format = { type: "json_object" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`${p.id} ${res.status}: ${detail}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new Error(`${p.id}: empty completion`);
    return {
      text,
      model: p.model,
      tokensIn: json.usage?.prompt_tokens ?? 0,
      tokensOut: json.usage?.completion_tokens ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}
