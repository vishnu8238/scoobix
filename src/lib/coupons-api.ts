/**
 * Scoobix Enterprise Coupon & Promotion Engine.
 *
 * Server-authoritative. Every coupon, redemption, promotion campaign, rule,
 * analytics rollup and audit entry lives in InsForge:
 *
 *   coupons              — the coupon definitions (platform / restaurant / manager)
 *   coupon_usage         — one row per redemption (fraud + analytics source)
 *   promotion_campaigns  — grouped promotions (flash sale, happy hour, festival…)
 *   promotion_rules      — declarative extra rules attached to a campaign/coupon
 *   promotion_analytics  — per-day rollups per coupon/campaign
 *   coupon_audit_logs    — full audit trail of every mutation
 *   saved_coupons        — the customer coupon wallet
 *
 * No localStorage, no mock data. Evaluation reuses the campaign evaluator so a
 * coupon and a campaign rank identically inside the cart.
 */
import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";
import {
  evaluateCampaign,
  type Campaign,
  type CampaignContext,
  type CampaignOutcome,
  type CampaignType,
  type DiscountType,
  type MembershipTier,
  type PaymentMethodKey,
} from "./campaigns-api";
import { getAppSettings } from "./app-settings";

/* ------------------------------------------------------------------ types */

export type CouponScope = "platform" | "restaurant" | "manager";

export type CouponKind =
  | "platform"
  | "restaurant"
  | "manager_campaign"
  | "referral"
  | "first_order"
  | "festival"
  | "birthday"
  | "free_delivery"
  | "wallet_cashback"
  | "loyalty"
  | "scratch_card"
  | "hidden"
  | "automatic";

export const COUPON_KINDS: { value: CouponKind; label: string; hint: string }[] = [
  { value: "platform", label: "Platform coupon", hint: "Runs across every restaurant" },
  { value: "restaurant", label: "Restaurant coupon", hint: "Created by a restaurant" },
  { value: "manager_campaign", label: "Manager campaign", hint: "Merchant manager campaign" },
  { value: "referral", label: "Referral coupon", hint: "Issued by the referral engine" },
  { value: "first_order", label: "First order coupon", hint: "Customer's very first order" },
  { value: "festival", label: "Festival coupon", hint: "Seasonal window" },
  { value: "birthday", label: "Birthday coupon", hint: "On the customer's birthday" },
  { value: "free_delivery", label: "Free delivery coupon", hint: "Waives the delivery fee" },
  { value: "wallet_cashback", label: "Wallet cashback coupon", hint: "Credited after delivery" },
  { value: "loyalty", label: "Loyalty coupon", hint: "Gated by customer level" },
  { value: "scratch_card", label: "Scratch card coupon", hint: "Won from a scratch card" },
  { value: "hidden", label: "Hidden promo code", hint: "Never listed — code only" },
  { value: "automatic", label: "Automatic coupon", hint: "Applies itself, no code" },
];

export const COUPON_KIND_LABEL = Object.fromEntries(
  COUPON_KINDS.map((k) => [k.value, k.label]),
) as Record<CouponKind, string>;

export type CouponStatus = "draft" | "scheduled" | "active" | "paused" | "expired" | "archived";

export type CustomerLevel = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export type Coupon = {
  id: string;
  code: string;
  title?: string | null;
  description?: string | null;
  coupon_type?: CouponKind | null;
  scope?: CouponScope | null;
  restaurant_id?: string | null;
  manager_id?: string | null;
  campaign_id?: string | null;
  created_by?: string | null;
  created_by_role?: string | null;

  discount_type?: "flat" | "percent" | "free_delivery" | "cashback" | null;
  discount_value?: number | null;
  maximum_discount?: number | null;
  minimum_order?: number | null;

  usage_limit?: number | null;
  per_user_limit?: number | null;
  per_restaurant_limit?: number | null;
  used_count?: number | null;

  start_date?: string | null;
  end_date?: string | null;

  cities?: string[] | null;
  areas?: string[] | null;
  restaurant_ids?: string[] | null;
  category_ids?: string[] | null;
  payment_methods?: PaymentMethodKey[] | null;
  memberships?: MembershipTier[] | null;
  customer_levels?: CustomerLevel[] | null;

  auto_apply?: boolean | null;
  hidden?: boolean | null;
  stackable?: boolean | null;
  priority?: number | null;
  status?: CouponStatus | null;
  approved?: boolean | null;
  active?: boolean | null;
  archived?: boolean | null;

  revenue_generated?: number | null;
  discount_given?: number | null;
  impressions?: number | null;
  config?: Record<string, unknown> | null;

  created_at?: string;
  updated_at?: string;
};

