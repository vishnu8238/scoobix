/**
 * Request protection helpers applied at every sensitive call site.
 *
 * Because Scoobix talks to InsForge directly from the app, these guards run in
 * front of the write helpers: they stop runaway loops, duplicate submits and
 * malformed/oversized input before a request is ever issued, and they record a
 * `rate_limited` security event when a caller trips a limit.
 *
 * They are deliberately cheap (in-memory counters + a session map) so they add
 * no infrastructure cost.
 */
import { PermissionError, assertPermission, type Permission } from "./permissions";
import type { Role } from "./types";
import { logAudit, type AuditCategory } from "./audit-api";

/* --------------------------------------------------------- rate limiting */

type Bucket = { hits: number[]; blockedUntil?: number };
const buckets = new Map<string, Bucket>();

export type RateRule = { limit: number; windowMs: number; blockMs?: number };

/** Sensible defaults per action family. */
export const RATE_RULES: Record<string, RateRule> = {
  "auth.login": { limit: 8, windowMs: 5 * 60_000, blockMs: 10 * 60_000 },
  "auth.signup": { limit: 4, windowMs: 60 * 60_000, blockMs: 30 * 60_000 },
  "auth.otp": { limit: 5, windowMs: 10 * 60_000, blockMs: 10 * 60_000 },
  "auth.password": { limit: 5, windowMs: 60 * 60_000 },
  "coupon.redeem": { limit: 20, windowMs: 60_000 },
  "order.create": { limit: 12, windowMs: 60_000 },
  "support.create": { limit: 6, windowMs: 10 * 60_000 },
  "support.reply": { limit: 40, windowMs: 60_000 },
  "upload.file": { limit: 30, windowMs: 60_000 },
  "privacy.export": { limit: 3, windowMs: 24 * 60 * 60_000 },
  "admin.write": { limit: 120, windowMs: 60_000 },
  default: { limit: 60, windowMs: 60_000 },
};

