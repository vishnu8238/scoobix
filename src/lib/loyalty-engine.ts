/**
 * Scoobix Wallet · Loyalty · Referral · Rewards engine.
 *
 * Server-authoritative: every balance, point, referral and reward lives in
 * InsForge. Nothing here touches localStorage for business state (the only
 * local value is a device fingerprint used for referral fraud detection).
 *
 * Tables
 *  wallet                (balances + buckets)
 *  wallet_transactions   (ledger)
 *  loyalty_accounts      (aggregate points + level)
 *  loyalty_points        (points ledger)
 *  referrals             (invitations)
 *  referral_rewards      (payouts per side)
 *  scratch_cards         (issued cards)
 *  reward_store          (catalogue)
 *  reward_redemptions    (store redemptions)
 *  reward_campaigns      (admin / restaurant sponsored campaigns)
 *  loyalty_audit_logs    (full audit trail)
 */
import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";
import { nudgeTable } from "./realtime";
import { getAppSettings } from "./app-settings";

/* ============================================================ types */

export type WalletBucket = "main" | "cashback" | "promo" | "refund" | "referral";

export type TxnKind =
  | "order_payment"
  | "refund"
  | "referral_bonus"
  | "admin_credit"
  | "admin_debit"
  | "coupon_cashback"
  | "loyalty_redemption"
  | "reward_redemption"
  | "scratch_reward"
  | "manual_adjustment"
  // legacy kinds kept so historic rows still render
  | "credit"
  | "debit"
  | "cashback"
  | "scratch"
  | "admin";

export type TxnStatus = "success" | "pending" | "failed" | "reversed";

export const TXN_LABEL: Record<string, string> = {
  order_payment: "Order payment",
  refund: "Refund",
  referral_bonus: "Referral bonus",
  admin_credit: "Admin credit",
  admin_debit: "Admin debit",
  coupon_cashback: "Coupon cashback",
  loyalty_redemption: "Loyalty redemption",
  reward_redemption: "Reward redemption",
  scratch_reward: "Scratch card reward",
  manual_adjustment: "Manual adjustment",
  credit: "Credit",
  debit: "Debit",
  cashback: "Cashback",
  scratch: "Scratch card",
  admin: "Admin adjustment",
};

export const TXN_KINDS: TxnKind[] = [
  "order_payment",
  "refund",
  "referral_bonus",
  "admin_credit",
  "admin_debit",
  "coupon_cashback",
  "loyalty_redemption",
  "reward_redemption",
  "scratch_reward",
  "manual_adjustment",
];

export type WalletRow = {
  id: string;
  user_id?: string | null;
  balance?: number | null;
  promo_credits?: number | null;
  cashback_credits?: number | null;
  refund_credits?: number | null;
  referral_credits?: number | null;
  lifetime_credited?: number | null;
  lifetime_debited?: number | null;
  blocked?: boolean | null;
  block_reason?: string | null;
  updated_at?: string | null;
};

export type WalletTxnRow = {
  id: string;
  wallet_id?: string | null;
  user_id?: string | null;
  txn_code?: string | null;
  amount?: number | null;
  transaction_type?: string | null;
  kind?: string | null;
  bucket?: string | null;
  status?: string | null;
  description?: string | null;
  remark?: string | null;
  balance_after?: number | null;
  order_id?: string | null;
  created_by?: string | null;
  created_at?: string;
};

export type LoyaltyLevel = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export type LevelSpec = {
  id: LoyaltyLevel;
  name: string;
  minLifetimePoints: number;
  multiplier: number;
  deliveryDiscountPct: number;
  prioritySupport: boolean;
  exclusiveCoupons: boolean;
  benefits: string[];
};

export const LEVELS: LevelSpec[] = [
  {
    id: "bronze", name: "Bronze", minLifetimePoints: 0, multiplier: 1, deliveryDiscountPct: 0,
    prioritySupport: false, exclusiveCoupons: false,
    benefits: ["1x points on every order", "Scratch card after each order"],
  },
  {
    id: "silver", name: "Silver", minLifetimePoints: 500, multiplier: 1.25, deliveryDiscountPct: 5,
    prioritySupport: false, exclusiveCoupons: true,
    benefits: ["1.25x points", "5% off delivery fee", "Silver-only coupons"],
  },
  {
    id: "gold", name: "Gold", minLifetimePoints: 2000, multiplier: 1.5, deliveryDiscountPct: 10,
    prioritySupport: true, exclusiveCoupons: true,
    benefits: ["1.5x points", "10% off delivery fee", "Priority support", "Gold coupons"],
  },
  {
    id: "platinum", name: "Platinum", minLifetimePoints: 6000, multiplier: 1.75, deliveryDiscountPct: 20,
    prioritySupport: true, exclusiveCoupons: true,
    benefits: ["1.75x points", "20% off delivery fee", "Priority support", "Early access to offers"],
  },
  {
    id: "diamond", name: "Diamond", minLifetimePoints: 15000, multiplier: 2, deliveryDiscountPct: 100,
    prioritySupport: true, exclusiveCoupons: true,
    benefits: ["2x points", "Free delivery", "Dedicated support", "Membership perks"],
  },
];

export const levelSpec = (id?: string | null): LevelSpec =>
  LEVELS.find((l) => l.id === id) ?? LEVELS[0];

export const levelForPoints = (lifetime: number): LevelSpec =>
  [...LEVELS].reverse().find((l) => lifetime >= l.minLifetimePoints) ?? LEVELS[0];

export const nextLevel = (id: LoyaltyLevel): LevelSpec | null => {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
};

export type LoyaltyAccount = {
  id: string;
  user_id?: string | null;
  points?: number | null;
  lifetime_points?: number | null;
  redeemed_points?: number | null;
  expired_points?: number | null;
  level?: LoyaltyLevel | null;
  level_updated_at?: string | null;
};