export type CouponUsage = {
  id: string;
  coupon_id?: string | null;
  coupon_code?: string | null;
  user_id?: string | null;
  order_id?: string | null;
  restaurant_id?: string | null;
  order_value?: number | null;
  discount_amount?: number | null;
  auto_applied?: boolean | null;
  status?: string | null;
  device_id?: string | null;
  ip_hash?: string | null;
  city?: string | null;
  payment_method?: string | null;
  meta?: Record<string, unknown> | null;
  created_at?: string;
};

export type PromotionCampaign = {
  id: string;
  name?: string | null;
  description?: string | null;
  promo_type?: string | null;
  owner_role?: "admin" | "restaurant" | "manager" | null;
  owner_id?: string | null;
  restaurant_id?: string | null;
  manager_id?: string | null;
  status?: CouponStatus | null;
  start_at?: string | null;
  end_at?: string | null;
  banner_url?: string | null;
  budget?: number | null;
  spend?: number | null;
  priority?: number | null;
  cities?: string[] | null;
  coupon_ids?: string[] | null;
  config?: Record<string, unknown> | null;
  archived?: boolean | null;
  created_at?: string;
};

export type PromotionRule = {
  id: string;
  campaign_id?: string | null;
  coupon_id?: string | null;
  rule_type?: string | null;
  operator?: string | null;
  value?: string | null;
  numeric_value?: number | null;
  json_value?: Record<string, unknown> | null;
  active?: boolean | null;
};

export type CouponAudit = {
  id: string;
  coupon_id?: string | null;
  campaign_id?: string | null;
  actor_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
  created_at?: string;
};

export type SavedCoupon = {
  id: string;
  user_id?: string | null;
  coupon_id?: string | null;
  coupon_code?: string | null;
  source?: string | null;
  saved_at?: string | null;
};

export type Actor = { id?: string; email?: string; role?: string };

export const PROMOTION_TYPES = [
  { value: "flash_sale", label: "Flash sale" },
  { value: "happy_hour", label: "Happy hour" },
  { value: "lunch", label: "Lunch offer" },
  { value: "midnight", label: "Midnight offer" },
  { value: "weekend", label: "Weekend offer" },
  { value: "festival", label: "Festival campaign" },
  { value: "city", label: "City campaign" },
  { value: "restaurant", label: "Restaurant campaign" },
  { value: "combo", label: "Combo offer" },
  { value: "bxgy", label: "Buy X Get Y" },
] as const;

/* -------------------------------------------------------------- utilities */

const T = "coupons";
const T_USAGE = "coupon_usage";
const T_PROMO = "promotion_campaigns";
const T_RULES = "promotion_rules";
const T_ANALYTICS = "promotion_analytics";
const T_AUDIT = "coupon_audit_logs";
const T_SAVED = "saved_coupons";

function arr<T2>(v: unknown): T2[] {
  if (Array.isArray(v)) return v as T2[];
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? (p as T2[]) : [];
    } catch {
      return [];
    }
  }
  if (typeof v === "string" && v.trim()) return v.split(",").map((s) => s.trim()) as unknown as T2[];
  return [];
}

