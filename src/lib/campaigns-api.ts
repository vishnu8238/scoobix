/**
 * Scoobix Campaign & Promotion Engine.
 *
 * Server-authoritative: every campaign, redemption, analytics counter and
 * audit entry lives in InsForge (`campaigns`, `campaign_redemptions`,
 * `campaign_events`, `campaign_audit_logs`). No mock data, no localStorage.
 *
 * The client only *evaluates* eligibility for display/preview — the discount
 * that is actually charged is re-derived from the stored campaign row at
 * redemption time and written back with the order.
 */
import { listTable, createRecord, patchRecord } from "./insforge-crud";

/* ------------------------------------------------------------------ types */

export type CampaignType =
  | "flat_discount"
  | "percentage_discount"
  | "free_delivery"
  | "bogo"
  | "combo"
  | "cashback"
  | "wallet_credit"
  | "restaurant_sponsored"
  | "category_offer"
  | "zone_offer"
  | "first_order"
  | "new_user"
  | "returning_customer"
  | "birthday"
  | "festival"
  | "flash_sale"
  | "happy_hour"
  | "midnight"
  | "rainy_day";

export type DiscountType = "flat" | "percent" | "free_delivery" | "cashback" | "wallet_credit" | "bogo" | "combo";

export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "expired" | "archived";

export type CustomerSegment = "all" | "new" | "returning" | "loyal" | "inactive" | "birthday";
export type MembershipTier = "none" | "plus" | "pro";
export type PaymentMethodKey = "card" | "upi" | "wallet" | "cash" | "netbanking";

export const CAMPAIGN_TYPES: {
  value: CampaignType;
  label: string;
  discount: DiscountType;
  hint: string;
}[] = [
  { value: "flat_discount", label: "Flat discount", discount: "flat", hint: "₹50 off, ₹100 off" },
  { value: "percentage_discount", label: "Percentage discount", discount: "percent", hint: "10%, 20%, 50%" },
  { value: "free_delivery", label: "Free delivery", discount: "free_delivery", hint: "Waives the delivery fee" },
  { value: "bogo", label: "Buy 1 Get 1", discount: "bogo", hint: "Cheapest eligible item free" },
  { value: "combo", label: "Combo offer", discount: "combo", hint: "Fixed price on a combo" },
  { value: "cashback", label: "Cashback", discount: "cashback", hint: "Credited after delivery" },
  { value: "wallet_credit", label: "Wallet credit", discount: "wallet_credit", hint: "Instant wallet top-up" },
  { value: "restaurant_sponsored", label: "Restaurant sponsored offer", discount: "percent", hint: "Funded by the restaurant" },
  { value: "category_offer", label: "Category offer", discount: "percent", hint: "Limited to categories" },
  { value: "zone_offer", label: "Area / zone offer", discount: "flat", hint: "Limited to delivery zones" },
  { value: "first_order", label: "First order offer", discount: "percent", hint: "Customer's very first order" },
  { value: "new_user", label: "New user offer", discount: "flat", hint: "Accounts under 30 days" },
  { value: "returning_customer", label: "Returning customer offer", discount: "percent", hint: "Win-back offer" },
  { value: "birthday", label: "Birthday offer", discount: "percent", hint: "On the customer's birthday" },
  { value: "festival", label: "Festival offer", discount: "flat", hint: "Seasonal / festival window" },
  { value: "flash_sale", label: "Flash sale", discount: "percent", hint: "Short high-intensity burst" },
  { value: "happy_hour", label: "Happy hour", discount: "percent", hint: "Runs inside an hour window" },
  { value: "midnight", label: "Midnight offer", discount: "flat", hint: "Late-night hours only" },
  { value: "rainy_day", label: "Rainy day offer", discount: "free_delivery", hint: "Enabled during rain" },
];

export const CAMPAIGN_TYPE_LABEL = Object.fromEntries(
  CAMPAIGN_TYPES.map((t) => [t.value, t.label]),
) as Record<CampaignType, string>;

