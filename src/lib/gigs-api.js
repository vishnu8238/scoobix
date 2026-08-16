import { listTable, createRecord, patchRecord, deleteRecord, handleResponse } from "./insforge-crud";
import { publishTableChange } from "./realtime-bus";
import { newUuid } from "./orders-api";
import { insforge } from "./insforge";
export async function fetchGigs(params) {
    const TABLE_CANDIDATES = ["gigs"];
    const GIG_COLUMNS = "id,title,description,reward_amount,target_deliveries,start_time,end_time,status,zone_id,city_id,capacity,created_at";
    const { select, id, ...rest } = params || {};
    for (const table of TABLE_CANDIDATES) {
        try {
            console.log(`[GIGS_API] Authoritative probe for table "${table}"...`);
            let rows = [];
            if (id) {
                const query = insforge.database.from(table).select(select || GIG_COLUMNS).eq("id", id);
                const res = await handleResponse(query, "GET", table);
                rows = Array.isArray(res) ? res : [];
            }
            else {
                const data = await listTable(table, {
                    order: "start_time.asc",
                    ...rest
                }, {
                    fresh: true,
                    ttl: 0,
                    select: select || GIG_COLUMNS
                });
                rows = Array.isArray(data) ? data : [];
            }
            if (rows.length > 0) {
                console.log(`[GIGS_API] Successfully retrieved ${rows.length} rows from "${table}"`);
                return rows;
            }
        }
        catch (err) {
            console.warn(`[GIGS_API] Probe failed for "${table}":`, err.message);
            if (err.isRelationError || err.status === 404)
                continue;
            // If last candidate, let it fail; otherwise continue
            if (table === TABLE_CANDIDATES[TABLE_CANDIDATES.length - 1])
                throw err;
        }
    }
    return [];
}
export async function createGig(gig) {
    // Authoritative write candidate discovery
    const TABLE_CANDIDATES = ["gigs"];
    const id = newUuid();
    let lastError = null;
    for (const table of TABLE_CANDIDATES) {
        try {
            console.log(`[GIGS_API] Authoritative write attempt on "${table}"...`);
            const res = await createRecord(table, { ...gig, id });
            if (res) {
                publishTableChange(table, "insert", res);
                return res;
            }
        }
        catch (error) {
            console.warn(`[GIGS_API] Write failed for "${table}":`, error.message);
            lastError = error;
            // If it's a relation error, try next candidate
            if (error.status === 404 || error.isRelationError)
                continue;
            throw error;
        }
    }
    throw lastError || new Error(`Failed to create gig on all candidates: ${TABLE_CANDIDATES.join(", ")}`);
}
export async function updateGig(id, patch) {
    return patchRecord("gigs", id, patch);
}
export async function fetchGigParticipants(gigId) {
    return listTable("rider_gig_enrollments", { gig_id: `eq.${gigId}`, order: "completed_deliveries.desc" });
}
export async function enrollInGig(gigId, riderId) {
    const TABLE = "rider_gig_enrollments";
    // 1. Authoritative checks
    const [gigRows, existing, participants] = await Promise.all([
        fetchGigs({ id: gigId }),
        listTable(TABLE, { gig_id: `eq.${gigId}`, rider_id: `eq.${riderId}` }),
        listTable(TABLE, { gig_id: `eq.${gigId}` })
    ]);
    const gig = gigRows[0];
    if (!gig)
        throw new Error("Gig not found");
    if (gig.status !== "ACTIVE" && gig.status !== "SCHEDULED")
        throw new Error("Gig is not active for booking");
    if (existing && existing.length > 0)
        return existing[0];
    const currentCount = participants?.length || 0;
    if (gig.capacity && currentCount >= gig.capacity) {
        throw new Error("Gig is at full capacity");
    }
    const id = newUuid();
    const participant = {
        gig_id: gigId,
        rider_id: riderId,
        completed_deliveries: 0,
        status: "ENROLLED"
    };
    const res = await createRecord(TABLE, { ...participant, id });
    if (res)
        publishTableChange(TABLE, "insert", res);
    return res;
}
export async function cancelGigEnrollment(gigId, riderId) {
    const TABLE = "rider_gig_enrollments";
    const existing = await listTable(TABLE, {
        gig_id: `eq.${gigId}`,
        rider_id: `eq.${riderId}`
    });
    if (existing && existing.length > 0) {
        return deleteRecord(TABLE, existing[0].id);
    }
    return null;
}
export async function fetchRiderGigs(riderId) {
    const participations = await listTable("rider_gig_enrollments", {
        rider_id: `eq.${riderId}`
    });
    if (!participations.length)
        return [];
    const gigIds = participations.map(p => p.gig_id);
    // Ideally use .in filter if SDK supports it, or individual fetches
    const gigs = await Promise.all(gigIds.map(id => listTable("gigs", { id: `eq.${id}`, limit: 1 }).then(rows => rows[0])));
    return gigs.filter(Boolean).map(g => {
        const p = participations.find(pp => pp.gig_id === g.id);
        return { ...g, enrollment: p };
    });
}