export class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(action: string, retryAfterMs: number) {
    super(`Too many attempts for ${action}. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Consume one slot for `action` scoped to `subject` (usually a user id or
 * device id). Throws `RateLimitError` when the window is exhausted.
 */
export function rateLimit(action: string, subject = "anon", rule?: RateRule): void {
  const r = rule ?? RATE_RULES[action] ?? RATE_RULES.default;
  const key = `${action}:${subject}`;
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };

  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    throw new RateLimitError(action, bucket.blockedUntil - now);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < r.windowMs);
  if (bucket.hits.length >= r.limit) {
    bucket.blockedUntil = now + (r.blockMs ?? r.windowMs);
    buckets.set(key, bucket);
    logAudit({
      action: "security.rate_limited",
      category: "security",
      severity: "warning",
      subjectType: "action",
      subjectId: action,
      summary: `Rate limit hit for ${action}`,
      meta: { subject, limit: r.limit, windowMs: r.windowMs },
    });
    throw new RateLimitError(action, bucket.blockedUntil - now);
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
}

/** Non-throwing probe, for disabling a button before the user clicks it. */
export function rateRemaining(action: string, subject = "anon"): number {
  const r = RATE_RULES[action] ?? RATE_RULES.default;
  const b = buckets.get(`${action}:${subject}`);
  if (!b) return r.limit;
  if (b.blockedUntil && b.blockedUntil > Date.now()) return 0;
  const now = Date.now();
  return Math.max(0, r.limit - b.hits.filter((t) => now - t < r.windowMs).length);
}

export function resetRateLimit(action?: string, subject?: string) {
  if (!action) { buckets.clear(); return; }
  buckets.delete(`${action}:${subject ?? "anon"}`);
}

/* ------------------------------------------- duplicate / replay protection */

const inflight = new Map<string, Promise<unknown>>();
const recent = new Map<string, number>();
const REPLAY_WINDOW = 15_000;

/**
 * Run `fn` at most once for a given idempotency key. A second call while the
 * first is still running returns the SAME promise (double-click protection);
 * a repeat inside the replay window is rejected outright.
 */
export async function once<T>(key: string, fn: () => Promise<T>, windowMs = REPLAY_WINDOW): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const last = recent.get(key);
  if (last && Date.now() - last < windowMs) {
    throw new Error("Duplicate request ignored");
  }
  const p = (async () => {
    try {
      const out = await fn();
      recent.set(key, Date.now());
      return out;
    } finally {
      inflight.delete(key);
      if (recent.size > 500) {
        const cutoff = Date.now() - windowMs;
        for (const [k, t] of recent) if (t < cutoff) recent.delete(k);
      }
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Deterministic idempotency key from an action + payload. */
export function idempotencyKey(action: string, payload: unknown): string {
  const json = (() => { try { return JSON.stringify(payload); } catch { return String(payload); } })();
  let h = 0;
  for (let i = 0; i < json.length; i++) h = (Math.imul(31, h) + json.charCodeAt(i)) | 0;
  return `${action}:${h.toString(36)}`;
}

/* ---------------------------------------------------- input sanitisation */

/** Strip control chars / angle brackets and clamp length. */
export function sanitizeText(value: unknown, maxLength = 2000): string {
  const s = String(value ?? "");
  return s
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/<\s*\/?\s*(script|iframe|object|embed|style)\b[^>]*>/gi, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeEmail(value: unknown): string {
  const s = String(value ?? "").trim().toLowerCase().slice(0, 200);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : "";
}

export function sanitizePhone(value: unknown): string {
  return String(value ?? "").replace(/[^\d+]/g, "").slice(0, 16);
}

export function sanitizeNumber(value: unknown, opts: { min?: number; max?: number; fallback?: number } = {}): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return opts.fallback ?? 0;
  return Math.min(opts.max ?? Number.MAX_SAFE_INTEGER, Math.max(opts.min ?? -Number.MAX_SAFE_INTEGER, n));
}

/** Deep-clean an object for persistence: sanitises strings, drops functions. */
export function sanitizeRecord<T extends Record<string, unknown>>(record: T, maxLength = 2000): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "function") continue;
    if (typeof v === "string") out[k] = sanitizeText(v, maxLength);
    else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = sanitizeRecord(v as Record<string, unknown>, maxLength);
    else out[k] = v;
  }
  return out as T;
}

/* ---------------------------------------------- request shape validation */

export type FieldRule = {
  required?: boolean;
  type?: "string" | "number" | "boolean" | "email" | "phone" | "array" | "object";
  min?: number;
  max?: number;
  values?: readonly string[];
};

export class ValidationError extends Error {
  fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super(`Invalid input: ${Object.keys(fields).join(", ")}`);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

/** Validate a payload against a small rule map; throws `ValidationError`. */
export function validateRequest<T extends Record<string, unknown>>(
  payload: T,
  rules: Record<string, FieldRule>,
): T {
  const errors: Record<string, string> = {};
  for (const [field, rule] of Object.entries(rules)) {
    const v = payload[field];
    const empty = v === undefined || v === null || v === "";
    if (rule.required && empty) { errors[field] = "Required"; continue; }
    if (empty) continue;
    switch (rule.type) {
      case "number":
        if (!Number.isFinite(Number(v))) errors[field] = "Must be a number";
        else if (rule.min !== undefined && Number(v) < rule.min) errors[field] = `Min ${rule.min}`;
        else if (rule.max !== undefined && Number(v) > rule.max) errors[field] = `Max ${rule.max}`;
        break;
      case "email":
        if (!sanitizeEmail(v)) errors[field] = "Invalid email";
        break;
      case "phone":
        if (sanitizePhone(v).length < 8) errors[field] = "Invalid phone";
        break;
      case "boolean":
        if (typeof v !== "boolean") errors[field] = "Must be true/false";
        break;
      case "array":
        if (!Array.isArray(v)) errors[field] = "Must be a list";
        else if (rule.min !== undefined && v.length < rule.min) errors[field] = `At least ${rule.min}`;
        break;
      case "object":
        if (typeof v !== "object" || Array.isArray(v)) errors[field] = "Must be an object";
        break;
      default: {
        const s = String(v);
        if (rule.min !== undefined && s.length < rule.min) errors[field] = `Min ${rule.min} characters`;
        else if (rule.max !== undefined && s.length > rule.max) errors[field] = `Max ${rule.max} characters`;
        else if (rule.values && !rule.values.includes(s)) errors[field] = "Not allowed";
      }
    }
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return payload;
}

/* ------------------------------------------------- secure file validation */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const ALLOWED_DOC_TYPES = ["application/pdf", ...ALLOWED_IMAGE_TYPES] as const;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type FileCheck = { ok: true } | { ok: false; reason: string };

/**
 * Validate an upload before it reaches storage: extension/MIME agreement,
 * size ceiling, and no double-extension or path-traversal filenames.
 */
export function validateUpload(
  file: File,
  opts: { kind?: "image" | "document"; maxBytes?: number } = {},
): FileCheck {
  const allowed: readonly string[] = opts.kind === "document" ? ALLOWED_DOC_TYPES : ALLOWED_IMAGE_TYPES;
  const maxBytes = opts.maxBytes ?? MAX_UPLOAD_BYTES;
  if (!file) return { ok: false, reason: "No file selected" };
  if (!file.size) return { ok: false, reason: "File is empty" };
  if (file.size > maxBytes) return { ok: false, reason: `File must be under ${Math.round(maxBytes / 1024 / 1024)}MB` };
  if (!allowed.includes(file.type)) return { ok: false, reason: "File type not allowed" };

  const name = file.name || "";
  if (/[\\/]|\.\./.test(name)) return { ok: false, reason: "Invalid file name" };
  const parts = name.toLowerCase().split(".");
  if (parts.length > 2 && /^(exe|sh|bat|js|php|html|svg)$/.test(parts[parts.length - 2] ?? "")) {
    return { ok: false, reason: "Suspicious file name" };
  }
  const ext = parts[parts.length - 1] ?? "";
  const extOk =
    (file.type === "application/pdf" && ext === "pdf") ||
    (file.type.startsWith("image/") && ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext));
  if (!extOk) return { ok: false, reason: "File extension does not match its content" };
  return { ok: true };
}

export function safeFileName(name: string): string {
  return (name || "file")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
}

/* ------------------------------------------------------- combined guard */

export type GuardOptions = {
  userId?: string | null;
  role?: Role | null;
  permission?: Permission;
  action: string;
  /** Rate-limit scope; defaults to the user id. */
  subject?: string;
  /** Set to make the operation idempotent for `windowMs`. */
  idempotency?: unknown;
  audit?: { category: AuditCategory; summary?: string; subjectType?: string; subjectId?: string; severity?: "info" | "notice" | "warning" | "critical" };
};

/**
 * The single entry point every sensitive mutation should use:
 * permission check → rate limit → duplicate protection → run → audit.
 */
export async function guarded<T>(opts: GuardOptions, fn: () => Promise<T>): Promise<T> {
  if (opts.permission) await assertPermission(opts.userId, opts.role, opts.permission);
  rateLimit(opts.action, opts.subject ?? opts.userId ?? "anon");

  const run = async () => {
    const out = await fn();
    if (opts.audit) {
      logAudit({
        action: opts.action,
        category: opts.audit.category,
        actorId: opts.userId ?? null,
        actorRole: opts.role ?? null,
        subjectType: opts.audit.subjectType,
        subjectId: opts.audit.subjectId,
        summary: opts.audit.summary ?? opts.action,
        severity: opts.audit.severity ?? "info",
      });
    }
    return out;
  };

  if (opts.idempotency !== undefined) {
    return once(idempotencyKey(opts.action, opts.idempotency), run);
  }
  return run();
}

/** Human-readable message for any guard failure. */
export function guardMessage(error: unknown): string {
  if (error instanceof RateLimitError) return error.message;
  if (error instanceof ValidationError) return error.message;
  if (error instanceof PermissionError) return "You do not have permission to do this.";
  return error instanceof Error ? error.message : "Something went wrong";
}
