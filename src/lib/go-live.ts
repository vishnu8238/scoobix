/**
 * Restaurant go-live checklist.
 *
 * A restaurant can only be flipped live once every mandatory requirement is
 * satisfied — or an admin explicitly overrides the gate. All inputs come from
 * live InsForge rows (`restaurants`, `menu_items`, `users`); nothing here is
 * derived from local/demo state.
 */
import { listTable, patchRecord } from "./insforge-crud";
import { isKycComplete } from "./kyc-api";
import type { RestaurantRow } from "./partner-store";

export const MIN_MENU_ITEMS = 5;

export type GoLiveRow = RestaurantRow & {
  bank_account?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  bank_holder?: string | null;
  gst_number?: string | null;
  fssai_number?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  bank_verified?: boolean | null;
  docs_verified?: boolean | null;
  go_live_override?: boolean | null;
  is_live?: boolean | null;
  went_live_at?: string | null;
};

export type ChecklistKey =
  | "logo"
  | "cover"
  | "menu"
  | "bank"
  | "docs"
  | "timings"
  | "radius"
  | "payment"
  | "owner"
  | "kyc";

export type ChecklistItem = {
  key: ChecklistKey;
  label: string;
  hint: string;
  done: boolean;
  /** Only an admin can tick this one off. */
  adminOnly?: boolean;
};

export type ChecklistContext = {
  menuCount?: number;
  ownerActive?: boolean;
  kycVerified?: boolean;
};

const has = (v: unknown) => typeof v === "string" && v.trim().length > 0;

export function buildChecklist(r: GoLiveRow | null, ctx: ChecklistContext = {}): ChecklistItem[] {
  const menuCount = ctx.menuCount ?? 0;
  return [
    { key: "logo", label: "Logo uploaded", hint: "Square brand logo", done: has(r?.logo_url) || has((r as { logo?: string } | null)?.logo) },
    { key: "cover", label: "Cover image uploaded", hint: "Wide storefront banner", done: has(r?.cover_url) || has((r as { cover_image?: string } | null)?.cover_image) },
    { key: "menu", label: `Minimum ${MIN_MENU_ITEMS} menu items`, hint: `${menuCount} added`, done: menuCount >= MIN_MENU_ITEMS },
    { key: "bank", label: "Bank account verified", hint: "Verified by Scoobix finance", done: !!r?.bank_verified, adminOnly: true },
    { key: "docs", label: "GST / FSSAI validated", hint: "Documents checked by admin", done: !!r?.docs_verified, adminOnly: true },
    { key: "timings", label: "Store timings added", hint: "Opening and closing time", done: has(r?.opening_time) && has(r?.closing_time) },
    { key: "radius", label: "Delivery radius configured", hint: "Serviceable distance in km", done: Number(r?.delivery_radius ?? 0) > 0 },
    {
      key: "payment",
      label: "Payment details completed",
      hint: "Account number, IFSC and holder name",
      done: has(r?.bank_account) && has(r?.bank_ifsc) && has(r?.bank_holder),
    },
    { key: "owner", label: "Owner account activated", hint: "Signed-in, active owner", done: !!ctx.ownerActive },
    {
      key: "kyc",
      label: "KYC documents verified",
      hint: "FSSAI, PAN, Aadhaar, bank account and cancelled cheque",
      done: !!ctx.kycVerified,
      adminOnly: true,
    },
  ];
}

export function checklistPercent(items: ChecklistItem[]): number {
  if (!items.length) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}

export function isChecklistComplete(items: ChecklistItem[]): boolean {
  return items.every((i) => i.done);
}

/** True when the restaurant may be shown to customers. */
export function canGoLive(r: GoLiveRow | null, items: ChecklistItem[]): boolean {
  // Mandatory KYC can never be overridden — it is a compliance gate.
  const kycOk = items.find((i) => i.key === "kyc")?.done ?? false;
  if (!kycOk) return false;
  return !!r?.go_live_override || isChecklistComplete(items);
}

/** Count live menu items for a restaurant. */
export async function fetchMenuCount(restaurantId: string): Promise<number> {
  if (!restaurantId) return 0;
  const rows = await listTable<{ id: string }>("menu_items", {
    restaurant_id: `eq.${restaurantId}`,
    limit: 200,
  });
  return rows.length;
}

/** True when the owner user row exists and is active. */
export async function fetchOwnerActive(ownerId?: string | null): Promise<boolean> {
  if (!ownerId) return false;
  const rows = await listTable<{ id: string; status?: string | null }>("users", {
    id: `eq.${ownerId}`,
    limit: 1,
  });
  const u = rows[0];
  if (!u) return false;
  const s = (u.status ?? "active").toLowerCase();
  return s === "active";
}

/** Load everything needed to evaluate the checklist for one restaurant. */
export async function loadChecklistContext(r: GoLiveRow | null): Promise<ChecklistContext> {
  if (!r?.id) return { menuCount: 0, ownerActive: false, kycVerified: false };
  const [menuCount, ownerActive, kycVerified] = await Promise.all([
    fetchMenuCount(r.id),
    fetchOwnerActive(r.owner_id),
    isKycComplete(r.id),
  ]);
  return { menuCount, ownerActive, kycVerified };
}

/** Persist the live flag. Returns the patch applied. */
export async function setRestaurantLive(id: string, live: boolean) {
  const patch: Record<string, unknown> = {
    is_live: live,
    status: live ? "approved" : "pending",
    is_open: live,
  };
  if (live) patch.went_live_at = new Date().toISOString();
  await patchRecord("restaurants", id, patch);
  return patch;
}

export async function setGoLiveOverride(id: string, override: boolean) {
  await patchRecord("restaurants", id, { go_live_override: override });
}

export async function setVerificationFlag(
  id: string,
  field: "bank_verified" | "docs_verified",
  value: boolean,
) {
  await patchRecord("restaurants", id, { [field]: value });
}