function obj(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string" && v.trim().startsWith("{")) {
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function stripUndefined<T2 extends object>(o: T2): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(o).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return out;
}

function normalize(row: Record<string, unknown>): Coupon {
  return {
    ...(row as unknown as Coupon),
    cities: arr<string>(row.cities),
    areas: arr<string>(row.areas),
    restaurant_ids: arr<string>(row.restaurant_ids),
    category_ids: arr<string>(row.category_ids),
    payment_methods: arr<PaymentMethodKey>(row.payment_methods),
    memberships: arr<MembershipTier>(row.memberships),
    customer_levels: arr<CustomerLevel>(row.customer_levels),
    config: obj(row.config),
  };
}

/** Live status derived from stored status + schedule window + flags. */
export function couponStatus(c: Coupon, now = new Date()): CouponStatus {
  if (c.archived) return "archived";
  const stored = (c.status ?? (c.active === false ? "paused" : "active")) as CouponStatus;
  if (stored === "draft" || stored === "paused" || stored === "archived") return stored;
  if (c.active === false) return "paused";
  const start = c.start_date ? new Date(c.start_date) : null;
  const end = c.end_date ? new Date(c.end_date) : null;
  if (end && !isNaN(end.getTime()) && now > end) return "expired";
  if (start && !isNaN(start.getTime()) && now < start) return "scheduled";
  return "active";
}

/* ----------------------------------------------------------------- reads */

export async function listCoupons(params?: {
  restaurantId?: string;
  managerId?: string;
  scope?: CouponScope;
  includeArchived?: boolean;
  limit?: number;
}): Promise<Coupon[]> {
  const rows = await listTable<Record<string, unknown>>(T, {
    order: "-created_at",
    limit: params?.limit ?? 200,
    ...(params?.restaurantId ? { restaurant_id: `eq.${params.restaurantId}` } : {}),
    ...(params?.managerId ? { manager_id: `eq.${params.managerId}` } : {}),
    ...(params?.scope ? { scope: `eq.${params.scope}` } : {}),
  });
  const list = rows.map(normalize);
  return params?.includeArchived ? list : list.filter((c) => !c.archived);
}

/** Coupons a customer could actually be offered right now (pre-cart filter). */
export async function listRedeemableCoupons(): Promise<Coupon[]> {
  const list = await listCoupons({ limit: 200 });
  return list.filter((c) => couponStatus(c) === "active" && c.approved !== false);
}

export function listCouponUsage(params?: {
  coupon_id?: string;
  user_id?: string;
  restaurant_id?: string;
  limit?: number;
}) {
  return listTable<CouponUsage>(T_USAGE, {
    order: "-created_at",
    limit: params?.limit ?? 200,
    ...(params?.coupon_id ? { coupon_id: `eq.${params.coupon_id}` } : {}),
    ...(params?.user_id ? { user_id: `eq.${params.user_id}` } : {}),
    ...(params?.restaurant_id ? { restaurant_id: `eq.${params.restaurant_id}` } : {}),
  });
}

/* ---------------------------------------------------------------- writes */

export async function logCouponAudit(
  action: string,
  ids: { couponId?: string | null; campaignId?: string | null },
  actor?: Actor,
  details?: Record<string, unknown>,
) {
  await createRecord(
    T_AUDIT,
    stripUndefined({
      coupon_id: ids.couponId ?? undefined,
      campaign_id: ids.campaignId ?? undefined,
      actor_id: actor?.id,
      actor_email: actor?.email,
      actor_role: actor?.role,
      action,
      details: details ?? {},
    }),
  );
}

export function listCouponAudit(couponId?: string) {
  return listTable<CouponAudit>(T_AUDIT, {
    order: "-created_at",
    limit: 200,
    ...(couponId ? { coupon_id: `eq.${couponId}` } : {}),
  });
}

/** Governance limits an admin sets once; restaurants cannot exceed them. */
export function couponLimits() {
  const s = getAppSettings();
  return {
    maxPercent: s.coupon_max_percent ?? 50,
    maxFlat: s.coupon_max_flat ?? 300,
    maxDiscountCap: s.coupon_max_discount_cap ?? 500,
    requireApproval: s.coupon_require_approval !== false,
  };
}

/** Clamps a restaurant/manager coupon to the admin-defined ceiling. */
export function clampToLimits(input: Partial<Coupon>): { patch: Partial<Coupon>; notes: string[] } {
  const lim = couponLimits();
  const notes: string[] = [];
  const patch: Partial<Coupon> = { ...input };
  if (patch.discount_type === "percent" && (patch.discount_value ?? 0) > lim.maxPercent) {
    patch.discount_value = lim.maxPercent;
    notes.push(`Discount capped at ${lim.maxPercent}%`);
  }
  if (patch.discount_type === "flat" && (patch.discount_value ?? 0) > lim.maxFlat) {
    patch.discount_value = lim.maxFlat;
    notes.push(`Flat discount capped at ₹${lim.maxFlat}`);
  }
  if ((patch.maximum_discount ?? 0) > lim.maxDiscountCap) {
    patch.maximum_discount = lim.maxDiscountCap;
    notes.push(`Max discount capped at ₹${lim.maxDiscountCap}`);
  }
  return { patch, notes };
}

export async function createCoupon(input: Partial<Coupon>, actor?: Actor): Promise<Coupon | null> {
  const payload = stripUndefined({
    status: "active",
    used_count: 0,
    revenue_generated: 0,
    discount_given: 0,
    impressions: 0,
    archived: false,
    active: true,
    ...input,
    code: (input.code ?? "").trim().toUpperCase(),
    created_by: input.created_by ?? actor?.id,
    created_by_role: input.created_by_role ?? actor?.role,
  });
  const row = await createRecord<Record<string, unknown>>(T, payload);
  const created = row ? normalize(Array.isArray(row) ? row[0] : row) : null;
  await logCouponAudit("coupon:created", { couponId: created?.id }, actor, {
    code: payload.code,
    type: input.coupon_type,
  });
  return created;
}

export async function updateCoupon(
  id: string,
  patch: Partial<Coupon>,
  actor?: Actor,
  action = "coupon:updated",
): Promise<void> {
  await patchRecord(T, id, stripUndefined({ ...patch, updated_at: new Date().toISOString() }));
  await logCouponAudit(action, { couponId: id }, actor, patch as Record<string, unknown>);
}

export function setCouponStatus(id: string, status: CouponStatus, actor?: Actor) {
  return updateCoupon(
    id,
    { status, active: status === "active" },
    actor,
    `coupon:${status}`,
  );
}

export async function removeCoupon(id: string, actor?: Actor) {
  await deleteRecord(T, id);
  await logCouponAudit("coupon:deleted", { couponId: id }, actor);
}

export async function archiveCoupon(id: string, actor?: Actor) {
  return updateCoupon(id, { archived: true, status: "archived", active: false }, actor, "coupon:archived");
}

export async function duplicateCoupon(c: Coupon, actor?: Actor) {
  const {
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    used_count: _uc,
    revenue_generated: _rg,
    discount_given: _dg,
    impressions: _im,
    ...rest
  } = c;
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return createCoupon(
    { ...rest, code: `${c.code}${suffix}`, title: `${c.title ?? c.code} (copy)`, status: "draft", active: false, archived: false },
    actor,
  );
}

export function scheduleCoupon(id: string, startISO: string, endISO: string | null, actor?: Actor) {
  return updateCoupon(
    id,
    { start_date: startISO, end_date: endISO, status: "scheduled", active: true },
    actor,
    "coupon:scheduled",
  );
}

/* -------------------------------------------------- promotion campaigns */

export async function listPromotions(params?: {
  restaurantId?: string;
  managerId?: string;
  includeArchived?: boolean;
}): Promise<PromotionCampaign[]> {
  const rows = await listTable<Record<string, unknown>>(T_PROMO, {
    order: "-created_at",
    limit: 200,
    ...(params?.restaurantId ? { restaurant_id: `eq.${params.restaurantId}` } : {}),
    ...(params?.managerId ? { manager_id: `eq.${params.managerId}` } : {}),
  });
  const list = rows.map((r) => ({
    ...(r as unknown as PromotionCampaign),
    cities: arr<string>(r.cities),
    coupon_ids: arr<string>(r.coupon_ids),
    config: obj(r.config),
  }));
  return params?.includeArchived ? list : list.filter((p) => !p.archived);
}

export async function createPromotion(input: Partial<PromotionCampaign>, actor?: Actor) {
  const row = await createRecord<Record<string, unknown>>(
    T_PROMO,
    stripUndefined({ status: "active", spend: 0, archived: false, ...input }),
  );
  const created = row ? (Array.isArray(row) ? row[0] : row) : null;
  await logCouponAudit("promotion:created", { campaignId: (created as { id?: string } | null)?.id }, actor, {
    name: input.name,
  });
  return created as PromotionCampaign | null;
}

export async function updatePromotion(id: string, patch: Partial<PromotionCampaign>, actor?: Actor) {
  await patchRecord(T_PROMO, id, stripUndefined({ ...patch, updated_at: new Date().toISOString() }));
  await logCouponAudit("promotion:updated", { campaignId: id }, actor, patch as Record<string, unknown>);
}

export async function deletePromotion(id: string, actor?: Actor) {
  await deleteRecord(T_PROMO, id);
  await logCouponAudit("promotion:deleted", { campaignId: id }, actor);
}

export function listPromotionRules(campaignId?: string, couponId?: string) {
  return listTable<PromotionRule>(T_RULES, {
    limit: 200,
    ...(campaignId ? { campaign_id: `eq.${campaignId}` } : {}),
    ...(couponId ? { coupon_id: `eq.${couponId}` } : {}),
  });
}

export function addPromotionRule(rule: Partial<PromotionRule>) {
  return createRecord(T_RULES, stripUndefined({ active: true, ...rule }));
}

export function deletePromotionRule(id: string) {
  return deleteRecord(T_RULES, id);
}

/* ---------------------------------------------------- coupon → campaign */

const KIND_TO_CAMPAIGN_TYPE: Record<CouponKind, CampaignType> = {
  platform: "flat_discount",
  restaurant: "restaurant_sponsored",
  manager_campaign: "flat_discount",
  referral: "flat_discount",
  first_order: "first_order",
  festival: "festival",
  birthday: "birthday",
  free_delivery: "free_delivery",
  wallet_cashback: "cashback",
  loyalty: "returning_customer",
  scratch_card: "flat_discount",
  hidden: "flat_discount",
  automatic: "flat_discount",
};

/**
 * Projects a coupon row onto the campaign shape so the existing cart
 * evaluator ranks coupons and campaigns in one pool. The synthetic campaign
 * keeps the coupon id so redemption can be routed back to `coupon_usage`.
 */
export function couponToCampaign(c: Coupon): Campaign {
  const kind = (c.coupon_type ?? "platform") as CouponKind;
  const dtype: DiscountType =
    c.discount_type === "percent"
      ? "percent"
      : c.discount_type === "free_delivery"
        ? "free_delivery"
        : c.discount_type === "cashback"
          ? "cashback"
          : "flat";
  const status = couponStatus(c);
  return {
    id: c.id,
    name: c.title || c.code,
    description: c.description ?? null,
    type: KIND_TO_CAMPAIGN_TYPE[kind] ?? "flat_discount",
    promo_code: c.code,
    auto_apply: !!c.auto_apply || kind === "automatic",
    status: status === "archived" ? "archived" : status,
    priority: c.priority ?? 0,
    start_at: c.start_date ?? null,
    end_at: c.end_date ?? null,
    discount_type: dtype,
    discount_value: c.discount_value ?? 0,
    max_discount: c.maximum_discount ?? null,
    min_order: c.minimum_order ?? 0,
    usage_per_user: c.per_user_limit ?? null,
    total_usage_limit: c.usage_limit ?? null,
    used_count: c.used_count ?? 0,
    revenue_generated: c.revenue_generated ?? 0,
    discount_given: c.discount_given ?? 0,
    impressions: c.impressions ?? 0,
    segments: null,
    category_ids: c.category_ids?.length ? c.category_ids : null,
    zone_ids: c.areas?.length ? c.areas : null,
    restaurant_ids: c.restaurant_id
      ? [c.restaurant_id]
      : c.restaurant_ids?.length
        ? c.restaurant_ids
        : null,
    payment_methods: c.payment_methods?.length ? c.payment_methods : null,
    memberships: c.memberships?.length ? c.memberships : null,
    config: { ...(c.config ?? {}), __coupon_id: c.id, __coupon_kind: kind, __hidden: !!c.hidden },
    archived: !!c.archived,
    created_at: c.created_at,
  };
}

/** True when a campaign object in the cart pool actually came from a coupon. */
export function campaignCouponId(c: Campaign): string | null {
  const v = (c.config as Record<string, unknown> | undefined)?.__coupon_id;
  return typeof v === "string" ? v : null;
}

export function isHiddenCampaign(c: Campaign): boolean {
  return !!(c.config as Record<string, unknown> | undefined)?.__hidden;
}

/* ------------------------------------------------------------ validation */

export type CouponValidationContext = CampaignContext & {
  city?: string | null;
  customerLevel?: CustomerLevel | null;
  /** Times this user already redeemed the coupon. */
  userUsage?: number;
  /** Times this coupon was redeemed at this restaurant. */
  restaurantUsage?: number;
  /** Distinct accounts sharing this device — abuse signal. */
  deviceAccountCount?: number;
  /** Referral coupons cannot stack with another referral reward. */
  referralAlreadyApplied?: boolean;
};

export type CouponValidation =
  | { ok: true; outcome: CampaignOutcome; coupon: Coupon }
  | { ok: false; reason: string; coupon: Coupon };

/**
 * Full server-rule validation of a coupon against a cart. Runs the shared
 * campaign evaluator first, then the coupon-only gates (approval, city,
 * customer level, per-restaurant limit, abuse signals).
 */
export function validateCoupon(c: Coupon, ctx: CouponValidationContext): CouponValidation {
  const fail = (reason: string): CouponValidation => ({ ok: false, reason, coupon: c });
  const status = couponStatus(c, ctx.now);
  if (status !== "active") {
    return fail(
      status === "expired"
        ? "This coupon has expired"
        : status === "scheduled"
          ? "This coupon hasn't started yet"
          : "This coupon isn't running right now",
    );
  }
  if (c.approved === false) return fail("Coupon is pending approval");
  if (c.usage_limit && (c.used_count ?? 0) >= c.usage_limit) return fail("Usage limit reached");
  if (c.per_user_limit && (ctx.userUsage ?? 0) >= c.per_user_limit) return fail("You've already used this coupon");
  if (c.per_restaurant_limit && (ctx.restaurantUsage ?? 0) >= c.per_restaurant_limit) {
    return fail("Limit reached for this restaurant");
  }
  if (c.cities?.length && ctx.city && !c.cities.includes(ctx.city)) return fail("Not available in your city");
  if (c.customer_levels?.length && !c.customer_levels.includes((ctx.customerLevel ?? "bronze") as CustomerLevel)) {
    return fail("Not available for your loyalty level");
  }
  if (c.coupon_type === "first_order" && (ctx.orderCount ?? 0) > 0) return fail("First order only");
  if (c.coupon_type === "birthday" && !ctx.isBirthday) return fail("Birthday offer only");
  if (c.coupon_type === "referral" && ctx.referralAlreadyApplied) return fail("A referral reward is already applied");
  if ((ctx.deviceAccountCount ?? 0) > 3) return fail("Too many accounts on this device");

  const outcome = evaluateCampaign(couponToCampaign(c), {
    ...ctx,
    userRedemptions: { ...(ctx.userRedemptions ?? {}), [c.id]: ctx.userUsage ?? 0 },
  });
  if (!outcome.eligible) return fail(outcome.reason ?? "Not eligible");
  return { ok: true, outcome, coupon: c };
}

/** Every valid coupon for this cart, best saving first. */
export function eligibleCoupons(list: Coupon[], ctx: CouponValidationContext) {
  return list
    .map((c) => validateCoupon(c, { ...ctx, userUsage: ctx.userRedemptions?.[c.id] ?? ctx.userUsage }))
    .filter((r): r is Extract<CouponValidation, { ok: true }> => r.ok)
    .sort((a, b) => b.outcome.totalSaving - a.outcome.totalSaving || (b.coupon.priority ?? 0) - (a.coupon.priority ?? 0));
}

/** Best auto-applicable coupon, plus the alternatives for comparison. */
export function bestCoupon(list: Coupon[], ctx: CouponValidationContext) {
  const all = eligibleCoupons(list, ctx);
  const visible = all.filter((r) => !r.coupon.hidden);
  const best = visible.find((r) => r.coupon.auto_apply || r.coupon.coupon_type === "automatic") ?? visible[0] ?? null;
  return { best, alternatives: visible.filter((r) => r !== best).slice(0, 5) };
}

/* ------------------------------------------------------------ redemption */

/**
 * Records a redemption: writes `coupon_usage`, rolls the coupon counters and
 * updates the per-day `promotion_analytics` bucket. All server-side state —
 * nothing is trusted from a previous client session.
 */
export async function recordCouponUsage(input: {
  coupon: Coupon;
  userId?: string;
  orderId?: string;
  restaurantId?: string;
  orderValue: number;
  discountAmount: number;
  autoApplied?: boolean;
  paymentMethod?: string;
  city?: string;
  isNewCustomer?: boolean;
}) {
  const { coupon: c } = input;
  await createRecord(
    T_USAGE,
    stripUndefined({
      coupon_id: c.id,
      coupon_code: c.code,
      user_id: input.userId,
      order_id: input.orderId,
      restaurant_id: input.restaurantId,
      order_value: input.orderValue,
      discount_amount: input.discountAmount,
      auto_applied: !!input.autoApplied,
      status: "applied",
      payment_method: input.paymentMethod,
      city: input.city,
      device_id: deviceId(),
    }),
  );
  await patchRecord(T, c.id, {
    used_count: (c.used_count ?? 0) + 1,
    revenue_generated: +((c.revenue_generated ?? 0) + input.orderValue).toFixed(2),
    discount_given: +((c.discount_given ?? 0) + input.discountAmount).toFixed(2),
  });
  await rollupDaily({
    couponId: c.id,
    campaignId: c.campaign_id ?? null,
    restaurantId: input.restaurantId,
    redemptions: 1,
    revenue: input.orderValue,
    discount: input.discountAmount,
    newCustomers: input.isNewCustomer ? 1 : 0,
    repeatCustomers: input.isNewCustomer ? 0 : 1,
  });
}

/** Stable per-browser id used only as an abuse signal, never as identity. */
export function deviceId(): string {
  if (typeof window === "undefined") return "server";
  const KEY = "scoobix_device_id";
  let v = window.localStorage.getItem(KEY);
  if (!v) {
    v = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY, v);
  }
  return v;
}

