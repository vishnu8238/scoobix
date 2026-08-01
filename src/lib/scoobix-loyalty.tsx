/**
 * Scoobix loyalty providers — Wallet, Loyalty points/levels, Referrals and
 * the Rewards store.
 *
 * Every value comes from InsForge via `loyalty-engine`. There is no
 * localStorage business state and no mock data anywhere in this module.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-store";
import { getAppSettings } from "./app-settings";
import { kvGet, kvSet } from "./kv-store";
import { listTable } from "./insforge-crud";
import { useTableFeed } from "./realtime-hooks";
import {
  DEFAULT_REFERRAL_CONFIG,
  LEVELS,
  applyReferralCode,
  computeRewardAnalytics,
  creditWallet,
  debitWallet,
  ensureWallet,
  ensureLoyaltyAccount,
  earnPoints,
  getLoyaltySummary,
  issueScratchCard,
  levelForPoints,
  listAllWalletTransactions,
  listMyRedemptions,
  listMyReferralRewards,
  listMyScratchCards,
  listPointsHistory,
  listReferralRewards,
  listReferrals,
  listRewardStore,
  listWallets,
  nextLevel,
  redeemStoreItem,
  referralCodeFor,
  referralStatsFor,
  scratchCard,
  setWalletBlocked,
  sweepExpiredPoints,
  type LoyaltyLedgerRow,
  type LoyaltySummary,
  type ReferralConfig,
  type ReferralRewardRow,
  type ReferralRow,
  type ReferralStats,
  type RewardAnalytics,
  type RewardRedemptionRow,
  type RewardStoreItem,
  type ScratchCardRow,
  type TxnKind,
  type WalletSummary,
  type WalletTxnRow,
} from "./loyalty-engine";

export {
  LEVELS,
  TXN_LABEL,
  TXN_KINDS,
  levelForPoints,
  levelSpec,
  nextLevel,
  referralCodeFor,
  computeRewardAnalytics,
  listRewardCampaigns,
  createRewardCampaign,
  updateRewardCampaign,
  deleteRewardCampaign,
  createRewardItem,
  updateRewardItem,
  deleteRewardItem,
  listAuditLogs,
  listAllScratchCards,
  listAllRedemptions,
  listLoyaltyAccounts,
  setReferralBlocked,
  issueScratchCard,
  earnPoints,
  redeemPoints,
  setWalletBlocked,
} from "./loyalty-engine";
export type {
  LevelSpec,
  LoyaltyLevel,
  LoyaltySummary,
  RewardAnalytics,
  RewardCampaignRow,
  RewardRedemptionRow,
  RewardStoreItem,
  ReferralRow,
  ReferralRewardRow,
  ScratchCardRow,
  TxnKind,
  WalletTxnRow,
} from "./loyalty-engine";

/* ============================================================
   WALLET
   ============================================================ */

export type WalletTxn = {
  id: string;
  customerId: string;
  amount: number;
  kind: TxnKind;
  note: string;
  code: string;
  bucket: string;
  status: string;
  balanceAfter: number;
  orderId?: string;
  createdAt: number;
};

const toTxn = (r: WalletTxnRow): WalletTxn => ({
  id: r.id,
  customerId: r.user_id ?? "",
  amount: Number(r.amount ?? 0),
  kind: ((r.kind ?? r.transaction_type) as TxnKind) ?? "credit",
  note: r.remark ?? r.description ?? "",
  code: r.txn_code ?? r.id.slice(0, 8).toUpperCase(),
  bucket: r.bucket ?? "main",
  status: r.status ?? "success",
  balanceAfter: Number(r.balance_after ?? 0),
  orderId: r.order_id ?? undefined,
  createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
});

type WalletCtx = {
  balance: (customerId: string) => number;
  blocked: (customerId: string) => boolean;
  txns: (customerId: string) => WalletTxn[];
  allTxns: WalletTxn[];
  wallets: Array<{ userId: string; balance: number; blocked: boolean; buckets: Record<string, number> }>;
  refresh: () => void;
  credit: (customerId: string, amount: number, kind: TxnKind, note: string, orderId?: string) => Promise<{ ok: boolean; reason?: string }>;
  debit: (customerId: string, amount: number, kind: TxnKind, note: string, orderId?: string) => Promise<{ ok: boolean; reason?: string }>;
  block: (customerId: string, blocked: boolean, reason: string) => Promise<void>;
};