export type LoyaltyLedgerRow = {
  id: string;
  user_id?: string | null;
  points?: number | null;
  direction?: "earn" | "redeem" | "expire" | null;
  reason?: string | null;
  source?: string | null;
  order_id?: string | null;
  campaign_id?: string | null;
  expires_at?: string | null;
  status?: "active" | "used" | "expired" | null;
  created_at?: string;
};

export type PointSource =
  | "order"
  | "review"
  | "referral"
  | "campaign"
  | "festival"
  | "birthday"
  | "admin"
  | "scratch";

export type ReferralRow = {
  id: string;
  referrer_id?: string | null;
  referred_id?: string | null;
  referral_code?: string | null;
  referee_name?: string | null;
  reward_amount?: number | null;
  points_awarded?: number | null;
  status?: "pending" | "rewarded" | "expired" | "rejected" | null;
  referee_verified?: boolean | null;
  first_order_done?: boolean | null;
  device_hash?: string | null;
  fraud_flag?: string | null;
  blocked?: boolean | null;
  order_id?: string | null;
  rewarded_at?: string | null;
  created_at?: string;
};

export type ReferralRewardRow = {
  id: string;
  referral_id?: string | null;
  user_id?: string | null;
  side?: "referrer" | "referee" | null;
  amount?: number | null;
  points?: number | null;
  status?: "pending" | "approved" | "rejected" | "paid" | null;
  reason?: string | null;
  paid_at?: string | null;
  created_at?: string;
};

export type ScratchCardRow = {
  id: string;
  user_id?: string | null;
  customer_id?: string | null;
  order_id?: string | null;
  title?: string | null;
  subtitle?: string | null;
  reward_type?: string | null;
  reward_value?: number | null;
  points?: number | null;
  coupon_code?: string | null;
  status?: "locked" | "scratched" | "expired" | null;
  scratched_at?: string | null;
  expires_at?: string | null;
  campaign_id?: string | null;
  restaurant_id?: string | null;
  usage_limit?: number | null;
  used?: boolean | null;
  active?: boolean | null;
  issued_at?: string | null;
  created_at?: string;
};

export type RewardStoreItem = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  kind?: "coupon" | "wallet" | "free_delivery" | "restaurant_discount" | "membership" | "partner" | null;
  value?: number | null;
  coupon_code?: string | null;
  cost_points?: number | null;
  min_level?: LoyaltyLevel | null;
  stock?: number | null;
  redeemed_count?: number | null;
  active?: boolean | null;
  restaurant_id?: string | null;
  sponsor?: string | null;
  image_url?: string | null;
  expires_at?: string | null;
  created_at?: string;
};

export type RewardRedemptionRow = {
  id: string;
  item_id?: string | null;
  user_id?: string | null;
  title?: string | null;
  kind?: string | null;
  value?: number | null;
  points_spent?: number | null;
  code?: string | null;
  status?: "issued" | "used" | "expired" | null;
  used_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
};

export type RewardCampaignRow = {
  id: string;
  name?: string | null;
  type?: "scratch" | "bonus_points" | "cashback" | "festival" | "birthday" | null;
  sponsor_restaurant_id?: string | null;
  sponsor_name?: string | null;
  budget?: number | null;
  spent?: number | null;
  reward_kind?: "wallet" | "points" | "coupon" | "free_delivery" | null;
  reward_min?: number | null;
  reward_max?: number | null;
  points?: number | null;
  coupon_code?: string | null;
  usage_limit?: number | null;
  issued_count?: number | null;
  active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  audience?: string | null;
  min_level?: LoyaltyLevel | null;
  created_by?: string | null;
  recommended_by?: string | null;
  notes?: string | null;
  created_at?: string;
};

/* ============================================================ helpers */

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const nowIso = () => new Date().toISOString();