export type Campaign = {
  id: string;
  name: string;
  description?: string | null;
  type: CampaignType;
  banner_url?: string | null;
  promo_code?: string | null;
  auto_apply?: boolean | null;
  status?: CampaignStatus | null;
  priority?: number | null;
  start_at?: string | null;
  end_at?: string | null;
  discount_type?: DiscountType | null;
  discount_value?: number | null;
  max_discount?: number | null;
  min_order?: number | null;
  usage_per_user?: number | null;
  total_usage_limit?: number | null;
  used_count?: number | null;
  revenue_generated?: number | null;
  discount_given?: number | null;
  impressions?: number | null;
  segments?: CustomerSegment[] | null;
  category_ids?: string[] | null;
  zone_ids?: string[] | null;
  restaurant_ids?: string[] | null;
  payment_methods?: PaymentMethodKey[] | null;
  memberships?: MembershipTier[] | null;
  config?: Record<string, unknown> | null;
  sponsored?: boolean | null;
  sponsor_restaurant_id?: string | null;
  archived?: boolean | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CampaignRedemption = {
  id: string;
  campaign_id: string;
  user_id?: string | null;
  order_id?: string | null;
  restaurant_id?: string | null;
  promo_code?: string | null;
  order_value?: number | null;
  discount_amount?: number | null;
  auto_applied?: boolean | null;
  created_at?: string;
};

export type CampaignAudit = {
  id: string;
  campaign_id?: string | null;
  actor_id?: string | null;
  actor_email?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
  created_at?: string;
};

/* ------------------------------------------------------------- read/write */

const T = "campaigns";

function arr<T2>(v: unknown): T2[] {
  if (Array.isArray(v)) return v as T2[];
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try { return JSON.parse(v) as T2[]; } catch { return []; }
  }
  return [];
}

function normalize(row: Record<string, unknown>): Campaign {
  return {
    ...(row as unknown as Campaign),
    segments: arr<CustomerSegment>(row.segments),
    category_ids: arr<string>(row.category_ids),
    zone_ids: arr<string>(row.zone_ids),
    restaurant_ids: arr<string>(row.restaurant_ids),
    payment_methods: arr<PaymentMethodKey>(row.payment_methods),
    memberships: arr<MembershipTier>(row.memberships),
    config: (row.config as Record<string, unknown>) ?? {},
  };
}

export async function listCampaigns(opts?: { includeArchived?: boolean }): Promise<Campaign[]> {
  const rows = await listTable<Record<string, unknown>>(T, { order: "-priority", limit: 500 });
  const list = rows.map(normalize);
  return opts?.includeArchived ? list : list.filter((c) => !c.archived);
}

export async function createCampaign(
  input: Partial<Campaign>,
  actor?: { id?: string; email?: string },
): Promise<Campaign | null> {
  const row = await createRecord<Record<string, unknown>>(T, stripUndefined(input));
  const created = row ? normalize(Array.isArray(row) ? row[0] : row) : null;
  await logAudit("created", created?.id, actor, { name: input.name, type: input.type });
  return created;
}

export async function updateCampaign(
  id: string,
  patch: Partial<Campaign>,
  actor?: { id?: string; email?: string },
  action = "updated",
): Promise<void> {
  await patchRecord(T, id, stripUndefined(patch));
  await logAudit(action, id, actor, patch as Record<string, unknown>);
}

export async function setCampaignStatus(
  id: string,
  status: CampaignStatus,
  actor?: { id?: string; email?: string },
) {
  return updateCampaign(id, { status }, actor, `status:${status}`);
}

export async function archiveCampaign(id: string, actor?: { id?: string; email?: string }) {
  return updateCampaign(id, { archived: true, status: "archived" }, actor, "archived");
}

export async function restoreCampaign(id: string, actor?: { id?: string; email?: string }) {
  return updateCampaign(id, { archived: false, status: "paused" }, actor, "restored");
}

export async function duplicateCampaign(c: Campaign, actor?: { id?: string; email?: string }) {
  const {
    id: _id, created_at: _ca, updated_at: _ua,
    used_count: _uc, revenue_generated: _rg, discount_given: _dg, impressions: _im,
    ...rest
  } = c;
  return createCampaign(
    {
      ...rest,
      name: `${c.name} (copy)`,
      promo_code: c.promo_code ? `${c.promo_code}2` : null,
      status: "draft",
      archived: false,
    },
    actor,
  );
}