const WalletContext = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [wallets, setWallets] = useState<WalletCtx["wallets"]>([]);

  const load = useCallback(async () => {
    const [rows, walletRows] = await Promise.all([listAllWalletTransactions(), listWallets()]);
    setTxns(rows.map(toTxn));
    setWallets(
      walletRows.map((w) => ({
        userId: w.user_id ?? "",
        balance: Number(w.balance ?? 0),
        blocked: Boolean(w.blocked),
        buckets: {
          cashback: Number(w.cashback_credits ?? 0),
          promo: Number(w.promo_credits ?? 0),
          refund: Number(w.refund_credits ?? 0),
          referral: Number(w.referral_credits ?? 0),
        },
      })),
    );
  }, []);

  useEffect(() => { void load(); }, [load]);
  // Live: any wallet write from any client refreshes the ledger.
  useTableFeed("wallet_transactions", () => { void load(); });
  useTableFeed("wallet", () => { void load(); });

  useEffect(() => { if (user?.id) void ensureWallet(user.id); }, [user?.id]);

  const balanceOf = (cid: string) => wallets.find((w) => w.userId === cid)?.balance ?? 0;

  const credit: WalletCtx["credit"] = async (customerId, amount, kind, note, orderId) => {
    if (!getAppSettings().wallet_enabled) return { ok: false, reason: "Wallet disabled" };
    const res = await creditWallet({ userId: customerId, amount, kind, remark: note, orderId, actorId: user?.id });
    await load();
    return { ok: res.ok, reason: res.reason };
  };

  const debit: WalletCtx["debit"] = async (customerId, amount, kind, note, orderId) => {
    if (!getAppSettings().wallet_enabled) return { ok: false, reason: "Wallet disabled" };
    const res = await debitWallet({ userId: customerId, amount, kind, remark: note, orderId, actorId: user?.id });
    await load();
    return { ok: res.ok, reason: res.reason };
  };

  const value: WalletCtx = {
    balance: balanceOf,
    blocked: (cid) => wallets.find((w) => w.userId === cid)?.blocked ?? false,
    txns: (cid) => txns.filter((t) => t.customerId === cid),
    allTxns: txns,
    wallets,
    refresh: () => void load(),
    credit,
    debit,
    block: async (cid, blocked, reason) => {
      await setWalletBlocked(cid, blocked, reason, user?.id);
      await load();
    },
  };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export const useWallet = () => {
  const c = useContext(WalletContext);
  if (!c) throw new Error("useWallet must be used within WalletProvider");
  return c;
};

/** Current-user wallet: balance, bucket split and history. */
export const useMyWallet = () => {
  const { user } = useAuth();
  const wallet = useWallet();
  const cid = user?.id ?? "";
  const [summary, setSummary] = useState<WalletSummary | null>(null);

  const reload = useCallback(() => {
    if (!cid) { setSummary(null); return; }
    void getWalletSummaryCached(cid).then(setSummary);
  }, [cid]);

  useEffect(() => { reload(); }, [reload, wallet.allTxns.length]);

  return {
    balance: summary?.balance ?? (cid ? wallet.balance(cid) : 0),
    buckets: summary?.buckets ?? { cashback: 0, promo: 0, refund: 0, referral: 0 },
    lifetimeCredited: summary?.lifetimeCredited ?? 0,
    lifetimeDebited: summary?.lifetimeDebited ?? 0,
    blocked: summary?.blocked ?? false,
    blockReason: summary?.blockReason ?? "",
    txns: cid ? wallet.txns(cid) : [],
    refresh: reload,
    credit: (amt: number, kind: TxnKind, note: string, orderId?: string) =>
      wallet.credit(cid, amt, kind, note, orderId),
    debit: (amt: number, kind: TxnKind, note: string, orderId?: string) =>
      cid ? wallet.debit(cid, amt, kind, note, orderId) : Promise.resolve({ ok: false, reason: "Sign in required" }),
  };
};

async function getWalletSummaryCached(userId: string) {
  const { getWalletSummary } = await import("./loyalty-engine");
  return getWalletSummary(userId);
}

/* ============================================================
   LOYALTY POINTS + LEVELS
   ============================================================ */

type LoyaltyCtx = {
  summary: LoyaltySummary | null;
  history: LoyaltyLedgerRow[];
  store: RewardStoreItem[];
  redemptions: RewardRedemptionRow[];
  cards: ScratchCardRow[];
  loading: boolean;
  refresh: () => Promise<void>;
  redeem: (item: RewardStoreItem) => Promise<{ ok: boolean; reason?: string; code?: string }>;
  scratch: (cardId: string) => Promise<{ ok: boolean; reason?: string }>;
};

