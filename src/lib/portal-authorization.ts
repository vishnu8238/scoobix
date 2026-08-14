import { listTable, patchRecord, createRecord } from "./insforge-crud";

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

/** Authoritative check for portal access. */
export async function checkPortalAccess(
  email: string | null | undefined,
  portal: PortalType
): Promise<AccessCheckResult> {
  const normalizedEmail = normalize(email);
  if (!normalizedEmail) return { ok: false, reason: "not_found" };

  // Super Admin Bypass - Permanent access to all portals
  const SUPER_ADMIN = "scoobix.info@gmail.com";
  if (normalizedEmail === SUPER_ADMIN) {
    return { ok: true, status: "active" };
  }

  try {
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
      // Diagnostic check: list all entries for this email to see what portals/formats exist
      const allUserAccess = await listTable<PortalAccessRow>(
        "portal_access",
        { email_normalized: `eq.${normalizedEmail}` },
        { ttl: 0, fresh: true, select: "portal" }
      ).catch(() => []);
      
      console.log(`[AUTH_DEBUG] No match for ${normalizedEmail} on portal ${portal}. Portals found for user:`, allUserAccess.map(r => r.portal));

      // Fallback for legacy rows that might only have 'email' and not 'email_normalized'
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
        console.log(`[AUTH_DEBUG] Legacy row found for ${normalizedEmail} on ${portal}. Repairing...`);
        const legacy = legacyRows[0];
        void patchRecord("portal_access", legacy.id, { 
          email_normalized: normalizedEmail,
          email: normalizedEmail
        }).catch(err => console.error("[AUTH_DEBUG] Failed to repair legacy row:", err));
        
        if (legacy.status === "disabled") return { ok: false, reason: "disabled" };
        return { ok: true, status: "active" };
      }
      
      return { ok: false, reason: "not_found" };
    }
    
    const record = rows[0];
    console.log(`[AUTH_DEBUG] Found access record for ${normalizedEmail} on ${portal}. Status: ${record.status}`);
    if (record.status === "disabled") return { ok: false, reason: "disabled" };
    
    return { ok: true, status: "active" };
  } catch (err: any) {
    console.error(`[AUTH_DEBUG] Portal access lookup failed for ${portal}:`, err);
    return { ok: false, reason: "lookup_failed", message: `Authorization lookup failed: ${err.message || 'Database error'}` };
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
    console.error("[AUTH_DEBUG] Failed to update last_login_at:", err);
  }
}