function stripUndefined(o: Record<string, unknown> | Partial<Campaign>) {
  const out: Record<string, unknown> = {};
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined) out[k] = v; });
  return out;
}

/* ------------------------------------------------------------ audit + log */

export async function logAudit(
  action: string,
  campaignId?: string | null,
  actor?: { id?: string; email?: string },
  details?: Record<string, unknown>,
) {
  await createRecord("campaign_audit_logs", stripUndefined({
    campaign_id: campaignId ?? undefined,
    actor_id: actor?.id,
    actor_email: actor?.email,
    action,
    details: details ?? {},
  }));
}

export function listAuditLogs(campaignId?: string) {
  return listTable<CampaignAudit>("campaign_audit_logs", {
    order: "-created_at",
    limit: 200,
    ...(campaignId ? { campaign_id: `eq.${campaignId}` } : {}),
  });
}

/** Fire-and-forget impression/click tracking. */
export function trackCampaignEvent(campaignId: string, event: "impression" | "click" | "apply", userId?: string) {
  void createRecord("campaign_events", stripUndefined({ campaign_id: campaignId, event, user_id: userId }));
}

/* ------------------------------------------------------------- redemption */

export function listRedemptions(params?: { campaign_id?: string; user_id?: string }) {
  return listTable<CampaignRedemption>("campaign_redemptions", {
    order: "-created_at",
    limit: 1000,
    ...(params?.campaign_id ? { campaign_id: `eq.${params.campaign_id}` } : {}),
    ...(params?.user_id ? { user_id: `eq.${params.user_id}` } : {}),
  });
}

/**
 * Records a redemption and rolls the aggregate counters on the campaign row.
 * Counters are derived from the authoritative campaign row (read-modify-write)
 * so analytics survive client restarts.
 */
export async function redeemCampaign(input: {
  campaign: Campaign;
  userId?: string;
  orderId?: string;
  restaurantId?: string;
  orderValue: number;
  discountAmount: number;
  autoApplied?: boolean;
}) {
  const { campaign: c } = input;
  await createRecord("campaign_redemptions", stripUndefined({
    campaign_id: c.id,
    user_id: input.userId,
    order_id: input.orderId,
    restaurant_id: input.restaurantId,
    promo_code: c.promo_code ?? undefined,
    order_value: input.orderValue,
    discount_amount: input.discountAmount,
    auto_applied: !!input.autoApplied,
  }));
  await patchRecord(T, c.id, {
    used_count: (c.used_count ?? 0) + 1,
    revenue_generated: +((c.revenue_generated ?? 0) + input.orderValue).toFixed(2),
    discount_given: +((c.discount_given ?? 0) + input.discountAmount).toFixed(2),
  });
}

/* --------------------------------------------------------------- lifecycle */

/** Derives the live status from stored status + schedule window. */
export function effectiveStatus(c: Campaign, now = new Date()): CampaignStatus {
  if (c.archived) return "archived";
  const stored = (c.status ?? "draft") as CampaignStatus;
  if (stored === "draft" || stored === "paused" || stored === "archived") return stored;
  const start = c.start_at ? new Date(c.start_at) : null;
  const end = c.end_at ? new Date(c.end_at) : null;
  if (end && now > end) return "expired";
  if (start && now < start) return "scheduled";
  return "active";
}

/* -------------------------------------------------------------- evaluation */

export type CampaignContext = {
  subtotal: number;
  deliveryFee: number;
  userId?: string;
  restaurantId?: string | null;
  categoryIds?: string[];
  zoneId?: string | null;
  paymentMethod?: PaymentMethodKey;
  membership?: MembershipTier;
  /** Number of previously delivered orders for this customer. */
  orderCount?: number;
  accountAgeDays?: number;
  daysSinceLastOrder?: number;
  isBirthday?: boolean;
  isRaining?: boolean;
  /** Cheapest line item unit price — used by BOGO. */
  cheapestItemPrice?: number;
  /** Redemptions this user already has, keyed by campaign id. */
  userRedemptions?: Record<string, number>;
  now?: Date;
};

