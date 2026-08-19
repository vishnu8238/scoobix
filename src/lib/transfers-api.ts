/**
 * Restaurant ownership transfer workflow.
 *
 * pending → under_review → approved | rejected. Every request and decision is
 * kept forever in `ownership_transfers` (nothing is deleted) and mirrored into
 * activity logs so the restaurant timeline stays complete.
 */
import { createRecord, listTable, patchRecord } from "./insforge-crud";
import { logOnboardingEvent, type MerchantManager } from "./manager-api";

export type TransferStatus = "pending" | "under_review" | "approved" | "rejected";

export const TRANSFER_STATUSES: TransferStatus[] = ["pending", "under_review", "approved", "rejected"];

export const TRANSFER_LABEL: Record<TransferStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
};

export const TRANSFER_TONE: Record<TransferStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  under_review: "bg-violet-100 text-violet-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

export type TransferRow = {
  id: string;
  restaurant_id?: string | null;
  restaurant_name?: string | null;
  rst_code?: string | null;
  from_manager_id?: string | null;
  from_manager_name?: string | null;
  to_manager_id?: string | null;
  to_manager_name?: string | null;
  requested_by?: string | null;
  requested_by_name?: string | null;
  reason?: string | null;
  status?: string | null;
  admin_remarks?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  duplicate_check_id?: string | null;
  created_at?: string | null;
};

export function transferStatus(row: TransferRow): TransferStatus {
  const s = ((row.status ?? "pending").replace(/^'|'$/g, "") || "pending") as TransferStatus;
  return TRANSFER_STATUSES.includes(s) ? s : "pending";
}

export async function requestOwnershipTransfer(input: {
  restaurant: { id: string; name?: string | null; rst_code?: string | null; manager_id?: string | null; manager_name?: string | null };
  toManager: Pick<MerchantManager, "id" | "name"> | null;
  requestedBy?: string | null;
  requestedByName?: string | null;
  reason: string;
  duplicateCheckId?: string | null;
}): Promise<TransferRow | null> {
  const created = await createRecord<TransferRow[] | TransferRow>("ownership_transfers", {
    restaurant_id: input.restaurant.id,
    restaurant_name: input.restaurant.name ?? null,
    rst_code: input.restaurant.rst_code ?? null,
    from_manager_id: input.restaurant.manager_id ?? null,
    from_manager_name: input.restaurant.manager_name ?? null,
    to_manager_id: input.toManager?.id ?? null,
    to_manager_name: input.toManager?.name ?? null,
    requested_by: input.requestedBy ?? null,
    requested_by_name: input.requestedByName ?? null,
    reason: input.reason,
    status: "pending",
    duplicate_check_id: input.duplicateCheckId ?? null,
  });
  let row = (Array.isArray(created) ? created[0] : created) as TransferRow | null;
  if (!row?.id) {
    const latest = await listTable<TransferRow>("ownership_transfers", {
      restaurant_id: `eq.${input.restaurant.id}`,
      order: "created_at.desc",
      limit: 1,
    });
    row = latest[0] ?? null;
  }
  if (row && input.restaurant.id) {
    // logOnboardingEvent handles missing table gracefully
    await logOnboardingEvent({
      restaurantId: input.restaurant.id,
      managerId: input.restaurant.manager_id ?? null,
      status: "transfer_requested",
      note: input.reason,
      actorRole: "manager",
    });
  }
  return row;
}

export async function listTransfers(params?: {
  status?: TransferStatus;
  managerId?: string;
  restaurantId?: string;
  limit?: number;
}): Promise<TransferRow[]> {
  const q: Record<string, string | number> = { order: "created_at.desc", limit: params?.limit ?? 200 };
  if (params?.status) q.status = `eq.${params.status}`;
  if (params?.restaurantId) q.restaurant_id = `eq.${params.restaurantId}`;
  const rows = await listTable<TransferRow>("ownership_transfers", q);
  if (!params?.managerId) return rows;
  return rows.filter(
    (r) =>
      r.from_manager_id === params.managerId ||
      r.to_manager_id === params.managerId ||
      r.requested_by === params.managerId,
  );
}

export async function setTransferStatus(input: {
  transfer: TransferRow;
  status: TransferStatus;
  remarks?: string;
  adminId?: string | null;
}) {
  const { transfer, status } = input;
  await patchRecord("ownership_transfers", transfer.id, {
    status,
    admin_remarks: input.remarks ?? transfer.admin_remarks ?? null,
    decided_by: input.adminId ?? null,
    decided_at: status === "pending" || status === "under_review" ? null : new Date().toISOString(),
  });

  if (status === "approved" && transfer.restaurant_id && transfer.to_manager_id) {
    await patchRecord("restaurants", transfer.restaurant_id, {
      manager_id: transfer.to_manager_id,
      manager_name: transfer.to_manager_name ?? null,
    });
  }

  if (transfer.restaurant_id) {
    // logOnboardingEvent handles missing table gracefully
    await logOnboardingEvent({
      restaurantId: transfer.restaurant_id,
      managerId: status === "approved" ? transfer.to_manager_id : transfer.from_manager_id,
      status: `transfer_${status}`,
      note: input.remarks,
      actorRole: "admin",
    });
  }
}