/* ------------------------------------------------------------- analytics */

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function rollupDaily(input: {
  couponId: string;
  campaignId?: string | null;
  restaurantId?: string;
  impressions?: number;
  clicks?: number;
  redemptions?: number;
  revenue?: number;
  discount?: number;
  newCustomers?: number;
  repeatCustomers?: number;
}) {
  const day = today();
  const existing = await listTable<Record<string, unknown>>(T_ANALYTICS, {
    coupon_id: `eq.${input.couponId}`,
    day: `eq.${day}`,
    limit: 1,
  }, { fresh: true });
  const row = existing[0] as (Record<string, unknown> & { id?: string }) | undefined;
  const merged = {
    coupon_id: input.couponId,
    campaign_id: input.campaignId ?? undefined,
    restaurant_id: input.restaurantId,
    day,
    impressions: Number(row?.impressions ?? 0) + (input.impressions ?? 0),
    clicks: Number(row?.clicks ?? 0) + (input.clicks ?? 0),
    redemptions: Number(row?.redemptions ?? 0) + (input.redemptions ?? 0),
    revenue: +(Number(row?.revenue ?? 0) + (input.revenue ?? 0)).toFixed(2),
    discount: +(Number(row?.discount ?? 0) + (input.discount ?? 0)).toFixed(2),
    new_customers: Number(row?.new_customers ?? 0) + (input.newCustomers ?? 0),
    repeat_customers: Number(row?.repeat_customers ?? 0) + (input.repeatCustomers ?? 0),
  };
  if (row?.id) await patchRecord(T_ANALYTICS, String(row.id), merged);
  else await createRecord(T_ANALYTICS, stripUndefined(merged));
}