export type CampaignOutcome = {
  campaign: Campaign;
  eligible: boolean;
  reason?: string;
  /** Immediate money off the bill. */
  discount: number;
  /** Delivery fee waived. */
  freeDelivery: boolean;
  /** Post-order cashback / wallet credit. */
  cashback: number;
  walletCredit: number;
  /** discount + freeDelivery value + deferred value — used for ranking. */
  totalSaving: number;
};

function inHourWindow(now: Date, cfg: Record<string, unknown> | null | undefined) {
  const from = typeof cfg?.hour_from === "number" ? (cfg.hour_from as number) : null;
  const to = typeof cfg?.hour_to === "number" ? (cfg.hour_to as number) : null;
  if (from == null || to == null) return true;
  const h = now.getHours();
  return from <= to ? h >= from && h < to : h >= from || h < to;
}

export function evaluateCampaign(c: Campaign, ctx: CampaignContext): CampaignOutcome {
  const now = ctx.now ?? new Date();
  const fail = (reason: string): CampaignOutcome => ({
    campaign: c, eligible: false, reason, discount: 0, freeDelivery: false, cashback: 0, walletCredit: 0, totalSaving: 0,
  });

  if (effectiveStatus(c, now) !== "active") return fail("Not running right now");
  if ((c.min_order ?? 0) > ctx.subtotal) return fail(`Minimum order ₹${c.min_order}`);
  if (c.total_usage_limit && (c.used_count ?? 0) >= c.total_usage_limit) return fail("Usage limit reached");
  if (c.usage_per_user && (ctx.userRedemptions?.[c.id] ?? 0) >= c.usage_per_user) return fail("You've already used this");

  const restrict = (list: string[] | null | undefined, value: string | null | undefined, label: string) => {
    if (!list || list.length === 0) return null;
    if (!value || !list.includes(value)) return `Not valid for this ${label}`;
    return null;
  };

  const rErr = restrict(c.restaurant_ids, ctx.restaurantId ?? null, "restaurant");
  if (rErr) return fail(rErr);
  const zErr = restrict(c.zone_ids, ctx.zoneId ?? null, "area");
  if (zErr) return fail(zErr);
  if (c.category_ids?.length) {
    const hit = (ctx.categoryIds ?? []).some((id) => c.category_ids!.includes(id));
    if (!hit) return fail("Not valid for these items");
  }
  if (c.payment_methods?.length && ctx.paymentMethod && !c.payment_methods.includes(ctx.paymentMethod)) {
    return fail("Not valid for this payment method");
  }
  if (c.memberships?.length && !c.memberships.includes(ctx.membership ?? "none")) {
    return fail("Membership required");
  }

  // Segment gates
  const segs = c.segments ?? [];
  const orderCount = ctx.orderCount ?? 0;
  if (segs.length && !segs.includes("all")) {
    const matches = segs.some((s) => {
      if (s === "new") return orderCount === 0 || (ctx.accountAgeDays ?? 999) <= 30;
      if (s === "returning") return orderCount > 0;
      if (s === "loyal") return orderCount >= 10;
      if (s === "inactive") return (ctx.daysSinceLastOrder ?? 0) >= 30;
      if (s === "birthday") return !!ctx.isBirthday;
      return true;
    });
    if (!matches) return fail("Not available for your account");
  }

  // Type-specific gates
  switch (c.type) {
    case "first_order":
      if (orderCount > 0) return fail("First order only");
      break;
    case "new_user":
      if ((ctx.accountAgeDays ?? 0) > 30 && orderCount > 0) return fail("New customers only");
      break;
    case "returning_customer":
      if (orderCount === 0) return fail("Returning customers only");
      break;
    case "birthday":
      if (!ctx.isBirthday) return fail("Birthday only");
      break;
    case "rainy_day":
      if (!ctx.isRaining) return fail("Available during rain");
      break;
    case "happy_hour":
    case "midnight":
    case "flash_sale":
      if (!inHourWindow(now, c.config)) return fail("Outside offer hours");
      break;
    default:
      break;
  }

  // Value calculation
  const dtype: DiscountType = (c.discount_type ??
    CAMPAIGN_TYPES.find((t) => t.value === c.type)?.discount ??
    "flat") as DiscountType;
  const value = c.discount_value ?? 0;
  let discount = 0;
  let freeDelivery = false;
  let cashback = 0;
  let walletCredit = 0;

  switch (dtype) {
    case "flat":
      discount = value;
      break;
    case "percent":
      discount = (ctx.subtotal * value) / 100;
      break;
    case "free_delivery":
      freeDelivery = true;
      break;
    case "bogo":
      discount = ctx.cheapestItemPrice ?? 0;
      break;
    case "combo":
      discount = Math.max(0, ctx.subtotal - value);
      break;
    case "cashback":
      cashback = value <= 100 && (c.config?.cashback_is_percent as boolean) ? (ctx.subtotal * value) / 100 : value;
      break;
    case "wallet_credit":
      walletCredit = value;
      break;
  }

  if (c.max_discount && c.max_discount > 0) {
    discount = Math.min(discount, c.max_discount);
    cashback = Math.min(cashback, c.max_discount);
  }
  discount = Math.max(0, Math.min(+discount.toFixed(2), ctx.subtotal));
  cashback = +Math.max(0, cashback).toFixed(2);
  walletCredit = +Math.max(0, walletCredit).toFixed(2);

  const totalSaving = +(discount + (freeDelivery ? ctx.deliveryFee : 0) + cashback + walletCredit).toFixed(2);
  if (totalSaving <= 0) return fail("No saving on this order");

  return { campaign: c, eligible: true, discount, freeDelivery, cashback, walletCredit, totalSaving };
}