const LoyaltyContext = createContext<LoyaltyCtx | null>(null);

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const [summary, setSummary] = useState<LoyaltySummary | null>(null);
  const [history, setHistory] = useState<LoyaltyLedgerRow[]>([]);
  const [store, setStore] = useState<RewardStoreItem[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemptionRow[]>([]);
  const [cards, setCards] = useState<ScratchCardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const catalogue = await listRewardStore();
    setStore(catalogue.filter((i) => i.active !== false));
    if (!uid) { setSummary(null); setHistory([]); setRedemptions([]); setCards([]); setLoading(false); return; }
    await ensureLoyaltyAccount(uid);
    await sweepExpiredPoints(uid);
    const [s, h, r, c] = await Promise.all([
      getLoyaltySummary(uid),
      listPointsHistory(uid),
      listMyRedemptions(uid),
      listMyScratchCards(uid),
    ]);
    setSummary(s);
    setHistory(h);
    setRedemptions(r);
    setCards(c);
    setLoading(false);
  }, [uid]);

  useEffect(() => { void refresh(); }, [refresh]);
  useTableFeed("loyalty_accounts", () => { void refresh(); });
  useTableFeed("scratch_cards", () => { void refresh(); });
  useTableFeed("reward_store", () => { void refresh(); });

  const value: LoyaltyCtx = {
    summary, history, store, redemptions, cards, loading,
    refresh,
    redeem: async (item) => {
      const res = await redeemStoreItem({ userId: uid, item });
      await refresh();
      return res;
    },
    scratch: async (cardId) => {
      const res = await scratchCard(cardId, uid);
      await refresh();
      return { ok: res.ok, reason: res.reason };
    },
  };
  return <LoyaltyContext.Provider value={value}>{children}</LoyaltyContext.Provider>;
}

export const useLoyalty = () => {
  const c = useContext(LoyaltyContext);
  if (!c) throw new Error("useLoyalty must be used within LoyaltyProvider");
  return c;
};

/* ============================================================
   REFERRAL PROGRAM
   ============================================================ */

type ReferralCtx = {
  config: ReferralConfig;
  updateConfig: (patch: Partial<ReferralConfig>) => void;
  codeFor: (customerId: string) => string;
  records: ReferralRow[];
  rewards: ReferralRewardRow[];
  names: Record<string, string>;
  refresh: () => Promise<void>;
  applyCode: (code: string) => Promise<{ ok: boolean; reason?: string }>;
  statsFor: (customerId: string) => ReferralStats;
};

const ReferralContext = createContext<ReferralCtx | null>(null);

export function ReferralProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<ReferralConfig>(DEFAULT_REFERRAL_CONFIG);
  const [records, setRecords] = useState<ReferralRow[]>([]);
  const [rewards, setRewards] = useState<ReferralRewardRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const [cfg, rows, rw, users] = await Promise.all([
      kvGet<ReferralConfig>("referral_config"),
      listReferrals(),
      listReferralRewards(),
      listTable<{ id: string; name?: string; email?: string }>("users", { limit: 500 }),
    ]);
    if (cfg) setConfig({ ...DEFAULT_REFERRAL_CONFIG, ...cfg });
    const map: Record<string, string> = {};
    for (const u of users) map[u.id] = u.name || u.email || u.id.slice(0, 8);
    setNames(map);
    setRecords(rows);
    setRewards(rw);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useTableFeed("referrals", () => { void refresh(); });
  useTableFeed("referral_rewards", () => { void refresh(); });

  const updateConfig: ReferralCtx["updateConfig"] = (patch) =>
    setConfig((c) => {
      const next = { ...c, ...patch };
      void kvSet("referral_config", next);
      return next;
    });

  const value = useMemo<ReferralCtx>(
    () => ({
      config,
      updateConfig,
      codeFor: (cid) => referralCodeFor(cid || "guest"),
      records,
      rewards,
      names,
      refresh,
      applyCode: async (code) => {
        const res = await applyReferralCode({
          code,
          userId: user?.id ?? "",
          name: user?.name ?? undefined,
          config,
        });
        await refresh();
        return { ok: res.ok, reason: res.reason };
      },
      statsFor: (cid) => referralStatsFor(cid, records, rewards),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, records, rewards, names, user?.id, refresh],
  );

  return <ReferralContext.Provider value={value}>{children}</ReferralContext.Provider>;
}

export const useReferral = () => {
  const c = useContext(ReferralContext);
  if (!c) throw new Error("useReferral must be used within ReferralProvider");
  return c;
};

/** My referral rewards (pending / paid / rejected). */
export const useMyReferralRewards = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReferralRewardRow[]>([]);
  useEffect(() => {
    if (!user?.id) { setRows([]); return; }
    void listMyReferralRewards(user.id).then(setRows);
  }, [user?.id]);
  return rows;
};

/** Platform-wide reward analytics (admin / manager surfaces). */
export const useRewardAnalytics = () => {
  const [data, setData] = useState<RewardAnalytics | null>(null);
  useEffect(() => { void computeRewardAnalytics().then(setData); }, []);
  return data;
};

/* ============================================================
   Combined
   ============================================================ */

export function ScoobixLoyaltyProviders({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <LoyaltyProvider>
        <ReferralProvider>{children}</ReferralProvider>
      </LoyaltyProvider>
    </WalletProvider>
  );
}

/** Public helper — build a QR image URL from any string (no dependency). */
export const qrUrl = (data: string, size = 220) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;

/** Level ladder helper for UI badges. */
export const levelNames = LEVELS.map((l) => l.name);
export { nextLevel as nextLoyaltyLevel };