/** Fire-and-forget impression / click tracking (also rolled into analytics). */
export function trackCouponEvent(coupon: Coupon, event: "impression" | "click") {
  void rollupDaily({
    couponId: coupon.id,
    campaignId: coupon.campaign_id ?? null,
    impressions: event === "impression" ? 1 : 0,
    clicks: event === "click" ? 1 : 0,
  });
}

export function listPromotionAnalytics(params?: { coupon_id?: string; campaign_id?: string; restaurant_id?: string }) {
  return listTable<Record<string, unknown>>(T_ANALYTICS, {
    order: "-day",
    limit: 200,
    ...(params?.coupon_id ? { coupon_id: `eq.${params.coupon_id}` } : {}),
    ...(params?.campaign_id ? { campaign_id: `eq.${params.campaign_id}` } : {}),
    ...(params?.restaurant_id ? { restaurant_id: `eq.${params.restaurant_id}` } : {}),
  });
}

export type CouponStats = {
  redemptions: number;
  revenue: number;
  discount: number;
  roi: number;
  conversionRate: number;
  repeatOrders: number;
  newCustomers: number;
  uniqueCustomers: number;
  avgOrderValue: number;
};

/** Derives the full performance picture for one coupon from its usage rows. */
export function couponStats(c: Coupon, usage: CouponUsage[]): CouponStats {
  const rows = usage.filter((u) => u.coupon_id === c.id);
  const revenue = rows.reduce((s, u) => s + (u.order_value ?? 0), 0);
  const discount = rows.reduce((s, u) => s + (u.discount_amount ?? 0), 0);
  const byUser = new Map<string, number>();
  rows.forEach((u) => {
    const k = u.user_id ?? "guest";
    byUser.set(k, (byUser.get(k) ?? 0) + 1);
  });
  const repeatOrders = [...byUser.values()].filter((n) => n > 1).reduce((s, n) => s + (n - 1), 0);
  const impressions = c.impressions ?? 0;
  return {
    redemptions: rows.length || (c.used_count ?? 0),
    revenue: +revenue.toFixed(2),
    discount: +discount.toFixed(2),
    roi: discount > 0 ? +((revenue - discount) / discount).toFixed(2) : 0,
    conversionRate: impressions > 0 ? +((rows.length / impressions) * 100).toFixed(1) : 0,
    repeatOrders,
    newCustomers: [...byUser.values()].filter((n) => n === 1).length,
    uniqueCustomers: byUser.size,
    avgOrderValue: rows.length ? +(revenue / rows.length).toFixed(2) : 0,
  };
}