/** Every eligible campaign, best saving first (priority breaks ties). */
export function eligibleCampaigns(list: Campaign[], ctx: CampaignContext): CampaignOutcome[] {
  return list
    .map((c) => evaluateCampaign(c, ctx))
    .filter((o) => o.eligible)
    .sort(
      (a, b) =>
        b.totalSaving - a.totalSaving ||
        (b.campaign.priority ?? 0) - (a.campaign.priority ?? 0),
    );
}

/** Best auto-applicable campaign for the current cart. */
export function bestAutoCampaign(list: Campaign[], ctx: CampaignContext): CampaignOutcome | null {
  return eligibleCampaigns(list.filter((c) => c.auto_apply), ctx)[0] ?? null;
}

/** Resolve a typed promo code against the live campaign list. */
export function matchPromoCode(list: Campaign[], code: string, ctx: CampaignContext): CampaignOutcome | { error: string } {
  const clean = code.trim().toUpperCase();
  const found = list.find((c) => (c.promo_code ?? "").trim().toUpperCase() === clean);
  if (!found) return { error: "That promo code doesn't exist" };
  const out = evaluateCampaign(found, ctx);
  if (!out.eligible) return { error: out.reason ?? "Not eligible" };
  return out;
}

/* --------------------------------------------------------------- analytics */

export type CampaignAnalytics = {
  redemptions: number;
  revenue: number;
  discount: number;
  roi: number;
  conversionRate: number;
  impressions: number;
};

export function campaignAnalytics(c: Campaign, impressions?: number): CampaignAnalytics {
  const redemptions = c.used_count ?? 0;
  const revenue = c.revenue_generated ?? 0;
  const discount = c.discount_given ?? 0;
  const views = impressions ?? c.impressions ?? 0;
  return {
    redemptions,
    revenue: +revenue.toFixed(2),
    discount: +discount.toFixed(2),
    roi: discount > 0 ? +((revenue - discount) / discount).toFixed(2) : 0,
    conversionRate: views > 0 ? +((redemptions / views) * 100).toFixed(1) : 0,
    impressions: views,
  };
}

/** Impressions grouped per campaign, read from `campaign_events`. */
export async function impressionsByCampaign(): Promise<Record<string, number>> {
  const rows = await listTable<{ campaign_id: string; event: string }>("campaign_events", { limit: 5000 });
  const out: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.event !== "impression") return;
    out[r.campaign_id] = (out[r.campaign_id] ?? 0) + 1;
  });
  return out;
}
