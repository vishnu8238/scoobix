/**
 * app_settings — single source of truth for platform business rules.
 *
 * All business values (commissions, delivery fees, driver pay, feature
 * toggles) live in one `app_settings` row on the backend. This module:
 *
 *   - Hydrates the settings once on first read (bootstrapAppSettings).
 *   - Exposes a snapshot getter (`getAppSettings`) for non-React callers
 *     (dispatch engine, order finalizer, etc.).
 *   - Exposes a React hook (`useAppSettings`) that re-renders when values
 *     change.
 *   - Provides `patchAppSettings()` — used by the existing admin screens
 *     when the operator saves. Never edits UI; simply persists to backend.
 *
 * Storage strategy: the backend row is keyed by `id='global'`. If the row
 * does not exist yet the first `patchAppSettings` call creates it.
 * Reads fall back to localStorage while offline, then to DEFAULTS.
 */

import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------- types

export type DeliverySlab = { uptoKm: number; fee: number };

export type AppSettings = {
  // --- restaurant economics
  default_commission_pct: number;      // fallback when restaurants.commission is null
  payout_cycle_hours: number;

  // --- delivery pricing
  delivery_base_fee: number;
  delivery_per_km: number;
  free_delivery_min: number;           // ₹ cart total for free delivery
  delivery_slabs: DeliverySlab[];

  // --- driver economics
  driver_base_pay: number;             // flat ₹ per delivery
  driver_per_km: number;               // ₹ per km
  long_distance_km: number;            // threshold in km
  long_distance_bonus: number;         // extra ₹ when distance > threshold

  // --- operations
  order_accept_timeout_sec: number;    // partner accept window
  driver_offer_timeout_sec: number;    // driver accept window

  // --- feature toggles
  free_delivery_enabled: boolean;
  scratch_enabled: boolean;
  wallet_enabled: boolean;
  referral_enabled: boolean;
  ads_enabled: boolean;
  flavour52_enabled: boolean;

  // --- loyalty
  wallet_cashback_pct: number;         // % of order total credited on delivery

  // --- duplicate detection
  duplicate_radius_m: number;          // GPS radius (metres) for duplicate matches
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  default_commission_pct: 5,
  payout_cycle_hours: 24,

  delivery_base_fee: 25,
  delivery_per_km: 8,
  free_delivery_min: 500,
  delivery_slabs: [
    { uptoKm: 2, fee: 25 },
    { uptoKm: 5, fee: 40 },
    { uptoKm: 10, fee: 65 },
    { uptoKm: 999, fee: 90 },
  ],

  driver_base_pay: 25,
  driver_per_km: 6,
  long_distance_km: 6,
  long_distance_bonus: 20,

  order_accept_timeout_sec: 60,
  driver_offer_timeout_sec: 60,

  free_delivery_enabled: true,
  scratch_enabled: true,
  wallet_enabled: true,
  referral_enabled: true,
  ads_enabled: true,
  flavour52_enabled: true,

  wallet_cashback_pct: 2,

  duplicate_radius_m: 300,
};

// -------------------------------------------------------------- backend

const TABLE_URL = `${INSFORGE_URL}/api/database/records/app_settings`;
const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};
const ROW_ID = "global";
const LS_KEY = "scoobix_app_settings_v1";

// ---------------------------------------------------------------- state

type Listener = (s: AppSettings) => void;
const listeners = new Set<Listener>();
let snapshot: AppSettings = loadFromCache();
let bootstrapped = false;
let bootstrapPromise: Promise<AppSettings> | null = null;

function loadFromCache(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

function saveToCache(s: AppSettings) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function emit() {
  for (const l of Array.from(listeners)) {
    try { l(snapshot); } catch { /* ignore */ }
  }
}

function coerce(row: Record<string, unknown>): AppSettings {
  // Backend row → typed AppSettings, filling in any missing keys with defaults.
  // `delivery_slabs` may arrive as JSON string.
  const out: AppSettings = { ...DEFAULT_APP_SETTINGS };
  for (const k of Object.keys(DEFAULT_APP_SETTINGS) as (keyof AppSettings)[]) {
    const v = row[k];
    if (v === undefined || v === null) continue;
    if (k === "delivery_slabs") {
      if (typeof v === "string") {
        try { (out as unknown as Record<string, unknown>)[k] = JSON.parse(v); } catch { /* keep default */ }
      } else if (Array.isArray(v)) {
        (out as unknown as Record<string, unknown>)[k] = v;
      }
      continue;
    }
    (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ----------------------------------------------------- bootstrap / read

export async function bootstrapAppSettings(): Promise<AppSettings> {
  if (bootstrapped) return snapshot;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      const res = await fetch(`${TABLE_URL}?limit=1`, { headers: HEADERS });
      if (res.ok) {
        const rows = (await res.json()) as Record<string, unknown>[];
        if (Array.isArray(rows) && rows.length > 0) {
          snapshot = coerce(rows[0]);
          saveToCache(snapshot);
          emit();
        }
      }
    } catch { /* fall back to cache/defaults */ }
    bootstrapped = true;
    return snapshot;
  })();
  return bootstrapPromise;
}

// Kick off bootstrap on module import in the browser so consumers get fresh
// values without every caller having to await first.
if (typeof window !== "undefined") {
  void bootstrapAppSettings();
}

export function getAppSettings(): AppSettings {
  return snapshot;
}

export function subscribeAppSettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useAppSettings(): AppSettings {
  const [s, setS] = useState<AppSettings>(snapshot);
  useEffect(() => {
    // Ensure bootstrap has been kicked off.
    void bootstrapAppSettings().then(() => setS(getAppSettings()));
    return subscribeAppSettings(setS);
  }, []);
  return s;
}

// --------------------------------------------------------------- writes

/**
 * Merge-patch the global `app_settings` row. Best-effort — errors are
 * swallowed so the UI never blocks on network failures. Creates the row
 * on first write.
 */
export async function patchAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next: AppSettings = { ...snapshot, ...patch };
  snapshot = next;
  saveToCache(next);
  emit();

  // Try PATCH; if row doesn't exist create it.
  try {
    const patched = await fetch(`${TABLE_URL}/${ROW_ID}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ ...patch, delivery_slabs: JSON.stringify(next.delivery_slabs) }),
    });
    if (!patched.ok && (patched.status === 404 || patched.status === 400)) {
      // Row doesn't exist — insert full snapshot.
      await fetch(TABLE_URL, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
          id: ROW_ID,
          ...next,
          delivery_slabs: JSON.stringify(next.delivery_slabs),
        }),
      });
    }
  } catch { /* offline: cache-only until reconnect */ }

  return next;
}
