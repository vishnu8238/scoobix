/**
 * Scoobix Subscription & Membership Engine.
 *
 * Server-authoritative. Every plan, subscription, invoice, usage counter,
 * benefit, rider incentive and merchant target lives in InsForge:
 *
 *   subscription_plans     — plan catalogue for every audience
 *   subscriptions          — one row per active/past subscription
 *   subscription_history   — immutable audit trail of every state change
 *   subscription_invoices  — billing documents (checksum protected)
 *   subscription_usage     — per-period benefit/quota counters
 *   membership_benefits    — per-plan benefit overrides
 *   rider_incentives       — rider bonus ledger
 *   merchant_targets       — merchant-manager targets, commission and bonus
 *
 * No localStorage business logic. No mock data.
 */
import { useCallback, useEffect, useState } from "react";
import {
  listTable, createRecord, patchRecord, deleteRecord, invalidateTable,
} from "./insforge-crud";
import { queueNotification } from "./notifications-queue";
import { useTableVersion } from "./realtime-hooks";

/* -------------------------------------------------------------- types */

export type Audience = "customer" | "restaurant" | "manager" | "rider";
export type BillingPeriod = "none" | "monthly" | "quarterly" | "yearly" | "custom";
export type PlanStatus = "draft" | "active" | "paused" | "scheduled" | "archived";
export type SubStatus =
  | "trialing" | "active" | "past_due" | "cancelled" | "expired" | "paused";

/** Benefit map stored on `subscription_plans.benefits`. */
export type BenefitMap = Record<string, number | boolean | string>;
/** Quota map stored on `subscription_plans.limits`. */
export type LimitMap = Record<string, number>;

