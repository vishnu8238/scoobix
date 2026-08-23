import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";
import { publishTableChange } from "./realtime-bus";
import { newUuid } from "./orders-api";
import { insforge } from "./insforge";
import { publishRiderRefresh } from "./delivery-sync";

export type Gig = {
  id: string;
  driver_id?: string;
  order_id?: string;
  gig_type: string;
  status: string;
  pickup_location?: string;
  dropoff_location?: string;
  distance_km?: number;
  estimated_time_minutes?: number;
  payout: number;
  tips?: number;
  zone_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  // UI Aliases (canonical columns only; null when not persisted)
  title?: string | null;
  description?: string | null;
  reward_amount?: number;
  target_deliveries?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  capacity?: number | null;
  city_id?: string | null;
  completion_pct?: number | null;
};

export type GigParticipant = {
  id: string;
  gig_id: string;
  rider_id: string;
  completed_deliveries: number;
  status: "ENROLLED" | "COMPLETED" | "FAILED";
  created_at: string;
};

const AUTHORITATIVE_TABLE = "gigs";

export async function fetchGigs(params?: Record<string, any>) {
  const { id, ...rest } = params || {};

  try {
    let rows: any[] = [];
    if (id) {
      const { data } = await insforge.database.from(AUTHORITATIVE_TABLE).select("*").eq("id", id);
      rows = data || [];
    } else {
      const data = await listTable<any>(AUTHORITATIVE_TABLE, rest, { fresh: true, ttl: 0 });
      rows = Array.isArray(data) ? data : [];
    }
    
    // CANONICAL-ONLY normalization: never read `metadata` as a fallback for
    // title/description/schedule/capacity/target/city. Null stays null so the
    // UI can honestly render "Unavailable"/"Unassigned" and exports stay blank.
    return rows.map(r => ({
      ...r,
      title: r.title ?? null,
      description: r.description ?? null,
      reward_amount: typeof r.payout === "number" ? r.payout : (typeof r.reward_amount === "number" ? r.reward_amount : 0),
      payout: typeof r.payout === "number" ? r.payout : (typeof r.reward_amount === "number" ? r.reward_amount : 0),
      target_deliveries: typeof r.target_deliveries === "number" ? r.target_deliveries : null,
      start_time: r.start_time ?? null,
      end_time: r.end_time ?? null,
      capacity: typeof r.capacity === "number" ? r.capacity : null,
      city_id: r.city_id ?? null,
      completion_pct: typeof r.completion_pct === "number" ? r.completion_pct : null,
      status: r.status?.toLowerCase() // Normalize status to lower-case
    }));

  } catch (err: any) {
    console.error(`[GIGS_API] Fetch failed for ${AUTHORITATIVE_TABLE}:`, err.message);
    throw err;
  }
}

export async function createGig(gig: Partial<Gig>) {
  const id = gig.id || newUuid();
  
  // Persist to CANONICAL `gigs` columns (reads never fall back to metadata).
  const record: Record<string, any> = {
    id,
    payout: gig.payout || gig.reward_amount || 0,
    status: gig.status?.toLowerCase() || "pending",
    zone_id: gig.zone_id,
    gig_type: gig.gig_type || "delivery",
    pickup_location: gig.pickup_location || "",
    dropoff_location: gig.dropoff_location || "",
    title: gig.title ?? null,
    description: gig.description ?? null,
    target_deliveries: gig.target_deliveries ?? null,
    start_time: gig.start_time ?? null,
    end_time: gig.end_time ?? null,
    capacity: gig.capacity ?? null,
    city_id: gig.city_id ?? null,
  };


  try {
    const res = await createRecord<Gig>(AUTHORITATIVE_TABLE, record);
    if (res) {
      publishTableChange(AUTHORITATIVE_TABLE, "insert", res as any);
      publishRiderRefresh();
      return res;
    }
    throw new Error(`Failed to create gig in ${AUTHORITATIVE_TABLE}`);
  } catch (error: any) {
    console.error(`[GIGS_API] Create failed for ${AUTHORITATIVE_TABLE}:`, error.message);
    throw error;
  }
}

export async function updateGigCapacity(gigId: string, capacity: number) {
  try {
    const { data, error } = await insforge.database.rpc('update_gig_capacity', {
      p_gig_id: gigId,
      p_capacity: capacity
    });

    if (error) {
      console.error("[GIGS_API] update_gig_capacity RPC Error:", error);
      throw new Error(error.message || "Failed to update capacity");
    }

    if (data) {
      publishTableChange(AUTHORITATIVE_TABLE, "update", data as any);
      publishRiderRefresh();
      return data as Gig;
    }
    
    throw new Error("Capacity update system returned no data.");
  } catch (e: any) {
    console.warn("[GIGS_API] updateGigCapacity failed:", e.message);
    throw new Error(e.message || "Capacity update system is currently unavailable.");
  }
}

  try {
    // Canonical column updates only; no metadata mirroring of gig fields.
    const dbPatch: any = { ...patch };

    if (patch.reward_amount !== undefined) dbPatch.payout = patch.reward_amount;
    if (patch.payout !== undefined) dbPatch.reward_amount = patch.payout;



    const res = await patchRecord<Gig>(AUTHORITATIVE_TABLE, id, dbPatch);
    if (res) {
      publishRiderRefresh();
      return res;
    }
    throw new Error(`Gig ${id} not found in ${AUTHORITATIVE_TABLE}`);
  } catch (error: any) {
    console.error(`[GIGS_API] Update failed for ${AUTHORITATIVE_TABLE}:`, error.message);
    throw error;
  }
}