/* ------------------------------------------------------- fraud detection */

export type FraudSignal = {
  key: string;
  severity: "low" | "medium" | "high";
  label: string;
  detail: string;
  count: number;
};

/**
 * Pure derivation over `coupon_usage`. Flags the four abuse patterns the
 * platform cares about: repeat abuse, multi-account devices, referral
 * stacking, and coupon-code sharing bursts.
 */
export function fraudSignals(usage: CouponUsage[], coupons: Coupon[] = []): FraudSignal[] {
  const out: FraudSignal[] = [];
  const byCoupon = new Map<string, Coupon>();
  coupons.forEach((c) => byCoupon.set(c.id, c));

  // 1. Same user redeeming the same coupon beyond its per-user limit.
  const userCoupon = new Map<string, number>();
  usage.forEach((u) => {
    const k = `${u.user_id ?? "guest"}|${u.coupon_id}`;
    userCoupon.set(k, (userCoupon.get(k) ?? 0) + 1);
  });
  const overuse = [...userCoupon.entries()].filter(([k, n]) => {
    const couponId = k.split("|")[1];
    const limit = byCoupon.get(couponId)?.per_user_limit ?? 1;
    return n > limit;
  });
  if (overuse.length) {
    out.push({
      key: "per_user_overuse",
      severity: "high",
      label: "Per-user limit exceeded",
      detail: `${overuse.length} account/coupon pairs redeemed more times than allowed`,
      count: overuse.length,
    });
  }

  // 2. Multiple accounts sharing one device.
  const deviceUsers = new Map<string, Set<string>>();
  usage.forEach((u) => {
    if (!u.device_id) return;
    const set = deviceUsers.get(u.device_id) ?? new Set<string>();
    set.add(u.user_id ?? "guest");
    deviceUsers.set(u.device_id, set);
  });
  const multiAccount = [...deviceUsers.values()].filter((s) => s.size > 2).length;
  if (multiAccount) {
    out.push({
      key: "multi_account_device",
      severity: "high",
      label: "Multi-account devices",
      detail: `${multiAccount} devices used by 3+ different accounts`,
      count: multiAccount,
    });
  }

  // 3. Referral stacking — several referral coupons on one account.
  const referralByUser = new Map<string, number>();
  usage.forEach((u) => {
    const kind = byCoupon.get(u.coupon_id ?? "")?.coupon_type;
    if (kind !== "referral") return;
    const k = u.user_id ?? "guest";
    referralByUser.set(k, (referralByUser.get(k) ?? 0) + 1);
  });
  const stacked = [...referralByUser.values()].filter((n) => n > 1).length;
  if (stacked) {
    out.push({
      key: "referral_stacking",
      severity: "medium",
      label: "Referral stacking",
      detail: `${stacked} accounts redeemed more than one referral coupon`,
      count: stacked,
    });
  }

  // 4. Burst usage of a single code in one day (code leak / sharing).
  const byCodeDay = new Map<string, number>();
  usage.forEach((u) => {
    const day = (u.created_at ?? "").slice(0, 10);
    if (!day) return;
    const k = `${u.coupon_code ?? u.coupon_id}|${day}`;
    byCodeDay.set(k, (byCodeDay.get(k) ?? 0) + 1);
  });
  const bursts = [...byCodeDay.values()].filter((n) => n >= 50).length;
  if (bursts) {
    out.push({
      key: "code_burst",
      severity: "medium",
      label: "Unusual redemption burst",
      detail: `${bursts} code/day buckets crossed 50 redemptions`,
      count: bursts,
    });
  }

  return out;
}