export type Plan = {
  id: string;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  audience?: Audience | null;
  tier?: string | null;
  billing_period?: BillingPeriod | null;
  price?: number | null;
  monthly_fee?: number | null;
  compare_price?: number | null;
  trial_days?: number | null;
  status?: PlanStatus | null;
  active?: boolean | null;
  promotional?: boolean | null;
  sort_order?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  benefits?: BenefitMap | null;
  limits?: LimitMap | null;
  commission_percent?: number | null;
  delivery_benefits?: string | null;
  cloned_from?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Subscription = {
  id: string;
  subject_type?: Audience | null;
  subject_id?: string | null;
  plan_id?: string | null;
  plan_code?: string | null;
  status?: SubStatus | null;
  price?: number | null;
  billing_period?: BillingPeriod | null;
  auto_renew?: boolean | null;
  started_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  renewal_date?: string | null;
  trial_end?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  source?: string | null;
  assigned_by?: string | null;
  savings_total?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SubscriptionEvent = {
  id: string;
  subscription_id?: string | null;
  subject_type?: Audience | null;
  subject_id?: string | null;
  action?: string | null;
  from_plan?: string | null;
  to_plan?: string | null;
  amount?: number | null;
  actor_id?: string | null;
  actor_role?: string | null;
  note?: string | null;
  created_at?: string | null;
};

export type Invoice = {
  id: string;
  invoice_no?: string | null;
  subscription_id?: string | null;
  subject_type?: Audience | null;
  subject_id?: string | null;
  plan_id?: string | null;
  plan_name?: string | null;
  amount?: number | null;
  tax?: number | null;
  total?: number | null;
  currency?: string | null;
  status?: "paid" | "due" | "failed" | "refunded" | null;
  period_start?: string | null;
  period_end?: string | null;
  paid_at?: string | null;
  payment_method?: string | null;
  payment_id?: string | null;
  checksum?: string | null;
  created_at?: string | null;
};

export type UsageRow = {
  id: string;
  subscription_id?: string | null;
  subject_type?: Audience | null;
  subject_id?: string | null;
  metric?: string | null;
  period?: string | null;
  used?: number | null;
  quota?: number | null;
  value_saved?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type MembershipBenefit = {
  id: string;
  plan_id?: string | null;
  key?: string | null;
  label?: string | null;
  description?: string | null;
  value?: number | null;
  unit?: string | null;
  enabled?: boolean | null;
  sort_order?: number | null;
};

export type RiderIncentive = {
  id: string;
  driver_id?: string | null;
  plan_id?: string | null;
  type?: string | null;
  period?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  target?: number | null;
  achieved?: number | null;
  amount?: number | null;
  status?: "pending" | "approved" | "paid" | "rejected" | null;
  orders_completed?: number | null;
  acceptance_rate?: number | null;
  completion_rate?: number | null;
  online_hours?: number | null;
  notes?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
};

export type MerchantTarget = {
  id: string;
  manager_id?: string | null;
  plan_id?: string | null;
  period?: string | null;
  region?: string | null;
  target?: number | null;
  achieved?: number | null;
  assigned_restaurants?: number | null;
  live_restaurants?: number | null;
  commission?: number | null;
  bonus?: number | null;
  growth_percent?: number | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export type Actor = { id?: string | null; email?: string | null; role?: string | null };

/* ------------------------------------------------------------ catalogue */

/** Customer membership benefit keys, in display order. */
export const BENEFIT_KEYS = [
  "free_delivery",
  "delivery_discount_pct",
  "exclusive_coupons",
  "priority_support",
  "loyalty_multiplier",
  "reward_multiplier",
  "birthday_reward",
  "festival_reward",
  "early_access",
  "partner_offers",
  "free_cancellations",
] as const;
export type BenefitKey = (typeof BENEFIT_KEYS)[number];

export const BENEFIT_LABEL: Record<BenefitKey, string> = {
  free_delivery: "Free deliveries",
  delivery_discount_pct: "Delivery fee discount",
  exclusive_coupons: "Exclusive coupons",
  priority_support: "Priority support",
  loyalty_multiplier: "Loyalty points multiplier",
  reward_multiplier: "Reward multiplier",
  birthday_reward: "Birthday reward",
  festival_reward: "Festival rewards",
  early_access: "Early access to campaigns",
  partner_offers: "Exclusive partner offers",
  free_cancellations: "Free cancellations",
};

/** Restaurant plan quota keys. */
export const LIMIT_KEYS = [
  "menu_items",
  "branches",
  "offers",
  "campaign_credits",
] as const;

export const LIMIT_LABEL: Record<string, string> = {
  menu_items: "Menu items",
  branches: "Branches",
  offers: "Offers per month",
  campaign_credits: "Sponsored campaign credits",
  free_delivery: "Free deliveries",
  free_cancellations: "Free cancellations",
};

export const RIDER_INCENTIVE_TYPES = [
  "peak_hour", "daily_target", "weekly", "monthly",
  "referral", "rain", "festival", "guaranteed",
] as const;

export const RIDER_INCENTIVE_LABEL: Record<string, string> = {
  peak_hour: "Peak hour bonus",
  daily_target: "Daily target bonus",
  weekly: "Weekly bonus",
  monthly: "Monthly bonus",
  referral: "Referral bonus",
  rain: "Rain bonus",
  festival: "Festival bonus",
  guaranteed: "Guaranteed earnings",
};

export const AUDIENCE_LABEL: Record<Audience, string> = {
  customer: "Customer membership",
  restaurant: "Restaurant subscription",
  manager: "Merchant manager plan",
  rider: "Rider incentive plan",
};

/** The plan catalogue admins get on first setup (created in the backend). */
export const STARTER_CATALOGUE: Partial<Plan>[] = [
  {
    code: "FREE", name: "Free", audience: "customer", tier: "free",
    billing_period: "none", price: 0, description: "Pay-as-you-go delivery",
    benefits: { free_delivery: 0, delivery_discount_pct: 0, loyalty_multiplier: 1, reward_multiplier: 1, free_cancellations: 0 },
    sort_order: 0,
  },
  {
    code: "PLUS_M", name: "Plus Monthly", audience: "customer", tier: "plus",
    billing_period: "monthly", price: 149, trial_days: 7,
    description: "Free delivery, extra rewards and priority support",
    benefits: { free_delivery: -1, delivery_discount_pct: 100, exclusive_coupons: true, priority_support: true, loyalty_multiplier: 2, reward_multiplier: 1.5, birthday_reward: true, festival_reward: true, early_access: true, partner_offers: true, free_cancellations: 2 },
    sort_order: 1,
  },
  {
    code: "PLUS_Q", name: "Plus Quarterly", audience: "customer", tier: "plus",
    billing_period: "quarterly", price: 399, compare_price: 447,
    description: "Three months of Plus, one payment",
    benefits: { free_delivery: -1, delivery_discount_pct: 100, exclusive_coupons: true, priority_support: true, loyalty_multiplier: 2, reward_multiplier: 1.5, birthday_reward: true, festival_reward: true, early_access: true, partner_offers: true, free_cancellations: 3 },
    sort_order: 2,
  },
  {
    code: "PLUS_Y", name: "Plus Yearly", audience: "customer", tier: "plus",
    billing_period: "yearly", price: 1299, compare_price: 1788,
    description: "Best value — twelve months of Plus",
    benefits: { free_delivery: -1, delivery_discount_pct: 100, exclusive_coupons: true, priority_support: true, loyalty_multiplier: 2.5, reward_multiplier: 2, birthday_reward: true, festival_reward: true, early_access: true, partner_offers: true, free_cancellations: 5 },
    sort_order: 3,
  },
  {
    code: "R_STARTER", name: "Starter", audience: "restaurant", tier: "starter",
    billing_period: "monthly", price: 0, commission_percent: 22,
    description: "Get listed and start taking orders",
    limits: { menu_items: 50, branches: 1, offers: 2, campaign_credits: 0 },
    benefits: { analytics: false, priority_listing: false, verification_badge: false, dedicated_support: false, manager_priority: 1 },
    sort_order: 0,
  },
  {
    code: "R_GROWTH", name: "Growth", audience: "restaurant", tier: "growth",
    billing_period: "monthly", price: 999, commission_percent: 18,
    description: "Lower commission plus analytics",
    limits: { menu_items: 150, branches: 3, offers: 8, campaign_credits: 500 },
    benefits: { analytics: true, priority_listing: false, verification_badge: true, dedicated_support: false, manager_priority: 2 },
    sort_order: 1,
  },
  {
    code: "R_PRO", name: "Pro", audience: "restaurant", tier: "pro",
    billing_period: "monthly", price: 2499, commission_percent: 15,
    description: "Priority listing and campaign credits",
    limits: { menu_items: 400, branches: 10, offers: 25, campaign_credits: 2500 },
    benefits: { analytics: true, priority_listing: true, verification_badge: true, dedicated_support: false, manager_priority: 3 },
    sort_order: 2,
  },
  {
    code: "R_ENTERPRISE", name: "Enterprise", audience: "restaurant", tier: "enterprise",
    billing_period: "monthly", price: 6999, commission_percent: 12,
    description: "Unlimited scale with dedicated support",
    limits: { menu_items: 9999, branches: 999, offers: 999, campaign_credits: 10000 },
    benefits: { analytics: true, priority_listing: true, verification_badge: true, dedicated_support: true, manager_priority: 5 },
    sort_order: 3,
  },
];

/* --------------------------------------------------------------- utils */

const DAY = 864e5;

export function periodKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function periodDays(p?: BillingPeriod | null): number {
  switch (p) {
    case "quarterly": return 90;
    case "yearly": return 365;
    case "custom": return 30;
    case "none": return 0;
    default: return 30;
  }
}

export function planPrice(p?: Plan | null): number {
  return Number(p?.price ?? p?.monthly_fee ?? 0) || 0;
}

/** Normalised monthly value of a plan — the basis for MRR. */
export function monthlyValue(p?: Plan | null): number {
  const price = planPrice(p);
  switch (p?.billing_period) {
    case "quarterly": return +(price / 3).toFixed(2);
    case "yearly": return +(price / 12).toFixed(2);
    case "none": return 0;
    default: return price;
  }
}

export function planStatus(p: Plan): PlanStatus {
  if (p.status === "archived") return "archived";
  const now = Date.now();
  if (p.starts_at && Date.parse(p.starts_at) > now) return "scheduled";
  if (p.ends_at && Date.parse(p.ends_at) < now) return "archived";
  if (p.status) return p.status;
  return p.active === false ? "paused" : "active";
}

export function subscriptionStatus(s?: Subscription | null): SubStatus {
  if (!s) return "expired";
  if (s.status === "cancelled") return "cancelled";
  if (s.status === "paused") return "paused";
  const end = s.period_end ? Date.parse(s.period_end) : NaN;
  if (!Number.isNaN(end) && end < Date.now()) return "expired";
  if (s.trial_end && Date.parse(s.trial_end) > Date.now()) return "trialing";
  return (s.status as SubStatus) ?? "active";
}

export function isActiveSubscription(s?: Subscription | null): boolean {
  const st = subscriptionStatus(s);
  return st === "active" || st === "trialing" || st === "past_due";
}

export function daysRemaining(s?: Subscription | null): number {
  if (!s?.period_end) return 0;
  const ms = Date.parse(s.period_end) - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / DAY);
}

/** Merge plan benefits with per-plan `membership_benefits` overrides. */
export function resolveBenefits(plan?: Plan | null, overrides: MembershipBenefit[] = []): BenefitMap {
  const out: BenefitMap = { ...(plan?.benefits ?? {}) };
  overrides
    .filter((b) => b.plan_id === plan?.id && b.key)
    .forEach((b) => {
      if (b.enabled === false) { out[String(b.key)] = false; return; }
      out[String(b.key)] = b.value ?? true;
    });
  return out;
}

export function benefitNumber(b: BenefitMap, key: string, fallback = 0): number {
  const v = b[key];
  if (typeof v === "number") return v;
  if (v === true) return 1;
  return fallback;
}

export function benefitEnabled(b: BenefitMap, key: string): boolean {
  const v = b[key];
  return v === true || (typeof v === "number" && v !== 0);
}

/**
 * Delivery fee after membership benefits. `free_delivery: -1` means unlimited;
 * a positive number is the monthly free-delivery allowance.
 */
export function membershipDeliveryFee(
  fee: number,
  benefits: BenefitMap,
  freeUsedThisPeriod = 0,
): number {
  const allowance = benefitNumber(benefits, "free_delivery", 0);
  const unlimited = allowance < 0;
  if (unlimited || (allowance > 0 && freeUsedThisPeriod < allowance)) return 0;
  const pct = benefitNumber(benefits, "delivery_discount_pct", 0);
  if (pct <= 0) return fee;
  return Math.max(0, +(fee * (1 - Math.min(pct, 100) / 100)).toFixed(2));
}

/** Deterministic, non-cryptographic integrity stamp for invoices. */
export function invoiceChecksum(inv: Partial<Invoice>): string {
  const canon = [
    inv.invoice_no, inv.subscription_id, inv.subject_id, inv.plan_id,
    inv.amount, inv.tax, inv.total, inv.period_start, inv.period_end,
  ].map((v) => String(v ?? "")).join("|");
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < canon.length; i++) {
    h1 = Math.imul(h1 ^ canon.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + canon.charCodeAt(i) * (i + 1), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16)}${h2.toString(16)}`;
}

/** False when the stored row no longer matches its checksum (tampered). */
export function invoiceIntact(inv: Invoice): boolean {
  if (!inv.checksum) return true; // legacy row, nothing to compare against
  return invoiceChecksum(inv) === inv.checksum;
}

export function invoiceNumber(subjectId: string, at = new Date()): string {
  const stamp = at.toISOString().slice(0, 10).replace(/-/g, "");
  const tail = String(subjectId).replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase();
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `SX-${stamp}-${tail || "XXXXX"}-${rand}`;
}

/* --------------------------------------------------------------- plans */

export async function listPlans(audience?: Audience, opts?: { includeArchived?: boolean }): Promise<Plan[]> {
  const rows = await listTable<Plan>("subscription_plans", {
    ...(audience ? { audience: `eq.${audience}` } : {}),
    order: "sort_order.asc",
    limit: 200,
  });
  const usable = rows.filter((p) => opts?.includeArchived || planStatus(p) !== "archived");
  return usable.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || planPrice(a) - planPrice(b));
}

export function listAllPlans(): Promise<Plan[]> {
  return listPlans(undefined, { includeArchived: true });
}

export async function createPlan(input: Partial<Plan>, actor?: Actor): Promise<Plan | null> {
  const row = await createRecord<Plan | Plan[]>("subscription_plans", {
    status: "active",
    active: true,
    billing_period: "monthly",
    price: 0,
    ...input,
    created_by: actor?.id ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const plan = (Array.isArray(row) ? row[0] : row) ?? null;
  if (plan) await logEvent({ action: "plan_created", to_plan: plan.id, note: plan.name ?? undefined, actor });
  return plan;
}

export async function updatePlan(id: string, patch: Partial<Plan>, actor?: Actor): Promise<void> {
  await patchRecord("subscription_plans", id, { ...patch, updated_at: new Date().toISOString() });
  await logEvent({ action: "plan_updated", to_plan: id, note: Object.keys(patch).join(","), actor });
}

export async function setPlanStatus(id: string, status: PlanStatus, actor?: Actor): Promise<void> {
  await updatePlan(id, { status, active: status === "active" }, actor);
}

export async function clonePlan(plan: Plan, actor?: Actor): Promise<Plan | null> {
  const { id, created_at, updated_at, ...rest } = plan;
  return createPlan(
    {
      ...rest,
      code: `${plan.code ?? "PLAN"}_COPY`,
      name: `${plan.name ?? "Plan"} (copy)`,
      status: "draft",
      active: false,
      cloned_from: id,
    },
    actor,
  );
}

export async function schedulePlan(id: string, startsAt: string, endsAt: string | null, actor?: Actor) {
  await updatePlan(id, { starts_at: startsAt, ends_at: endsAt, status: "scheduled" }, actor);
}

export async function deletePlan(id: string, actor?: Actor): Promise<void> {
  await deleteRecord("subscription_plans", id);
  await logEvent({ action: "plan_deleted", to_plan: id, actor });
}

/** Creates the default catalogue once — admin action, never automatic. */
export async function seedCatalogue(actor?: Actor): Promise<number> {
  const existing = await listAllPlans();
  const have = new Set(existing.map((p) => (p.code ?? "").toUpperCase()));
  let made = 0;
  for (const draft of STARTER_CATALOGUE) {
    if (have.has(String(draft.code).toUpperCase())) continue;
    const created = await createPlan(draft, actor);
    if (created) made += 1;
  }
  return made;
}

/* ------------------------------------------------------- subscriptions */

export function listSubscriptions(filter?: {
  subject_type?: Audience;
  subject_id?: string;
  status?: SubStatus;
  limit?: number;
}): Promise<Subscription[]> {
  return listTable<Subscription>("subscriptions", {
    ...(filter?.subject_type ? { subject_type: `eq.${filter.subject_type}` } : {}),
    ...(filter?.subject_id ? { subject_id: `eq.${filter.subject_id}` } : {}),
    ...(filter?.status ? { status: `eq.${filter.status}` } : {}),
    order: "-created_at",
    limit: filter?.limit ?? 200,
  });
}

/** The single live subscription for a subject (duplicates are collapsed). */
export async function getSubscription(
  subjectType: Audience,
  subjectId?: string | null,
): Promise<Subscription | null> {
  if (!subjectId) return null;
  const rows = await listSubscriptions({ subject_type: subjectType, subject_id: subjectId, limit: 50 });
  const live = rows.filter(isActiveSubscription);
  if (live.length > 1) {
    // Duplicate guard: keep the newest, retire the rest.
    const [keep, ...dupes] = live.sort(
      (a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""),
    );
    for (const d of dupes) {
      await patchRecord("subscriptions", d.id, {
        status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: "duplicate",
      });
      await logEvent({
        subscription_id: d.id, subject_type: subjectType, subject_id: subjectId,
        action: "duplicate_retired", from_plan: d.plan_id ?? undefined,
      });
    }
    return keep;
  }
  return live[0] ?? rows[0] ?? null;
}

export function logEvent(input: {
  subscription_id?: string;
  subject_type?: Audience;
  subject_id?: string;
  action: string;
  from_plan?: string;
  to_plan?: string;
  amount?: number;
  note?: string;
  actor?: Actor;
}): Promise<unknown> {
  return createRecord("subscription_history", {
    subscription_id: input.subscription_id ?? null,
    subject_type: input.subject_type ?? null,
    subject_id: input.subject_id ?? null,
    action: input.action,
    from_plan: input.from_plan ?? null,
    to_plan: input.to_plan ?? null,
    amount: input.amount ?? null,
    actor_id: input.actor?.id ?? null,
    actor_role: input.actor?.role ?? null,
    note: input.note ?? null,
    created_at: new Date().toISOString(),
  });
}

export function listHistory(subjectId?: string, limit = 100): Promise<SubscriptionEvent[]> {
  return listTable<SubscriptionEvent>("subscription_history", {
    ...(subjectId ? { subject_id: `eq.${subjectId}` } : {}),
    order: "-created_at",
    limit,
  });
}

function notify(subjectId: string | null | undefined, title: string, message: string) {
  if (!subjectId) return;
  queueNotification({ user_id: subjectId, title, message, kind: "system" });
}

/**
 * Start (or replace) a subscription. Server-authoritative and idempotent:
 * an existing live subscription for the same subject is always retired first,
 * so a subject can never hold two plans at once.
 */
export async function subscribe(input: {
  plan: Plan;
  subjectType: Audience;
  subjectId: string;
  actor?: Actor;
  source?: "self" | "admin" | "promo" | "trial";
  withTrial?: boolean;
  autoRenew?: boolean;
}): Promise<Subscription | null> {
  const { plan, subjectType, subjectId } = input;
  if (!subjectId) return null;

  const existing = await getSubscription(subjectType, subjectId);
  if (existing && existing.plan_id === plan.id && isActiveSubscription(existing)) return existing;

  const now = new Date();
  const trialDays = input.withTrial ? Number(plan.trial_days ?? 0) : 0;
  const lengthDays = periodDays(plan.billing_period) || 30;
  const end = new Date(now.getTime() + (trialDays > 0 ? trialDays : lengthDays) * DAY);
  const price = planPrice(plan);

  if (existing) {
    await patchRecord("subscriptions", existing.id, {
      status: "cancelled",
      cancelled_at: now.toISOString(),
      cancel_reason: "replaced",
      updated_at: now.toISOString(),
    });
  }

  const created = await createRecord<Subscription | Subscription[]>("subscriptions", {
    subject_type: subjectType,
    subject_id: subjectId,
    plan_id: plan.id,
    plan_code: plan.code ?? null,
    status: trialDays > 0 ? "trialing" : "active",
    price,
    billing_period: plan.billing_period ?? "monthly",
    auto_renew: input.autoRenew ?? true,
    started_at: now.toISOString(),
    period_start: now.toISOString(),
    period_end: end.toISOString(),
    renewal_date: end.toISOString(),
    trial_end: trialDays > 0 ? end.toISOString() : null,
    source: input.source ?? "self",
    assigned_by: input.source === "admin" ? input.actor?.id ?? null : null,
    savings_total: 0,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  const sub = (Array.isArray(created) ? created[0] : created) ?? null;
  if (!sub) return null;

  const upgrade = existing ? price > Number(existing.price ?? 0) : false;
  await logEvent({
    subscription_id: sub.id,
    subject_type: subjectType,
    subject_id: subjectId,
    action: existing ? (upgrade ? "upgraded" : "downgraded") : trialDays > 0 ? "trial_started" : "created",
    from_plan: existing?.plan_id ?? undefined,
    to_plan: plan.id,
    amount: price,
    actor: input.actor,
  });

  if (price > 0 && trialDays === 0) {
    await issueInvoice({ subscription: sub, plan, status: "paid", actor: input.actor });
  }

  if (subjectType === "customer") {
    notify(subjectId, trialDays > 0 ? "Trial started" : "Membership activated",
      `${plan.name} is now active. Benefits are live on your next order.`);
  } else {
    notify(subjectId, "Plan activated", `${plan.name} is now active on your account.`);
  }
  invalidateTable("subscriptions");
  return sub;
}

/** Upgrade / downgrade helper — same as subscribe, semantics for callers. */
export const changePlan = subscribe;

export async function renewSubscription(sub: Subscription, plan?: Plan | null, actor?: Actor) {
  const now = new Date();
  const len = periodDays(sub.billing_period) || 30;
  const from = sub.period_end && Date.parse(sub.period_end) > now.getTime()
    ? new Date(Date.parse(sub.period_end))
    : now;
  const end = new Date(from.getTime() + len * DAY);
  await patchRecord("subscriptions", sub.id, {
    status: "active",
    period_start: from.toISOString(),
    period_end: end.toISOString(),
    renewal_date: end.toISOString(),
    trial_end: null,
    cancelled_at: null,
    cancel_reason: null,
    updated_at: now.toISOString(),
  });
  await logEvent({
    subscription_id: sub.id, subject_type: sub.subject_type ?? undefined,
    subject_id: sub.subject_id ?? undefined, action: "renewed",
    to_plan: sub.plan_id ?? undefined, amount: Number(sub.price ?? 0), actor,
  });
  if (Number(sub.price ?? 0) > 0) {
    await issueInvoice({ subscription: { ...sub, period_start: from.toISOString(), period_end: end.toISOString() }, plan, status: "paid", actor });
  }
  notify(sub.subject_id, "Plan renewed", `Your plan is renewed until ${end.toDateString()}.`);
}

export async function cancelSubscription(sub: Subscription, reason: string, actor?: Actor) {
  await patchRecord("subscriptions", sub.id, {
    status: "cancelled",
    auto_renew: false,
    cancelled_at: new Date().toISOString(),
    cancel_reason: reason,
    updated_at: new Date().toISOString(),
  });
  await logEvent({
    subscription_id: sub.id, subject_type: sub.subject_type ?? undefined,
    subject_id: sub.subject_id ?? undefined, action: "cancelled",
    from_plan: sub.plan_id ?? undefined, note: reason, actor,
  });
  notify(sub.subject_id, "Plan cancelled", "Your benefits stay active until the end of the current period.");
}

export async function setAutoRenew(sub: Subscription, on: boolean, actor?: Actor) {
  await patchRecord("subscriptions", sub.id, { auto_renew: on, updated_at: new Date().toISOString() });
  await logEvent({
    subscription_id: sub.id, subject_id: sub.subject_id ?? undefined,
    action: on ? "auto_renew_on" : "auto_renew_off", actor,
  });
}

export async function pauseSubscription(sub: Subscription, actor?: Actor) {
  await patchRecord("subscriptions", sub.id, { status: "paused", updated_at: new Date().toISOString() });
  await logEvent({ subscription_id: sub.id, subject_id: sub.subject_id ?? undefined, action: "paused", actor });
}

export async function resumeSubscription(sub: Subscription, actor?: Actor) {
  await patchRecord("subscriptions", sub.id, { status: "active", updated_at: new Date().toISOString() });
  await logEvent({ subscription_id: sub.id, subject_id: sub.subject_id ?? undefined, action: "resumed", actor });
}

/** Admin bulk move — every subject on `fromPlan` is switched to `toPlan`. */
export async function bulkMovePlan(
  fromPlanId: string,
  toPlan: Plan,
  subs: Subscription[],
  actor?: Actor,
): Promise<number> {
  const targets = subs.filter((s) => s.plan_id === fromPlanId && isActiveSubscription(s));
  let n = 0;
  for (const s of targets) {
    const done = await subscribe({
      plan: toPlan,
      subjectType: (s.subject_type ?? "customer") as Audience,
      subjectId: String(s.subject_id),
      actor,
      source: "admin",
    });
    if (done) n += 1;
  }
  return n;
}

/** Subscriptions whose period ends inside `days` — powers renewal reminders. */
export function expiringSoon(subs: Subscription[], days = 5): Subscription[] {
  const limit = Date.now() + days * DAY;
  return subs.filter((s) => {
    if (!isActiveSubscription(s) || !s.period_end) return false;
    const end = Date.parse(s.period_end);
    return end > Date.now() && end <= limit;
  });
}

/** Queue expiry / trial-ending reminders for the given subscriptions. */
export function sendRenewalReminders(subs: Subscription[], days = 5): number {
  return expiringSoon(subs, days).reduce((n, s) => {
    const left = daysRemaining(s);
    const trial = subscriptionStatus(s) === "trialing";
    const ok = queueNotification({
      user_id: String(s.subject_id),
      title: trial ? "Trial ending soon" : "Plan renewal reminder",
      message: trial
        ? `Your trial ends in ${left} day${left === 1 ? "" : "s"}. Pick a plan to keep your benefits.`
        : `Your plan renews in ${left} day${left === 1 ? "" : "s"}.`,
      kind: "system",
      dedupeKey: `sub-renewal:${s.id}:${left}`,
    });
    return n + (ok ? 1 : 0);
  }, 0);
}

/* ------------------------------------------------------------ invoices */

export async function issueInvoice(input: {
  subscription: Subscription;
  plan?: Plan | null;
  status?: Invoice["status"];
  paymentMethod?: string;
  paymentId?: string;
  actor?: Actor;
}): Promise<Invoice | null> {
  const { subscription: sub, plan } = input;
  const amount = Number(sub.price ?? planPrice(plan)) || 0;
  const tax = +(amount * 0.18).toFixed(2);
  const draft: Partial<Invoice> = {
    invoice_no: invoiceNumber(String(sub.subject_id ?? sub.id)),
    subscription_id: sub.id,
    subject_type: sub.subject_type ?? null,
    subject_id: sub.subject_id ?? null,
    plan_id: sub.plan_id ?? null,
    plan_name: plan?.name ?? null,
    amount,
    tax,
    total: +(amount + tax).toFixed(2),
    currency: "INR",
    status: input.status ?? "due",
    period_start: sub.period_start ?? null,
    period_end: sub.period_end ?? null,
    paid_at: (input.status ?? "due") === "paid" ? new Date().toISOString() : null,
    payment_method: input.paymentMethod ?? null,
    payment_id: input.paymentId ?? null,
  };
  const row = await createRecord<Invoice | Invoice[]>("subscription_invoices", {
    ...draft,
    checksum: invoiceChecksum(draft),
    created_at: new Date().toISOString(),
  });
  return (Array.isArray(row) ? row[0] : row) ?? null;
}

export function listInvoices(subjectId?: string, limit = 100): Promise<Invoice[]> {
  return listTable<Invoice>("subscription_invoices", {
    ...(subjectId ? { subject_id: `eq.${subjectId}` } : {}),
    order: "-created_at",
    limit,
  });
}

/* --------------------------------------------------------------- usage */

export function listUsage(subjectId?: string, period?: string): Promise<UsageRow[]> {
  return listTable<UsageRow>("subscription_usage", {
    ...(subjectId ? { subject_id: `eq.${subjectId}` } : {}),
    ...(period ? { period: `eq.${period}` } : {}),
    limit: 200,
  });
}

/**
 * Increment a benefit/quota counter for the current period. Creates the row
 * on first use. `valueSaved` accumulates the ₹ value the member saved.
 */
export async function recordUsage(input: {
  subscription?: Subscription | null;
  subjectType: Audience;
  subjectId: string;
  metric: string;
  amount?: number;
  valueSaved?: number;
  quota?: number;
}): Promise<UsageRow | null> {
  const period = periodKey();
  const rows = await listTable<UsageRow>("subscription_usage", {
    subject_id: `eq.${input.subjectId}`,
    metric: `eq.${input.metric}`,
    period: `eq.${period}`,
    limit: 1,
  }, { fresh: true });
  const inc = input.amount ?? 1;
  const saved = input.valueSaved ?? 0;
  const existing = rows[0];
  if (existing) {
    const next = {
      used: Number(existing.used ?? 0) + inc,
      value_saved: +(Number(existing.value_saved ?? 0) + saved).toFixed(2),
      updated_at: new Date().toISOString(),
    };
    await patchRecord("subscription_usage", existing.id, next);
    return { ...existing, ...next };
  }
  const created = await createRecord<UsageRow | UsageRow[]>("subscription_usage", {
    subscription_id: input.subscription?.id ?? null,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    metric: input.metric,
    period,
    used: inc,
    quota: input.quota ?? null,
    value_saved: saved,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
  return (Array.isArray(created) ? created[0] : created) ?? null;
}

export function usedThisPeriod(usage: UsageRow[], metric: string, period = periodKey()): number {
  return usage
    .filter((u) => u.metric === metric && u.period === period)
    .reduce((s, u) => s + Number(u.used ?? 0), 0);
}

export function savedThisPeriod(usage: UsageRow[], period = periodKey()): number {
  return +usage
    .filter((u) => u.period === period)
    .reduce((s, u) => s + Number(u.value_saved ?? 0), 0)
    .toFixed(2);
}

export function lifetimeSavings(usage: UsageRow[]): number {
  return +usage.reduce((s, u) => s + Number(u.value_saved ?? 0), 0).toFixed(2);
}

/** Remaining quota for a restaurant plan limit. -1 means unlimited. */
export function remainingQuota(plan: Plan | null | undefined, usage: UsageRow[], metric: string): number {
  const quota = Number(plan?.limits?.[metric] ?? 0);
  if (!quota) return 0;
  if (quota >= 9999) return -1;
  return Math.max(0, quota - usedThisPeriod(usage, metric));
}

/** True when the subject may still consume `metric` under its plan. */
export function withinQuota(plan: Plan | null | undefined, usage: UsageRow[], metric: string): boolean {
  const left = remainingQuota(plan, usage, metric);
  return left === -1 || left > 0;
}

/* ---------------------------------------------------------- benefits db */

export function listBenefitOverrides(planId?: string): Promise<MembershipBenefit[]> {
  return listTable<MembershipBenefit>("membership_benefits", {
    ...(planId ? { plan_id: `eq.${planId}` } : {}),
    order: "sort_order.asc",
    limit: 200,
  });
}

export async function upsertBenefit(input: Partial<MembershipBenefit>): Promise<void> {
  if (input.id) { await patchRecord("membership_benefits", input.id, input as Record<string, unknown>); return; }
  await createRecord("membership_benefits", { enabled: true, ...input, created_at: new Date().toISOString() });
}

export function deleteBenefit(id: string) { return deleteRecord("membership_benefits", id); }

/* -------------------------------------------------------- rider bonuses */

export function listRiderIncentives(driverId?: string, limit = 200): Promise<RiderIncentive[]> {
  return listTable<RiderIncentive>("rider_incentives", {
    ...(driverId ? { driver_id: `eq.${driverId}` } : {}),
    order: "-created_at",
    limit,
  });
}

export async function upsertIncentive(input: Partial<RiderIncentive>): Promise<RiderIncentive | null> {
  if (input.id) {
    await patchRecord("rider_incentives", input.id, input as Record<string, unknown>);
    return input as RiderIncentive;
  }
  const row = await createRecord<RiderIncentive | RiderIncentive[]>("rider_incentives", {
    status: "pending",
    period: periodKey(),
    created_at: new Date().toISOString(),
    ...input,
  });
  return (Array.isArray(row) ? row[0] : row) ?? null;
}

export async function setIncentiveStatus(
  inc: RiderIncentive,
  status: NonNullable<RiderIncentive["status"]>,
): Promise<void> {
  await patchRecord("rider_incentives", inc.id, {
    status,
    paid_at: status === "paid" ? new Date().toISOString() : null,
  });
  if (inc.driver_id && status === "paid") {
    notify(inc.driver_id, "Incentive paid",
      `${RIDER_INCENTIVE_LABEL[String(inc.type)] ?? "Bonus"} of ₹${inc.amount ?? 0} has been paid.`);
  }
}

export function riderIncentiveSummary(rows: RiderIncentive[]) {
  const sum = (f: (r: RiderIncentive) => number) => +rows.reduce((s, r) => s + f(r), 0).toFixed(2);
  const paid = rows.filter((r) => r.status === "paid");
  const pending = rows.filter((r) => r.status === "pending" || r.status === "approved");
  const latest = rows[0];
  return {
    total: sum((r) => Number(r.amount ?? 0)),
    paid: +paid.reduce((s, r) => s + Number(r.amount ?? 0), 0).toFixed(2),
    pending: +pending.reduce((s, r) => s + Number(r.amount ?? 0), 0).toFixed(2),
    count: rows.length,
    ordersCompleted: rows.reduce((s, r) => s + Number(r.orders_completed ?? 0), 0),
    acceptanceRate: Number(latest?.acceptance_rate ?? 0),
    completionRate: Number(latest?.completion_rate ?? 0),
    onlineHours: +rows.reduce((s, r) => s + Number(r.online_hours ?? 0), 0).toFixed(1),
  };
}

/* ------------------------------------------------------ merchant targets */

export function listMerchantTargets(managerId?: string, limit = 200): Promise<MerchantTarget[]> {
  return listTable<MerchantTarget>("merchant_targets", {
    ...(managerId ? { manager_id: `eq.${managerId}` } : {}),
    order: "-created_at",
    limit,
  });
}

export async function upsertMerchantTarget(input: Partial<MerchantTarget>): Promise<MerchantTarget | null> {
  if (input.id) {
    await patchRecord("merchant_targets", input.id, input as Record<string, unknown>);
    return input as MerchantTarget;
  }
  const row = await createRecord<MerchantTarget | MerchantTarget[]>("merchant_targets", {
    period: periodKey(),
    status: "active",
    created_at: new Date().toISOString(),
    ...input,
  });
  return (Array.isArray(row) ? row[0] : row) ?? null;
}

export function managerPerformance(rows: MerchantTarget[]) {
  const current = rows.find((r) => r.period === periodKey()) ?? rows[0];
  const achieved = Number(current?.achieved ?? 0);
  const target = Number(current?.target ?? 0);
  return {
    current,
    target,
    achieved,
    attainment: target > 0 ? +((achieved / target) * 100).toFixed(1) : 0,
    commission: +rows.reduce((s, r) => s + Number(r.commission ?? 0), 0).toFixed(2),
    bonus: +rows.reduce((s, r) => s + Number(r.bonus ?? 0), 0).toFixed(2),
    growth: Number(current?.growth_percent ?? 0),
    region: current?.region ?? null,
  };
}

/* ----------------------------------------------------------- analytics */

export type SubscriptionAnalytics = {
  mrr: number;
  arr: number;
  activeCount: number;
  trialCount: number;
  cancelledCount: number;
  distribution: { planId: string; name: string; count: number; mrr: number }[];
  renewalRate: number;
  upgradeRate: number;
  downgradeRate: number;
  churnRate: number;
  retentionRate: number;
  ltv: number;
  averageSavings: number;
  revenueCollected: number;
};

export function subscriptionAnalytics(
  subs: Subscription[],
  plans: Plan[],
  history: SubscriptionEvent[],
  invoices: Invoice[],
  usage: UsageRow[] = [],
): SubscriptionAnalytics {
  const planById = new Map(plans.map((p) => [p.id, p]));
  const active = subs.filter(isActiveSubscription);
  const cancelled = subs.filter((s) => subscriptionStatus(s) === "cancelled");
  const mrr = +active.reduce((s, x) => s + monthlyValue(planById.get(String(x.plan_id)) ?? { price: x.price, billing_period: x.billing_period } as Plan), 0).toFixed(2);

  const distribution = plans.map((p) => {
    const rows = active.filter((s) => s.plan_id === p.id);
    return {
      planId: p.id,
      name: p.name ?? p.code ?? "Plan",
      count: rows.length,
      mrr: +(rows.length * monthlyValue(p)).toFixed(2),
    };
  }).filter((d) => d.count > 0);

  const created = history.filter((h) => h.action === "created" || h.action === "trial_started").length;
  const renewed = history.filter((h) => h.action === "renewed").length;
  const upgraded = history.filter((h) => h.action === "upgraded").length;
  const downgraded = history.filter((h) => h.action === "downgraded").length;
  const churned = history.filter((h) => h.action === "cancelled").length;
  const base = Math.max(created + renewed, 1);
  const churnBase = Math.max(active.length + cancelled.length, 1);

  const revenueCollected = +invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.total ?? 0), 0)
    .toFixed(2);

  const avgMonths = active.length
    ? +(active.reduce((s, x) => {
      const start = x.started_at ? Date.parse(x.started_at) : Date.now();
      return s + Math.max(1, (Date.now() - start) / (30 * DAY));
    }, 0) / active.length).toFixed(2)
    : 0;

  return {
    mrr,
    arr: +(mrr * 12).toFixed(2),
    activeCount: active.length,
    trialCount: subs.filter((s) => subscriptionStatus(s) === "trialing").length,
    cancelledCount: cancelled.length,
    distribution,
    renewalRate: +((renewed / base) * 100).toFixed(1),
    upgradeRate: +((upgraded / base) * 100).toFixed(1),
    downgradeRate: +((downgraded / base) * 100).toFixed(1),
    churnRate: +((churned / churnBase) * 100).toFixed(1),
    retentionRate: +(100 - (churned / churnBase) * 100).toFixed(1),
    ltv: active.length ? +((mrr / active.length) * Math.max(avgMonths, 1)).toFixed(2) : 0,
    averageSavings: usage.length
      ? +(lifetimeSavings(usage) / Math.max(new Set(usage.map((u) => u.subject_id)).size, 1)).toFixed(2)
      : 0,
    revenueCollected,
  };
}

/* --------------------------------------------------------------- hooks */

const SUB_TABLES = ["subscriptions", "subscription_plans", "subscription_invoices", "subscription_usage"];

/** Live plan catalogue for one audience. */
export function usePlans(audience?: Audience, includeArchived = false) {
  const version = useTableVersion(["subscription_plans"]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setPlans(await listPlans(audience, { includeArchived }));
    setLoading(false);
  }, [audience, includeArchived]);

  useEffect(() => { void refresh(); }, [refresh, version]);
  return { plans, loading, refresh };
}

/** Live subscription + plan + usage + invoices for one subject. */
export function useSubscription(subjectType: Audience, subjectId?: string | null) {
  const version = useTableVersion(SUB_TABLES);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [benefits, setBenefits] = useState<BenefitMap>({});
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [history, setHistory] = useState<SubscriptionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!subjectId) {
      setSubscription(null); setPlan(null); setBenefits({});
      setUsage([]); setInvoices([]); setHistory([]); setLoading(false);
      return;
    }
    const sub = await getSubscription(subjectType, subjectId);
    const [plans, use, inv, hist, overrides] = await Promise.all([
      listPlans(subjectType, { includeArchived: true }),
      listUsage(subjectId),
      listInvoices(subjectId),
      listHistory(subjectId),
      listBenefitOverrides(),
    ]);
    const p = plans.find((x) => x.id === sub?.plan_id) ?? null;
    setSubscription(sub);
    setPlan(p);
    setBenefits(resolveBenefits(p, overrides));
    setUsage(use);
    setInvoices(inv.filter(invoiceIntact));
    setHistory(hist);
    setLoading(false);
  }, [subjectType, subjectId]);

  useEffect(() => { void refresh(); }, [refresh, version]);

  return { subscription, plan, benefits, usage, invoices, history, loading, refresh };
}

/** Everything the admin console needs, live. */
export function useSubscriptionAdmin() {
  const version = useTableVersion([...SUB_TABLES, "subscription_history"]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [history, setHistory] = useState<SubscriptionEvent[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [p, s, h, i, u] = await Promise.all([
      listAllPlans(), listSubscriptions({ limit: 200 }), listHistory(undefined, 200),
      listInvoices(undefined, 200), listUsage(),
    ]);
    setPlans(p); setSubs(s); setHistory(h); setInvoices(i); setUsage(u);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh, version]);

  const analytics = subscriptionAnalytics(subs, plans, history, invoices, usage);
  return { plans, subs, history, invoices, usage, analytics, loading, refresh };
}