export async function deleteGig(gigId: string, enrollmentCount: number) {
  try {
    if (enrollmentCount === 0) {
      const res = await deleteRecord(AUTHORITATIVE_TABLE, gigId);
      publishTableChange(AUTHORITATIVE_TABLE, "delete", { id: gigId });
      publishRiderRefresh();
      return res;
    } else {
      const res = await patchRecord(AUTHORITATIVE_TABLE, gigId, { status: "cancelled" });
      if (res) {
        publishTableChange(AUTHORITATIVE_TABLE, "update", res as any);
        publishRiderRefresh();
      }
      return res;
    }
  } catch (error: any) {
    console.error(`[GIGS_API] Delete/Cancel failed for ${AUTHORITATIVE_TABLE}:`, error.message);
    throw error;
  }
}

export async function bulkDeleteGigs(gigIds: string[]) {
  try {
    const results = await Promise.all(
      gigIds.map(id => deleteRecord(AUTHORITATIVE_TABLE, id))
    );
    publishTableChange(AUTHORITATIVE_TABLE, "delete", { ids: gigIds } as any);
    publishRiderRefresh();
    return results;
  } catch (error: any) {
    console.error(`[GIGS_API] Bulk delete failed:`, error.message);
    throw error;
  }
}

export async function bulkCancelGigs(gigIds: string[]) {
  try {
    const results = await Promise.all(
      gigIds.map(id => patchRecord(AUTHORITATIVE_TABLE, id, { status: "cancelled" }))
    );
    publishTableChange(AUTHORITATIVE_TABLE, "update", { ids: gigIds, status: "cancelled" } as any);
    publishRiderRefresh();
    return results;
  } catch (error: any) {
    console.error(`[GIGS_API] Bulk cancel failed:`, error.message);
    throw error;
  }
}

export async function fetchGigParticipants(gigId: string) {
  try {
    const session = insforge.auth.session;
    const authId = session?.user?.id;
    
    // P0.1 SECURITY: Authenticated riders can only see their own enrollments.
    // Logistics/Admins can see all participants for a gig.
    const params: Record<string, string> = { 
      gig_id: `eq.${gigId}`, 
      order: "completed_deliveries.desc" 
    };

    const data = await listTable<GigParticipant>("rider_gig_enrollments", params, { fresh: true, ttl: 0 });
    
    // Filter client-side if the database query returned more than one and we are a rider
    if (data && data.length > 0 && authId) {
      // Check if user has logistics view permission (via portal_access or similar)
      const { checkPortalAccess } = await import("./portal-authorization");
      const { data: user } = await insforge.auth.getCurrentUser();
      const hasPrivilegedAccess = (await checkPortalAccess(user?.user?.email, "admin")).ok || 
                                 (await checkPortalAccess(user?.user?.email, "logistics")).ok;
      
      if (!hasPrivilegedAccess) {
        return data.filter(p => p.rider_id === authId);
      }
    }

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchGigEnrollmentData(gigIds: string[]): Promise<Record<string, { count: number; completed_deliveries: number }>> {
  if (!gigIds.length) return {};
  try {
    const enrollments = await listTable<GigParticipant>("rider_gig_enrollments", {
      gig_id: `in.(${gigIds.join(",")})`
    }, { fresh: true, ttl: 0 });
    
    const data: Record<string, { count: number; completed_deliveries: number }> = {};
    enrollments.forEach(e => {
      if (!data[e.gig_id]) {
        data[e.gig_id] = { count: 0, completed_deliveries: 0 };
      }
      data[e.gig_id].count += 1;
      data[e.gig_id].completed_deliveries += (e.completed_deliveries || 0);
    });
    return data;
  } catch (e) {
    console.error("[GIGS_API] Failed to fetch enrollment data:", e);
    return {};
  }
}

export async function fetchGigEnrollmentCounts(gigIds: string[]): Promise<Record<string, number>> {
  const data = await fetchGigEnrollmentData(gigIds);
  const counts: Record<string, number> = {};
  Object.keys(data).forEach(id => {
    counts[id] = data[id].count;
  });
  return counts;
}

export async function enrollInGig(gigId: string, _riderId: string) {
  const TABLE = "rider_gig_enrollments";
  
  try {
    const { data, error } = await insforge.database.rpc('accept_gig_for_current_rider', {
      p_gig_id: gigId
    });

    if (error) {
      console.error("[GIGS_API] RPC Error:", error);
      throw new Error(error.message || "Enrollment failed");
    }

    if (data) {
      publishTableChange(TABLE, "insert", data as any);
      return data;
    }
    
    throw new Error("Enrollment system returned no data.");
  } catch (e: any) {
    console.warn("[GIGS_API] Enrollment failed:", e.message);
    throw new Error(e.message || "Enrollment system is currently unavailable.");
  }
}

export async function cancelGigEnrollment(gigId: string, riderId: string) {
  const TABLE = "rider_gig_enrollments";
  try {
    const existing = await listTable<GigParticipant>(TABLE, {
      gig_id: `eq.${gigId}`,
      rider_id: `eq.${riderId}`
    });
    
    if (existing && existing.length > 0) {
      return deleteRecord(TABLE, existing[0].id);
    }
  } catch (e) {
    console.warn("[GIGS_API] Cancel enrollment failed:", e);
  }
  return null;
}

export async function fetchRiderGigs(riderId: string) {
  try {
    const participations = await listTable<GigParticipant>("rider_gig_enrollments", {
      rider_id: `eq.${riderId}`
    });
    
    if (!participations.length) return [];
    
    const gigIds = participations.map(p => p.gig_id);
    const gigs = await Promise.all(
      gigIds.map(id => fetchGigs({ id }).then(rows => rows[0]))
    );
    
    return gigs.filter(Boolean).map(g => {
      const p = participations.find(pp => pp.gig_id === g.id);
      return { ...g, enrollment: p };
    });
  } catch {
    return [];
  }
}