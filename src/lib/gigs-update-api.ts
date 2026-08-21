import { listTable, patchRecord, deleteRecord } from "./insforge-crud";
import { publishTableChange } from "./realtime-bus";

const AUTHORITATIVE_TABLE = "gigs";

export async function deleteGig(gigId: string, enrollmentCount: number) {
  if (enrollmentCount === 0) {
    return deleteRecord(AUTHORITATIVE_TABLE, gigId);
  } else {
    // If enrolled, transition to CANCELLED instead of hard delete
    return patchRecord(AUTHORITATIVE_TABLE, gigId, { status: "CANCELLED" });
  }
}

export async function bulkUpdateStatus(gigIds: string[], status: string) {
  const TABLE = AUTHORITATIVE_TABLE;
  // Patch all provided gigs to the new status
  return Promise.all(gigIds.map(id => patchRecord(TABLE, id, { status })));
}