/* ----------------------------------------------------- bulk import/export */

const CSV_COLUMNS = [
  "code",
  "title",
  "coupon_type",
  "scope",
  "discount_type",
  "discount_value",
  "minimum_order",
  "maximum_discount",
  "usage_limit",
  "per_user_limit",
  "start_date",
  "end_date",
  "auto_apply",
  "hidden",
  "status",
] as const;

export function couponsToCsv(rows: Coupon[]): string {
  const head = CSV_COLUMNS.join(",");
  const body = rows
    .map((r) =>
      CSV_COLUMNS.map((col) => {
        const v = (r as Record<string, unknown>)[col];
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","),
    )
    .join("\n");
  return `${head}\n${body}`;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseCouponsCsv(text: string): Partial<Coupon>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    header.forEach((h, i) => {
      const raw = (cells[i] ?? "").trim();
      if (!raw) return;
      if (["discount_value", "minimum_order", "maximum_discount"].includes(h)) row[h] = Number(raw) || 0;
      else if (["usage_limit", "per_user_limit", "priority"].includes(h)) row[h] = parseInt(raw, 10) || null;
      else if (["auto_apply", "hidden", "active", "approved"].includes(h)) row[h] = raw.toLowerCase() === "true";
      else if (h === "code") row[h] = raw.toUpperCase();
      else row[h] = raw;
    });
    return row as Partial<Coupon>;
  });
}

