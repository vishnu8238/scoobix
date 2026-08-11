/**
 * Logistics portal authorization lookup.
 *
 * Single source of truth for "is this authenticated email allowed into the
 * Logistics portal". Matching is exact email identity, case-insensitive and
 * whitespace-trimmed — never substring/prefix matching.
 */
import { listTable } from "./insforge-crud";

export type LogisticsStaffRow = { email?: string | null; status?: string | null; level?: string | null };

export type LogisticsAdmission =
  | { ok: true; level: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "lookup_failed"; message: string };

const BLOCKED_STATUS = new Set(["inactive", "suspended", "disabled", "revoked"]);

function normalize(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/** Authoritative admission check. Distinguishes "unauthorized" from "lookup failed". */
export async function checkLogisticsAdmission(email: string | null | undefined): Promise<LogisticsAdmission> {
  const authEmail = normalize(email);
  if (!authEmail) return { ok: false, reason: "not_found" };

  let rows: LogisticsStaffRow[];
  try {
    rows = await listTable<LogisticsStaffRow>(
      "logistics_staff",
      { select: "email,status,level", limit: 200 },
      { ttl: 0, fresh: true },
    );
  } catch (e: any) {
    return { ok: false, reason: "lookup_failed", message: e?.message || "logistics_staff lookup failed" };
  }

  const match = rows.find((r) => normalize(r?.email) === authEmail);
  if (!match) return { ok: false, reason: "not_found" };
  if (BLOCKED_STATUS.has(normalize(match.status ?? "active"))) return { ok: false, reason: "not_found" };
  return { ok: true, level: normalize(match.level) || "dispatcher" };
}

/** Convenience boolean for role resolution (failures are treated as "no role"). */
export async function isLogisticsStaffEmail(email: string | null | undefined): Promise<boolean> {
  const res = await checkLogisticsAdmission(email);
  return res.ok;
}
