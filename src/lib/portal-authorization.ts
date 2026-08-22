import { listTable, patchRecord } from "./insforge-crud";

export type PortalType = "partner" | "rider" | "manager" | "logistics" | "admin" | "customer";
export type PortalStatus = "active" | "disabled";

export type PortalAccessRow = {
  id: string;
  email: string;
  email_normalized: string;
  portal: PortalType;
  status: PortalStatus;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  created_by?: string;
};

export type AccessCheckResult =
  | { ok: true; status: "active" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "disabled" }
  | { ok: false; reason: "lookup_failed"; message: string };

function normalize(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

/** 
 * Authoritative check for portal access. 
 * P0.1: Exclusive mechanism for Admin, Logistics, Partner, Rider, and Manager.
 * Remove all hardcoded super-admin bypasses.
 */
export async function checkPortalAccess(
  email: string | null | undefined,
  portal: PortalType
): Promise<AccessCheckResult> {
  const normalizedEmail = normalize(email);
  if (!normalizedEmail) return { ok: false, reason: "not_found" };

  try {
    // FRESH lookup from portal_access table.
    const rows = await listTable<PortalAccessRow>(
      "portal_access",
      { 
        email_normalized: `eq.${normalizedEmail}`, 
        portal: `eq.${portal.toLowerCase()}`,
        limit: 1 
      },
      { ttl: 0, fresh: true, select: "id,status" }
    );

    if (rows.length === 0) {
      // Fallback for legacy rows without normalized email column populated.
      const legacyRows = await listTable<PortalAccessRow>(
        "portal_access",
        { 
          email: `eq.${normalizedEmail}`, 
          portal: `eq.${portal.toLowerCase()}`,
          limit: 1 
        },
        { ttl: 0, fresh: true, select: "id,status" }
      );
      
      if (legacyRows.length > 0) {
        const legacy = legacyRows[0];
        // Repair normalization for next time.
        void patchRecord("portal_access", legacy.id, { 
          email_normalized: normalizedEmail,
          email: normalizedEmail
        }).catch(err => console.error("[PORTAL_AUTH] Legacy repair failed:", err));
        
        if (legacy.status === "disabled") return { ok: false, reason: "disabled" };
        return { ok: true, status: "active" };
      }
      
      return { ok: false, reason: "not_found" };
    }
    
    const record = rows[0];
    if (record.status === "disabled") return { ok: false, reason: "disabled" };
    
    return { ok: true, status: "active" };
  } catch (err: any) {
    console.error(`[PORTAL_AUTH] Lookup failed for ${portal}:`, err);
    return { ok: false, reason: "lookup_failed", message: "Authorization service error." };
  }
}

/** Explicitly record a successful login timestamp. */
export async function recordPortalLogin(email: string, portal: PortalType) {
  const normalizedEmail = normalize(email);
  try {
    const rows = await listTable<PortalAccessRow>(
      "portal_access",
      { 
        email_normalized: `eq.${normalizedEmail}`, 
        portal: `eq.${portal.toLowerCase()}`,
        limit: 1 
      },
      { ttl: 0, fresh: true }
    );
    if (rows[0]) {
      await patchRecord("portal_access", rows[0].id, { 
        last_login_at: new Date().toISOString() 
      });
    }
  } catch (err) {
    console.warn("[PORTAL_AUTH] Login timestamp update skipped:", err);
  }
}