const rand = (n = 6) =>
  Array.from({ length: n }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

export const txnCode = () => `WTX-${Date.now().toString(36).toUpperCase()}-${rand(4)}`;

/** Stable device fingerprint used only for referral abuse detection. */
export function deviceHash(): string {
  if (typeof window === "undefined") return "server";
  try {
    const key = "scoobix_device_id";
    let id = window.localStorage.getItem(key);
    if (!id) {
      id = `${rand(10)}${Date.now().toString(36)}`;
      window.localStorage.setItem(key, id);
    }
    const seed = `${id}|${navigator.userAgent}|${screen.width}x${screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return `dev_${h.toString(36)}`;
  } catch {
    return "unknown";
  }
}

export async function auditLoyalty(entry: {
  entity: string;
  entityId?: string;
  userId?: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  amount?: number;
  points?: number;
  reason?: string;
  meta?: Record<string, unknown>;
}) {
  await createRecord("loyalty_audit_logs", {
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    user_id: entry.userId ?? null,
    actor_id: entry.actorId ?? null,
    actor_role: entry.actorRole ?? null,
    action: entry.action,
    amount: entry.amount ?? null,
    points: entry.points ?? null,
    reason: entry.reason ?? null,
    meta: entry.meta ?? null,
  });
}

export const listAuditLogs = (limit = 200) =>
  listTable<Record<string, unknown>>("loyalty_audit_logs", { order: "-created_at", limit });

/* ============================================================ wallet */

const walletIdCache = new Map<string, string>();

export async function ensureWallet(userId: string): Promise<WalletRow | null> {
  if (!userId) return null;
  const rows = await listTable<WalletRow>("wallet", { user_id: `eq.${userId}`, limit: 1 });
  let row = rows[0] ?? null;
  if (!row) {
    row = await createRecord<WalletRow>("wallet", {
      user_id: userId,
      balance: 0,
      promo_credits: 0,
      cashback_credits: 0,
      refund_credits: 0,
      referral_credits: 0,
      lifetime_credited: 0,
      lifetime_debited: 0,
      blocked: false,
    });
  }
  if (row?.id) walletIdCache.set(userId, row.id);
  return row;
}

export type WalletSummary = {
  balance: number;
  buckets: Record<Exclude<WalletBucket, "main">, number>;
  lifetimeCredited: number;
  lifetimeDebited: number;
  blocked: boolean;
  blockReason: string;
};

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const w = await ensureWallet(userId);
  return {
    balance: num(w?.balance),
    buckets: {
      cashback: num(w?.cashback_credits),
      promo: num(w?.promo_credits),
      refund: num(w?.refund_credits),
      referral: num(w?.referral_credits),
    },
    lifetimeCredited: num(w?.lifetime_credited),
    lifetimeDebited: num(w?.lifetime_debited),
    blocked: Boolean(w?.blocked),
    blockReason: String(w?.block_reason ?? ""),
  };
}

export const listWalletTransactions = (userId: string, limit = 200) =>
  listTable<WalletTxnRow>("wallet_transactions", {
    user_id: `eq.${userId}`,
    order: "-created_at",
    limit,
  });

export async function listAllWalletTransactions(limit = 500): Promise<WalletTxnRow[]> {
  const [txns, wallets] = await Promise.all([
    listTable<WalletTxnRow>("wallet_transactions", { order: "-created_at", limit }),
    listTable<WalletRow>("wallet", { limit: 500 }),
  ]);
  const byId = new Map(wallets.map((w) => [w.id, w.user_id ?? ""]));
  return txns.map((t) => ({
    ...t,
    user_id: t.user_id || byId.get(String(t.wallet_id ?? "")) || "",
  }));
}

export const listWallets = (limit = 500) => listTable<WalletRow>("wallet", { limit });

const BUCKET_FOR_KIND: Partial<Record<TxnKind, Exclude<WalletBucket, "main">>> = {
  coupon_cashback: "cashback",
  cashback: "cashback",
  refund: "refund",
  referral_bonus: "referral",
  scratch_reward: "promo",
  scratch: "promo",
  admin_credit: "promo",
};

export type WalletWriteResult = {
  ok: boolean;
  balance: number;
  reason?: string;
  txn?: WalletTxnRow | null;
};

async function writeWallet(input: {
  userId: string;
  signedAmount: number;
  kind: TxnKind;
  remark: string;
  orderId?: string | null;
  bucket?: WalletBucket;
  status?: TxnStatus;
  actorId?: string;
  meta?: Record<string, unknown>;
}): Promise<WalletWriteResult> {
  const { userId, signedAmount, kind } = input;
  if (!userId) return { ok: false, balance: 0, reason: "Sign in required" };
  if (!Number.isFinite(signedAmount) || signedAmount === 0)
    return { ok: false, balance: 0, reason: "Invalid amount" };

  const w = await ensureWallet(userId);
  if (!w?.id) return { ok: false, balance: 0, reason: "Wallet unavailable" };
  if (w.blocked) return { ok: false, balance: num(w.balance), reason: w.block_reason || "Wallet blocked" };

  const current = num(w.balance);
  const next = Math.round((current + signedAmount) * 100) / 100;
  if (next < 0) return { ok: false, balance: current, reason: "Insufficient wallet balance" };

  const bucket = input.bucket ?? BUCKET_FOR_KIND[kind] ?? "main";
  const status: TxnStatus = input.status ?? "success";

  const txn = await createRecord<WalletTxnRow>("wallet_transactions", {
    wallet_id: w.id,
    user_id: userId,
    txn_code: txnCode(),
    amount: signedAmount,
    transaction_type: kind,
    kind,
    bucket,
    status,
    description: input.remark,
    remark: input.remark,
    balance_after: next,
    order_id: input.orderId ?? null,
    created_by: input.actorId ?? userId,
    meta: input.meta ?? null,
  });

  const patch: Record<string, unknown> = {
    balance: next,
    updated_at: nowIso(),
    lifetime_credited: num(w.lifetime_credited) + (signedAmount > 0 ? signedAmount : 0),
    lifetime_debited: num(w.lifetime_debited) + (signedAmount < 0 ? -signedAmount : 0),
  };
  if (bucket !== "main") {
    const col = `${bucket === "cashback" ? "cashback" : bucket}_credits`;
    const prev = num((w as Record<string, unknown>)[col]);
    patch[col] = Math.max(0, prev + signedAmount);
  }
  await patchRecord("wallet", w.id, patch);

  nudgeTable("wallet");
  nudgeTable("wallet_transactions");
  await auditLoyalty({
    entity: "wallet",
    entityId: w.id,
    userId,
    actorId: input.actorId,
    action: signedAmount > 0 ? "credit" : "debit",
    amount: signedAmount,
    reason: input.remark,
  });

  return { ok: true, balance: next, txn };
}

export function creditWallet(input: {
  userId: string;
  amount: number;
  kind: TxnKind;
  remark: string;
  orderId?: string | null;
  bucket?: WalletBucket;
  actorId?: string;
  meta?: Record<string, unknown>;
}) {
  return writeWallet({ ...input, signedAmount: Math.abs(input.amount) });
}

export function debitWallet(input: {
  userId: string;
  amount: number;
  kind: TxnKind;
  remark: string;
  orderId?: string | null;
  bucket?: WalletBucket;
  actorId?: string;
  meta?: Record<string, unknown>;
}) {
  return writeWallet({ ...input, signedAmount: -Math.abs(input.amount) });
}

export async function setWalletBlocked(userId: string, blocked: boolean, reason: string, actorId?: string) {
  const w = await ensureWallet(userId);
  if (!w?.id) return false;
  await patchRecord("wallet", w.id, { blocked, block_reason: blocked ? reason : null, updated_at: nowIso() });
  nudgeTable("wallet");
  await auditLoyalty({
    entity: "wallet", entityId: w.id, userId, actorId,
    action: blocked ? "blocked" : "unblocked", reason,
  });
  return true;
}

/* ============================================================ loyalty */

export async function ensureLoyaltyAccount(userId: string): Promise<LoyaltyAccount | null> {
  if (!userId) return null;
  const rows = await listTable<LoyaltyAccount>("loyalty_accounts", { user_id: `eq.${userId}`, limit: 1 });
  return (
    rows[0] ??
    (await createRecord<LoyaltyAccount>("loyalty_accounts", {
      user_id: userId,
      points: 0,
      lifetime_points: 0,
      redeemed_points: 0,
      expired_points: 0,
      level: "bronze",
      level_updated_at: nowIso(),
    }))
  );
}

export type LoyaltySummary = {
  points: number;
  lifetime: number;
  redeemed: number;
  expired: number;
  level: LevelSpec;
  next: LevelSpec | null;
  progressPct: number;
};

export async function getLoyaltySummary(userId: string): Promise<LoyaltySummary> {
  const acc = await ensureLoyaltyAccount(userId);
  const lifetime = num(acc?.lifetime_points);
  const level = levelForPoints(lifetime);
  const next = nextLevel(level.id);
  const span = next ? next.minLifetimePoints - level.minLifetimePoints : 1;
  return {
    points: num(acc?.points),
    lifetime,
    redeemed: num(acc?.redeemed_points),
    expired: num(acc?.expired_points),
    level,
    next,
    progressPct: next ? Math.min(100, Math.round(((lifetime - level.minLifetimePoints) / span) * 100)) : 100,
  };
}

export const listPointsHistory = (userId: string, limit = 100) =>
  listTable<LoyaltyLedgerRow>("loyalty_points", { user_id: `eq.${userId}`, order: "-created_at", limit });

export const listAllPoints = (limit = 500) =>
  listTable<LoyaltyLedgerRow>("loyalty_points", { order: "-created_at", limit });

export const listLoyaltyAccounts = (limit = 500) =>
  listTable<LoyaltyAccount>("loyalty_accounts", { limit });

/** Points earned per ₹ spent (level multiplier applied). */
export function pointsForOrder(total: number, level: LevelSpec): number {
  const perRupee = getAppSettings().loyalty_points_per_rupee ?? 0.1;
  return Math.max(0, Math.round(total * perRupee * level.multiplier));
}

export async function earnPoints(input: {
  userId: string;
  points: number;
  reason: string;
  source: PointSource;
  orderId?: string | null;
  campaignId?: string | null;
  expiresInDays?: number;
  actorId?: string;
}): Promise<LoyaltySummary | null> {
  const { userId } = input;
  const pts = Math.round(Math.abs(input.points));
  if (!userId || pts <= 0) return null;

  const acc = await ensureLoyaltyAccount(userId);
  if (!acc?.id) return null;

  const days = input.expiresInDays ?? getAppSettings().loyalty_expiry_days ?? 365;
  await createRecord("loyalty_points", {
    user_id: userId,
    points: pts,
    direction: "earn",
    reason: input.reason,
    source: input.source,
    order_id: input.orderId ?? null,
    campaign_id: input.campaignId ?? null,
    expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
    status: "active",
  });

  const lifetime = num(acc.lifetime_points) + pts;
  const level = levelForPoints(lifetime);
  await patchRecord("loyalty_accounts", acc.id, {
    points: num(acc.points) + pts,
    lifetime_points: lifetime,
    level: level.id,
    level_updated_at: level.id !== acc.level ? nowIso() : acc.level_updated_at ?? nowIso(),
  });

  nudgeTable("loyalty_points");
  nudgeTable("loyalty_accounts");
  await auditLoyalty({
    entity: "loyalty", entityId: acc.id, userId, actorId: input.actorId,
    action: "earn", points: pts, reason: input.reason,
  });
  return getLoyaltySummary(userId);
}

export async function redeemPoints(input: {
  userId: string;
  points: number;
  reason: string;
  actorId?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const pts = Math.round(Math.abs(input.points));
  const acc = await ensureLoyaltyAccount(input.userId);
  if (!acc?.id) return { ok: false, reason: "Loyalty account unavailable" };
  if (num(acc.points) < pts) return { ok: false, reason: "Not enough points" };

  await createRecord("loyalty_points", {
    user_id: input.userId,
    points: pts,
    direction: "redeem",
    reason: input.reason,
    source: "admin",
    status: "used",
  });
  await patchRecord("loyalty_accounts", acc.id, {
    points: num(acc.points) - pts,
    redeemed_points: num(acc.redeemed_points) + pts,
  });
  nudgeTable("loyalty_points");
  nudgeTable("loyalty_accounts");
  await auditLoyalty({
    entity: "loyalty", entityId: acc.id, userId: input.userId, actorId: input.actorId,
    action: "redeem", points: pts, reason: input.reason,
  });
  return { ok: true };
}

/** Expire any active earn rows past their expiry for one user. */
export async function sweepExpiredPoints(userId: string): Promise<number> {
  const rows = await listPointsHistory(userId, 200);
  const now = Date.now();
  const stale = rows.filter(
    (r) => r.direction === "earn" && r.status === "active" && r.expires_at && new Date(r.expires_at).getTime() < now,
  );
  if (!stale.length) return 0;
  const acc = await ensureLoyaltyAccount(userId);
  if (!acc?.id) return 0;
  let total = 0;
  for (const r of stale) {
    total += num(r.points);
    await patchRecord("loyalty_points", r.id, { status: "expired" });
  }
  const capped = Math.min(total, num(acc.points));
  await patchRecord("loyalty_accounts", acc.id, {
    points: num(acc.points) - capped,
    expired_points: num(acc.expired_points) + capped,
  });
  nudgeTable("loyalty_accounts");
  return capped;
}

/* ============================================================ referrals */

export type ReferralConfig = {
  enabled: boolean;
  referrerReward: number;
  refereeReward: number;
  referrerPoints: number;
  refereePoints: number;
  minOrder: number;
  expiryDays: number;
  requireVerification: boolean;
  blockDuplicateDevice: boolean;
  maxReferralsPerUser: number;
};

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  enabled: true,
  referrerReward: 100,
  refereeReward: 50,
  referrerPoints: 100,
  refereePoints: 50,
  minOrder: 199,
  expiryDays: 30,
  requireVerification: true,
  blockDuplicateDevice: true,
  maxReferralsPerUser: 25,
};

export const referralCodeFor = (userId: string): string => {
  const id = userId || "guest";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `SCX${h.toString(36).toUpperCase().slice(0, 5).padStart(5, "0")}`;
};

export const listReferrals = (limit = 500) =>
  listTable<ReferralRow>("referrals", { order: "-created_at", limit });

export const listReferralRewards = (limit = 500) =>
  listTable<ReferralRewardRow>("referral_rewards", { order: "-created_at", limit });

export const listMyReferralRewards = (userId: string) =>
  listTable<ReferralRewardRow>("referral_rewards", { user_id: `eq.${userId}`, order: "-created_at", limit: 200 });

/**
 * Apply an invite code for a brand-new customer. Runs the full fraud gate:
 * self-referral, duplicate account, duplicate device, unknown code, cap.
 */
export async function applyReferralCode(input: {
  code: string;
  userId: string;
  name?: string;
  config: ReferralConfig;
  allUserIds?: string[];
}): Promise<{ ok: boolean; reason?: string; referral?: ReferralRow | null }> {
  const cfg = input.config;
  if (!cfg.enabled || !getAppSettings().referral_enabled)
    return { ok: false, reason: "Referral program is paused" };
  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, reason: "Enter a referral code" };
  if (!input.userId) return { ok: false, reason: "Sign in required" };
  if (referralCodeFor(input.userId) === code) return { ok: false, reason: "You can't refer yourself" };

  const existing = await listTable<ReferralRow>("referrals", {
    referred_id: `eq.${input.userId}`,
    limit: 1,
  });
  if (existing[0]) return { ok: false, reason: "A referral is already applied to this account" };

  const device = deviceHash();
  if (cfg.blockDuplicateDevice) {
    const sameDevice = await listTable<ReferralRow>("referrals", { device_hash: `eq.${device}`, limit: 5 });
    if (sameDevice.length) {
      await createRecord("referrals", {
        referral_code: code,
        referred_id: input.userId,
        referee_name: input.name ?? null,
        status: "rejected",
        device_hash: device,
        fraud_flag: "duplicate_device",
        blocked: true,
      });
      nudgeTable("referrals");
      return { ok: false, reason: "This device has already used a referral code" };
    }
  }

  // Resolve the referrer from the deterministic code across known users.
  const ids = input.allUserIds ?? (await listTable<{ id: string }>("users", { limit: 500 })).map((u) => u.id);
  const referrerId = ids.find((id) => referralCodeFor(id) === code) ?? null;
  if (!referrerId) return { ok: false, reason: "Invalid referral code" };
  if (referrerId === input.userId) return { ok: false, reason: "You can't refer yourself" };

  const theirs = await listTable<ReferralRow>("referrals", { referrer_id: `eq.${referrerId}`, limit: 100 });
  if (cfg.maxReferralsPerUser > 0 && theirs.length >= cfg.maxReferralsPerUser)
    return { ok: false, reason: "This code has reached its invite limit" };

  const row = await createRecord<ReferralRow>("referrals", {
    referral_code: code,
    referrer_id: referrerId,
    referred_id: input.userId,
    referee_name: input.name ?? null,
    reward_amount: cfg.referrerReward,
    points_awarded: 0,
    status: "pending",
    referee_verified: false,
    first_order_done: false,
    device_hash: device,
    blocked: false,
  });
  nudgeTable("referrals");
  await auditLoyalty({
    entity: "referral", entityId: row?.id, userId: input.userId,
    action: "applied", reason: `code ${code}`,
  });
  return { ok: true, referral: row };
}

export async function markRefereeVerified(userId: string) {
  const rows = await listTable<ReferralRow>("referrals", { referred_id: `eq.${userId}`, limit: 1 });
  const r = rows[0];
  if (!r?.id || r.referee_verified) return;
  await patchRecord("referrals", r.id, { referee_verified: true });
  nudgeTable("referrals");
}

/**
 * Complete a referral once the referee's first order is delivered.
 * Creates referral_rewards rows for both sides and pays them out.
 */
export async function completeReferralForOrder(input: {
  refereeId: string;
  orderId: string;
  orderTotal: number;
  config?: ReferralConfig;
}): Promise<ReferralRow | null> {
  const cfg = input.config ?? DEFAULT_REFERRAL_CONFIG;
  if (!cfg.enabled || !getAppSettings().referral_enabled) return null;

  const rows = await listTable<ReferralRow>("referrals", {
    referred_id: `eq.${input.refereeId}`,
    status: "eq.pending",
    limit: 1,
  });
  const ref = rows[0];
  if (!ref?.id || ref.blocked) return null;

  const created = ref.created_at ? new Date(ref.created_at).getTime() : Date.now();
  if (Date.now() - created > cfg.expiryDays * 86_400_000) {
    await patchRecord("referrals", ref.id, { status: "expired" });
    nudgeTable("referrals");
    return null;
  }
  if (input.orderTotal < cfg.minOrder) return null;
  if (cfg.requireVerification && !ref.referee_verified) {
    await patchRecord("referrals", ref.id, { referee_verified: true });
  }
  if (ref.referrer_id && ref.referrer_id === input.refereeId) {
    await patchRecord("referrals", ref.id, { status: "rejected", fraud_flag: "self_referral", blocked: true });
    nudgeTable("referrals");
    return null;
  }

  const sides: Array<{ side: "referrer" | "referee"; userId: string; amount: number; points: number }> = [];
  sides.push({ side: "referee", userId: input.refereeId, amount: cfg.refereeReward, points: cfg.refereePoints });
  if (ref.referrer_id)
    sides.push({ side: "referrer", userId: ref.referrer_id, amount: cfg.referrerReward, points: cfg.referrerPoints });

  for (const s of sides) {
    const reward = await createRecord<ReferralRewardRow>("referral_rewards", {
      referral_id: ref.id,
      user_id: s.userId,
      side: s.side,
      amount: s.amount,
      points: s.points,
      status: "paid",
      reason: `First order ${input.orderId}`,
      paid_at: nowIso(),
    });
    if (s.amount > 0)
      await creditWallet({
        userId: s.userId,
        amount: s.amount,
        kind: "referral_bonus",
        remark: `Referral bonus (${ref.referral_code ?? ""})`,
        meta: { referral_id: ref.id, reward_id: reward?.id },
      });
    if (s.points > 0)
      await earnPoints({
        userId: s.userId,
        points: s.points,
        reason: "Referral bonus",
        source: "referral",
      });
  }

  await patchRecord("referrals", ref.id, {
    status: "rewarded",
    first_order_done: true,
    order_id: input.orderId,
    rewarded_at: nowIso(),
    points_awarded: cfg.referrerPoints + cfg.refereePoints,
  });
  nudgeTable("referrals");
  nudgeTable("referral_rewards");
  await auditLoyalty({
    entity: "referral", entityId: ref.id, userId: input.refereeId,
    action: "rewarded", amount: cfg.referrerReward + cfg.refereeReward,
  });
  return { ...ref, status: "rewarded" };
}

export async function setReferralBlocked(id: string, blocked: boolean, reason: string, actorId?: string) {
  await patchRecord("referrals", id, {
    blocked,
    fraud_flag: blocked ? reason : null,
    status: blocked ? "rejected" : "pending",
  });
  nudgeTable("referrals");
  await auditLoyalty({ entity: "referral", entityId: id, actorId, action: blocked ? "blocked" : "unblocked", reason });
}

export type ReferralStats = {
  invited: number;
  signedUp: number;
  ordered: number;
  earned: number;
  pending: number;
  rejected: number;
};

export function referralStatsFor(userId: string, all: ReferralRow[], rewards: ReferralRewardRow[]): ReferralStats {
  const code = referralCodeFor(userId);
  const mine = all.filter((r) => r.referrer_id === userId || r.referral_code === code);
  const myRewards = rewards.filter((r) => r.user_id === userId && r.side === "referrer");
  return {
    invited: mine.length,
    signedUp: mine.filter((r) => r.referee_verified).length,
    ordered: mine.filter((r) => r.first_order_done).length,
    earned: myRewards.filter((r) => r.status === "paid").reduce((s, r) => s + num(r.amount), 0),
    pending: mine.filter((r) => r.status === "pending").length,
    rejected: mine.filter((r) => r.status === "rejected" || r.blocked).length,
  };
}

/* ============================================================ scratch cards */

export const listMyScratchCards = (userId: string) =>
  listTable<ScratchCardRow>("scratch_cards", { user_id: `eq.${userId}`, order: "-created_at", limit: 100 });

export const listAllScratchCards = (limit = 300) =>
  listTable<ScratchCardRow>("scratch_cards", { order: "-created_at", limit });

function pickCampaign(campaigns: RewardCampaignRow[], level: LoyaltyLevel): RewardCampaignRow | null {
  const now = Date.now();
  const eligible = campaigns.filter((c) => {
    if (!c.active) return false;
    if (c.type && c.type !== "scratch" && c.type !== "festival" && c.type !== "birthday") return false;
    if (c.starts_at && new Date(c.starts_at).getTime() > now) return false;
    if (c.ends_at && new Date(c.ends_at).getTime() < now) return false;
    if (num(c.usage_limit) > 0 && num(c.issued_count) >= num(c.usage_limit)) return false;
    if (num(c.budget) > 0 && num(c.spent) >= num(c.budget)) return false;
    const min = LEVELS.findIndex((l) => l.id === (c.min_level ?? "bronze"));
    const cur = LEVELS.findIndex((l) => l.id === level);
    return cur >= min;
  });
  if (!eligible.length) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/** Issue a scratch card for a delivered order (idempotent per order). */
export async function issueScratchCard(input: {
  userId: string;
  orderId: string;
  restaurantId?: string | null;
}): Promise<ScratchCardRow | null> {
  if (!getAppSettings().scratch_enabled) return null;
  if (!input.userId || !input.orderId) return null;

  const existing = await listTable<ScratchCardRow>("scratch_cards", { order_id: `eq.${input.orderId}`, limit: 1 });
  if (existing[0]) return existing[0];

  const [campaigns, summary] = await Promise.all([
    listRewardCampaigns(),
    getLoyaltySummary(input.userId),
  ]);
  const campaign = pickCampaign(campaigns, summary.level.id);

  const kind = campaign?.reward_kind ?? (["wallet", "points", "free_delivery"] as const)[Math.floor(Math.random() * 3)];
  const min = num(campaign?.reward_min, 10);
  const max = num(campaign?.reward_max, 60);
  const value = kind === "wallet" ? Math.max(min, Math.round(min + Math.random() * Math.max(0, max - min))) : 0;
  const points = kind === "points" ? Math.max(10, num(campaign?.points, 25)) : 0;

  const title =
    kind === "wallet" ? `₹${value} wallet cashback`
    : kind === "points" ? `${points} loyalty points`
    : kind === "coupon" ? `Coupon ${campaign?.coupon_code ?? "SCOOBIX"}`
    : "Free delivery on your next order";

  const card = await createRecord<ScratchCardRow>("scratch_cards", {
    user_id: input.userId,
    customer_id: input.userId,
    order_id: input.orderId,
    title,
    subtitle: campaign?.sponsor_name ? `Sponsored by ${campaign.sponsor_name}` : "Scratch to reveal",
    reward_type: kind,
    reward_value: value,
    points,
    coupon_code: kind === "coupon" ? campaign?.coupon_code ?? `SCX${rand(5)}` : null,
    status: "locked",
    active: true,
    used: false,
    usage_limit: 1,
    campaign_id: campaign?.id ?? null,
    restaurant_id: input.restaurantId ?? campaign?.sponsor_restaurant_id ?? null,
    issued_at: nowIso(),
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });

  if (campaign?.id)
    await patchRecord("reward_campaigns", campaign.id, { issued_count: num(campaign.issued_count) + 1 });

  nudgeTable("scratch_cards");
  return card;
}

/** Reveal a card and pay the reward out. Idempotent. */
export async function scratchCard(cardId: string, userId: string): Promise<{ ok: boolean; reason?: string; card?: ScratchCardRow }> {
  const rows = await listTable<ScratchCardRow>("scratch_cards", { id: `eq.${cardId}`, limit: 1 });
  const card = rows[0];
  if (!card) return { ok: false, reason: "Card not found" };
  if (card.status === "scratched" || card.used) return { ok: true, card };
  if (card.expires_at && new Date(card.expires_at).getTime() < Date.now()) {
    await patchRecord("scratch_cards", card.id, { status: "expired" });
    return { ok: false, reason: "This card has expired" };
  }

  const kind = String(card.reward_type ?? "wallet");
  if (kind === "wallet" && num(card.reward_value) > 0) {
    await creditWallet({
      userId,
      amount: num(card.reward_value),
      kind: "scratch_reward",
      remark: card.title ?? "Scratch card reward",
      orderId: card.order_id ?? null,
      meta: { scratch_card_id: card.id },
    });
  } else if (kind === "points" && num(card.points) > 0) {
    await earnPoints({
      userId, points: num(card.points), reason: card.title ?? "Scratch card", source: "scratch",
      campaignId: card.campaign_id ?? null,
    });
  } else if (kind === "free_delivery" || kind === "coupon") {
    await createRecord("reward_redemptions", {
      user_id: userId,
      title: card.title ?? "Scratch reward",
      kind: kind === "coupon" ? "coupon" : "free_delivery",
      value: num(card.reward_value),
      code: card.coupon_code ?? `SCX${rand(5)}`,
      points_spent: 0,
      status: "issued",
      expires_at: card.expires_at ?? null,
    });
    nudgeTable("reward_redemptions");
  }

  if (card.campaign_id) {
    const c = (await listTable<RewardCampaignRow>("reward_campaigns", { id: `eq.${card.campaign_id}`, limit: 1 }))[0];
    if (c?.id) await patchRecord("reward_campaigns", c.id, { spent: num(c.spent) + num(card.reward_value) });
  }

  await patchRecord("scratch_cards", card.id, { status: "scratched", scratched_at: nowIso(), used: true });
  nudgeTable("scratch_cards");
  await auditLoyalty({
    entity: "scratch_card", entityId: card.id, userId, action: "scratched",
    amount: num(card.reward_value), points: num(card.points), reason: card.title ?? "",
  });
  return { ok: true, card: { ...card, status: "scratched" } };
}

/* ============================================================ reward store */

export const listRewardStore = (limit = 100) =>
  listTable<RewardStoreItem>("reward_store", { order: "-created_at", limit });

export const listMyRedemptions = (userId: string) =>
  listTable<RewardRedemptionRow>("reward_redemptions", { user_id: `eq.${userId}`, order: "-created_at", limit: 100 });

export const listAllRedemptions = (limit = 300) =>
  listTable<RewardRedemptionRow>("reward_redemptions", { order: "-created_at", limit });

export const createRewardItem = async (patch: Partial<RewardStoreItem>) => {
  const row = await createRecord<RewardStoreItem>("reward_store", { active: true, redeemed_count: 0, ...patch });
  nudgeTable("reward_store");
  return row;
};

export const updateRewardItem = async (id: string, patch: Partial<RewardStoreItem>) => {
  await patchRecord("reward_store", id, patch as Record<string, unknown>);
  nudgeTable("reward_store");
};

export const deleteRewardItem = async (id: string) => {
  await deleteRecord("reward_store", id);
  nudgeTable("reward_store");
};

export async function redeemStoreItem(input: {
  userId: string;
  item: RewardStoreItem;
}): Promise<{ ok: boolean; reason?: string; code?: string }> {
  const { userId, item } = input;
  if (!userId) return { ok: false, reason: "Sign in required" };
  if (!item.active) return { ok: false, reason: "Reward unavailable" };
  if (num(item.stock) > 0 && num(item.redeemed_count) >= num(item.stock))
    return { ok: false, reason: "Out of stock" };
  if (item.expires_at && new Date(item.expires_at).getTime() < Date.now())
    return { ok: false, reason: "Reward expired" };

  const summary = await getLoyaltySummary(userId);
  const minIdx = LEVELS.findIndex((l) => l.id === (item.min_level ?? "bronze"));
  const curIdx = LEVELS.findIndex((l) => l.id === summary.level.id);
  if (curIdx < minIdx) return { ok: false, reason: `${levelSpec(item.min_level).name} level required` };

  const cost = num(item.cost_points);
  const spend = await redeemPoints({ userId, points: cost, reason: `Redeemed ${item.title ?? "reward"}` });
  if (!spend.ok) return { ok: false, reason: spend.reason };

  const code = item.coupon_code || `SCX${rand(6)}`;
  await createRecord("reward_redemptions", {
    item_id: item.id,
    user_id: userId,
    title: item.title,
    kind: item.kind,
    value: num(item.value),
    points_spent: cost,
    code,
    status: "issued",
    expires_at: item.expires_at ?? new Date(Date.now() + 60 * 86_400_000).toISOString(),
  });
  await patchRecord("reward_store", item.id, { redeemed_count: num(item.redeemed_count) + 1 });

  if (item.kind === "wallet" && num(item.value) > 0) {
    await creditWallet({
      userId,
      amount: num(item.value),
      kind: "reward_redemption",
      remark: `Reward store · ${item.title ?? "wallet credit"}`,
      bucket: "promo",
    });
  }

  nudgeTable("reward_redemptions");
  nudgeTable("reward_store");
  await auditLoyalty({
    entity: "reward_store", entityId: item.id, userId, action: "redeemed",
    points: cost, amount: num(item.value), reason: item.title ?? "",
  });
  return { ok: true, code };
}

/* ============================================================ campaigns */

export const listRewardCampaigns = (limit = 200) =>
  listTable<RewardCampaignRow>("reward_campaigns", { order: "-created_at", limit });

export const createRewardCampaign = async (patch: Partial<RewardCampaignRow>) => {
  const row = await createRecord<RewardCampaignRow>("reward_campaigns", {
    active: true, issued_count: 0, spent: 0, ...patch,
  });
  nudgeTable("reward_campaigns");
  await auditLoyalty({ entity: "reward_campaign", entityId: row?.id, action: "created", reason: String(patch.name ?? "") });
  return row;
};

export const updateRewardCampaign = async (id: string, patch: Partial<RewardCampaignRow>) => {
  await patchRecord("reward_campaigns", id, patch as Record<string, unknown>);
  nudgeTable("reward_campaigns");
};

export const deleteRewardCampaign = async (id: string) => {
  await deleteRecord("reward_campaigns", id);
  nudgeTable("reward_campaigns");
};

/* ============================================================ analytics */

export type RewardAnalytics = {
  walletBalanceTotal: number;
  walletCredited: number;
  walletDebited: number;
  walletUsers: number;
  pointsOutstanding: number;
  pointsIssued: number;
  pointsRedeemed: number;
  levelDistribution: Record<LoyaltyLevel, number>;
  referralsTotal: number;
  referralsRewarded: number;
  referralsBlocked: number;
  referralGrowth: Array<{ day: string; count: number }>;
  rewardCost: number;
  redemptionCount: number;
  scratchIssued: number;
  scratchScratched: number;
  campaignRoi: Array<{ id: string; name: string; spent: number; issued: number; budget: number; roiPct: number }>;
  repeatOrderRate: number;
  retainedCustomers: number;
};

export async function computeRewardAnalytics(): Promise<RewardAnalytics> {
  const [wallets, txns, accounts, points, refs, redemptions, cards, campaigns, orders] = await Promise.all([
    listWallets(),
    listTable<WalletTxnRow>("wallet_transactions", { order: "-created_at", limit: 500 }),
    listLoyaltyAccounts(),
    listAllPoints(),
    listReferrals(),
    listAllRedemptions(),
    listAllScratchCards(),
    listRewardCampaigns(),
    listTable<{ customer_id?: string; created_at?: string }>("orders", { order: "-created_at", limit: 500 }),
  ]);

  const levelDistribution = LEVELS.reduce(
    (acc, l) => ({ ...acc, [l.id]: 0 }),
    {} as Record<LoyaltyLevel, number>,
  );
  for (const a of accounts) levelDistribution[(a.level as LoyaltyLevel) ?? "bronze"] += 1;

  const growthMap = new Map<string, number>();
  for (const r of refs) {
    const d = (r.created_at ?? "").slice(0, 10);
    if (d) growthMap.set(d, (growthMap.get(d) ?? 0) + 1);
  }
  const referralGrowth = [...growthMap.entries()].sort().slice(-14).map(([day, count]) => ({ day, count }));

  const orderCounts = new Map<string, number>();
  for (const o of orders) {
    const c = String(o.customer_id ?? "");
    if (c) orderCounts.set(c, (orderCounts.get(c) ?? 0) + 1);
  }
  const repeat = [...orderCounts.values()].filter((n) => n > 1).length;

  const rewardCost =
    redemptions.reduce((s, r) => s + num(r.value), 0) +
    cards.filter((c) => c.status === "scratched").reduce((s, c) => s + num(c.reward_value), 0) +
    txns.filter((t) => String(t.kind ?? t.transaction_type) === "referral_bonus").reduce((s, t) => s + Math.abs(num(t.amount)), 0);

  return {
    walletBalanceTotal: wallets.reduce((s, w) => s + num(w.balance), 0),
    walletCredited: txns.filter((t) => num(t.amount) > 0).reduce((s, t) => s + num(t.amount), 0),
    walletDebited: txns.filter((t) => num(t.amount) < 0).reduce((s, t) => s - num(t.amount), 0),
    walletUsers: wallets.filter((w) => num(w.balance) > 0).length,
    pointsOutstanding: accounts.reduce((s, a) => s + num(a.points), 0),
    pointsIssued: points.filter((p) => p.direction === "earn").reduce((s, p) => s + num(p.points), 0),
    pointsRedeemed: points.filter((p) => p.direction === "redeem").reduce((s, p) => s + num(p.points), 0),
    levelDistribution,
    referralsTotal: refs.length,
    referralsRewarded: refs.filter((r) => r.status === "rewarded").length,
    referralsBlocked: refs.filter((r) => r.blocked || r.status === "rejected").length,
    referralGrowth,
    rewardCost,
    redemptionCount: redemptions.length,
    scratchIssued: cards.length,
    scratchScratched: cards.filter((c) => c.status === "scratched").length,
    campaignRoi: campaigns.map((c) => ({
      id: c.id,
      name: c.name ?? "Campaign",
      spent: num(c.spent),
      issued: num(c.issued_count),
      budget: num(c.budget),
      roiPct: num(c.budget) > 0 ? Math.round((num(c.spent) / num(c.budget)) * 100) : 0,
    })),
    repeatOrderRate: orderCounts.size ? Math.round((repeat / orderCounts.size) * 100) : 0,
    retainedCustomers: repeat,
  };
}
