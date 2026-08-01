/**
 * Stable device + session identity for security logging.
 *
 * - `deviceId` persists per browser (localStorage) and identifies a physical
 *   device across logins — used for device history and multi-account fraud
 *   signals. It is an opaque random id, never a fingerprint of the user.
 * - `sessionId` lives in sessionStorage: one per tab session, so audit rows can
 *   be grouped into a single sitting.
 * - IP is resolved at most once per browser session and cached; it is optional
 *   and logging never waits on it.
 */
const DEVICE_KEY = "scoobix.device.id";
const SESSION_KEY = "scoobix.session.id";
const IP_KEY = "scoobix.session.ip";

function rid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return `d_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function deviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let v = localStorage.getItem(DEVICE_KEY);
    if (!v) { v = rid(); localStorage.setItem(DEVICE_KEY, v); }
    return v;
  } catch {
    return "unknown";
  }
}

export function sessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let v = sessionStorage.getItem(SESSION_KEY);
    if (!v) { v = rid(); sessionStorage.setItem(SESSION_KEY, v); }
    return v;
  } catch {
    return "unknown";
  }
}

export function cachedIp(): string | null {
  if (typeof window === "undefined") return null;
  try { return sessionStorage.getItem(IP_KEY); } catch { return null; }
}

/**
 * Best-effort public IP, resolved once per browser session. Failures are
 * swallowed — IP is a nice-to-have in the trail, never a requirement.
 */
export async function resolveIp(): Promise<string | null> {
  const cached = cachedIp();
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { ip?: string };
    if (!json?.ip) return null;
    try { sessionStorage.setItem(IP_KEY, json.ip); } catch { /* ignore */ }
    return json.ip;
  } catch {
    return null;
  }
}

export type DeviceInfo = {
  deviceId: string;
  sessionId: string;
  browser: string;
  os: string;
  platform: string;
  label: string;
  userAgent: string;
  ip: string | null;
};

function detect(ua: string): { browser: string; os: string; platform: string } {
  const s = ua.toLowerCase();
  const browser =
    s.includes("edg/") ? "Edge" :
    s.includes("opr/") || s.includes("opera") ? "Opera" :
    s.includes("chrome") && !s.includes("chromium") ? "Chrome" :
    s.includes("firefox") ? "Firefox" :
    s.includes("safari") ? "Safari" : "Browser";
  const os =
    s.includes("android") ? "Android" :
    /iphone|ipad|ipod/.test(s) ? "iOS" :
    s.includes("mac os") ? "macOS" :
    s.includes("windows") ? "Windows" :
    s.includes("linux") ? "Linux" : "Unknown OS";
  const platform = /android|iphone|ipad|ipod|mobile/.test(s) ? "mobile" : "desktop";
  return { browser, os, platform };
}

export function deviceContext(): DeviceInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "server";
  const { browser, os, platform } = detect(ua);
  return {
    deviceId: deviceId(),
    sessionId: sessionId(),
    browser,
    os,
    platform,
    label: `${browser} on ${os}`,
    userAgent: ua.slice(0, 300),
    ip: cachedIp(),
  };
}

/** Which Scoobix app this tab is running, derived from the URL. */
export function currentApp(): "customer" | "partner" | "rider" | "manager" | "admin" {
  if (typeof window === "undefined") return "customer";
  const p = window.location.pathname;
  if (p.startsWith("/partner")) return "partner";
  if (p.startsWith("/rider")) return "rider";
  if (p.startsWith("/manager")) return "manager";
  if (p.startsWith("/admin")) return "admin";
  return "customer";
}