/** Imports a CSV batch, skipping duplicates against the live code list. */
export async function bulkImportCoupons(text: string, actor?: Actor) {
  const parsed = parseCouponsCsv(text).filter((r) => !!r.code);
  const existing = await listCoupons({ includeArchived: true, limit: 200 });
  const taken = new Set(existing.map((c) => c.code.toUpperCase()));
  let created = 0;
  let skipped = 0;
  for (const row of parsed) {
    const code = String(row.code).toUpperCase();
    if (taken.has(code)) { skipped++; continue; }
    const made = await createCoupon({ scope: "platform", coupon_type: "platform", ...row, code }, actor);
    if (made) { created++; taken.add(code); } else skipped++;
  }
  await logCouponAudit("coupon:bulk_import", {}, actor, { created, skipped });
  return { created, skipped, total: parsed.length };
}

/* ---------------------------------------------------------- coupon wallet */

export function listSavedCoupons(userId: string) {
  return listTable<SavedCoupon>(T_SAVED, { user_id: `eq.${userId}`, order: "-saved_at", limit: 200 });
}

export async function saveCoupon(userId: string, c: Coupon, source = "wallet") {
  const existing = await listTable<SavedCoupon>(T_SAVED, {
    user_id: `eq.${userId}`,
    coupon_id: `eq.${c.id}`,
    limit: 1,
  });
  if (existing.length) return existing[0];
  return createRecord<SavedCoupon>(T_SAVED, {
    user_id: userId,
    coupon_id: c.id,
    coupon_code: c.code,
    source,
    saved_at: new Date().toISOString(),
  });
}

export function unsaveCoupon(id: string) {
  return deleteRecord(T_SAVED, id);
}

/** Recommendation ranking used by the customer coupon wallet. */
export function recommendCoupons(list: Coupon[], usage: CouponUsage[], limit = 5): Coupon[] {
  const usedIds = new Set(usage.map((u) => u.coupon_id));
  return list
    .filter((c) => couponStatus(c) === "active" && !c.hidden && !usedIds.has(c.id))
    .sort((a, b) => {
      const av = a.discount_type === "percent" ? (a.discount_value ?? 0) * 3 : a.discount_value ?? 0;
      const bv = b.discount_type === "percent" ? (b.discount_value ?? 0) * 3 : b.discount_value ?? 0;
      return bv - av || (b.priority ?? 0) - (a.priority ?? 0);
    })
    .slice(0, limit);
}
