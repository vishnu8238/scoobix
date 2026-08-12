/**
 * Logistics portal authorization lookup.
 *
 * Single source of truth for "is this authenticated email allowed into the
 * Logistics portal". Matching is exact email identity, case-insensitive and
 * whitespace-trimmed — never substring/prefix matching.
 */
import { checkPortalAccess } from "./portal-authorization";

export type LogisticsAdmission =
  | { ok: true; level: string }
  | { ok: false; reason: "not_found" | "disabled" | "lookup_failed"; message?: string };

/** Authoritative admission check. Refactored to use portal_access table. */
export async function checkLogisticsAdmission(email: string | null | undefined): Promise<LogisticsAdmission> {
  const result = await checkPortalAccess(email, "logistics");
  
  if (result.ok) {
    return { ok: true, level: "dispatcher" };
  }
  
  if (result.reason === "lookup_failed") {
    return { ok: false, reason: "lookup_failed", message: result.message };
  }
  
  return { ok: false, reason: result.reason };
}

/** Convenience boolean for role resolution. */
export async function isLogisticsStaffEmail(email: string | null | undefined): Promise<boolean> {
  const res = await checkLogisticsAdmission(email);
  return res.ok;
}

