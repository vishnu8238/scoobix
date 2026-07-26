/**
 * Scoobix loyalty — Wallet + Referral program.
 *
 * Fully backend backed:
 *  - wallet / wallet_transactions tables via `wallet-api`
 *  - referrals table
 *  - program configuration in `app_settings` (kv row `referral_config`)
 *
 * No localStorage anywhere in this module.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./auth-store";
import { getAppSettings } from "./app-settings";
import { kvGet, kvSet } from "./kv-store";
import { listTable, createRecord, patchRecord } from "./insforge-crud";
import {
  creditWallet,
  debitWallet,
  getWallet,
  listAllTransactions,
  type TxnKind,
} from "./wallet-api";

const uid = () => Math.random().toString(36).slice(2, 10);

/* ============================================================
   WALLET
   ============================================================ */

export type WalletTxn = {
  id: string;
  customerId: string;
  amount: number; // positive = credit, negative = debit
  kind: TxnKind;
  note: string;
  createdAt: number;
};

type WalletCtx = {
  balance: (customerId: string) => number;
  txns: (customerId: string) => WalletTxn[];
  allTxns: WalletTxn[];
  refresh: () => void;
  credit: (customerId: string, amount: number, kind: TxnKind, note: string, orderId?: string) => WalletTxn;
  debit: (
    customerId: string,
    amount: number,
    kind: TxnKind,
    note: string,
    orderId?: string,
  ) => { ok: boolean; txn?: WalletTxn; reason?: string };
};

const WalletContext = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const rows = await listAllTransactions();
    setTxns(
      rows.map((r) => ({
        id: r.id ?? uid(),
        customerId: r.user_id ?? "",
        amount: Number(r.amount ?? 0),
        kind: (r.transaction_type as TxnKind) ?? "credit",
        note: r.description ?? "",
        createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      })),
    );
    const wallets = await listTable<{ user_id?: string; balance?: number }>("wallet", { limit: 500 });
    const map: Record<string, number> = {};
    for (const w of wallets) if (w.user_id) map[w.user_id] = Number(w.balance ?? 0);
    setBalances(map);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const balanceOf = (cid: string) => balances[cid] ?? 0;

  const credit: WalletCtx["credit"] = (customerId, amount, kind, note, orderId) => {
    const stub: WalletTxn = { id: uid(), customerId, amount: Math.abs(amount), kind, note, createdAt: Date.now() };
    if (!getAppSettings().wallet_enabled) return { ...stub, amount: 0 };
    setTxns((p) => [stub, ...p]);
    setBalances((b) => ({ ...b, [customerId]: (b[customerId] ?? 0) + Math.abs(amount) }));
    void creditWallet(customerId, amount, kind, note, orderId).then(() => void load());
    return stub;
  };

  const debit: WalletCtx["debit"] = (customerId, amount, kind, note, orderId) => {
    if (!getAppSettings().wallet_enabled) return { ok: false, reason: "Wallet disabled" };
    const amt = Math.abs(amount);
    if (balanceOf(customerId) < amt) return { ok: false, reason: "Insufficient wallet balance" };
    const txn: WalletTxn = { id: uid(), customerId, amount: -amt, kind, note, createdAt: Date.now() };
    setTxns((p) => [txn, ...p]);
    setBalances((b) => ({ ...b, [customerId]: (b[customerId] ?? 0) - amt }));
    void debitWallet(customerId, amount, kind, note, orderId).then(() => void load());
    return { ok: true, txn };
  };

  const value: WalletCtx = {
    balance: balanceOf,
    txns: (cid) => txns.filter((t) => t.customerId === cid),
    allTxns: txns,
    refresh: () => void load(),
    credit,
    debit,
  };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export const useWallet = () => {
  const c = useContext(WalletContext);
  if (!c) throw new Error("useWallet must be used within WalletProvider");
  return c;
};

/** Convenience: current-user wallet balance (ensures the wallet row exists). */
export const useMyWallet = () => {
  const { user } = useAuth();
  const wallet = useWallet();
  const cid = user?.id ?? "";

  useEffect(() => {
    if (cid) void getWallet(cid);
  }, [cid]);

  return {
    balance: cid ? wallet.balance(cid) : 0,
    txns: cid ? wallet.txns(cid) : [],
    credit: (amt: number, kind: TxnKind, note: string, orderId?: string) =>
      wallet.credit(cid, amt, kind, note, orderId),
    debit: (amt: number, kind: TxnKind, note: string, orderId?: string) =>
      cid ? wallet.debit(cid, amt, kind, note, orderId) : { ok: false, reason: "Sign in required" },
  };
};

/* ============================================================
   REFERRAL PROGRAM
   ============================================================ */

export type ReferralConfig = {
  enabled: boolean;
  referrerReward: number;
  refereeReward: number;
  minOrder: number;
  expiryDays: number;
};

export type ReferralRecord = {
  id: string;
  code: string;
  referrerId: string;
  refereeId: string;
  refereeName: string;
  status: "pending" | "rewarded" | "expired";
  createdAt: number;
  rewardedAt?: number;
};

type ReferralCtx = {
  config: ReferralConfig;
  updateConfig: (patch: Partial<ReferralConfig>) => void;
  codeFor: (customerId: string) => string;
  records: ReferralRecord[];
  registerReferral: (code: string, referee: { id: string; name: string }) => { ok: boolean; reason?: string };
  completeReferral: (
    refereeId: string,
    orderTotal: number,
    credit: (customerId: string, amt: number, kind: TxnKind, note: string) => WalletTxn,
  ) => ReferralRecord | null;
  statsFor: (customerId: string) => { total: number; rewarded: number; pending: number; earned: number };
};

const ReferralContext = createContext<ReferralCtx | null>(null);

const DEFAULT_CONFIG: ReferralConfig = {
  enabled: true,
  referrerReward: 100,
  refereeReward: 50,
  minOrder: 199,
  expiryDays: 30,
};

const codeFromId = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `SCX${h.toString(36).toUpperCase().slice(0, 5).padStart(5, "0")}`;
};

type ReferralRow = {
  id?: string;
  referrer_id?: string;
  referred_id?: string;
  referral_code?: string;
  reward_amount?: number;
  status?: ReferralRecord["status"];
  created_at?: string;
};

export function ReferralProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ReferralConfig>(DEFAULT_CONFIG);
  const [records, setRecords] = useState<ReferralRecord[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cfg, rows, users] = await Promise.all([
        kvGet<ReferralConfig>("referral_config"),
        listTable<ReferralRow>("referrals", { order: "-created_at", limit: 500 }),
        listTable<{ id: string; name?: string; email?: string }>("users", { limit: 500 }),
      ]);
      if (cancelled) return;
      if (cfg) setConfig({ ...DEFAULT_CONFIG, ...cfg });
      const nameMap: Record<string, string> = {};
      for (const u of users) nameMap[u.id] = u.name || u.email || u.id.slice(0, 8);
      setNames(nameMap);
      setRecords(
        rows.map((r) => ({
          id: r.id ?? uid(),
          code: r.referral_code ?? "",
          referrerId: r.referrer_id ?? "",
          refereeId: r.referred_id ?? "",
          refereeName: nameMap[r.referred_id ?? ""] ?? "Customer",
          status: r.status ?? "pending",
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateConfig: ReferralCtx["updateConfig"] = (patch) =>
    setConfig((c) => {
      const next = { ...c, ...patch };
      void kvSet("referral_config", next);
      return next;
    });

  const codeFor: ReferralCtx["codeFor"] = (cid) => codeFromId(cid || "guest");

  const registerReferral: ReferralCtx["registerReferral"] = (code, referee) => {
    if (!getAppSettings().referral_enabled) return { ok: false, reason: "Referral program is disabled" };
    if (!config.enabled) return { ok: false, reason: "Referral program is disabled" };
    const normalised = code.trim().toUpperCase();
    if (!normalised) return { ok: false, reason: "Enter a referral code" };
    if (codeFor(referee.id) === normalised) return { ok: false, reason: "You can't refer yourself" };
    if (records.some((r) => r.refereeId === referee.id))
      return { ok: false, reason: "Referral already applied for this account" };
    const rec: ReferralRecord = {
      id: uid(),
      code: normalised,
      referrerId: "",
      refereeId: referee.id,
      refereeName: referee.name,
      status: "pending",
      createdAt: Date.now(),
    };
    setRecords((p) => [rec, ...p]);
    void createRecord<ReferralRow>("referrals", {
      referral_code: normalised,
      referred_id: referee.id,
      reward_amount: config.referrerReward,
      status: "pending",
    }).then((row) => {
      if (row?.id) setRecords((p) => p.map((r) => (r.id === rec.id ? { ...r, id: row.id! } : r)));
    });
    return { ok: true };
  };

  const completeReferral: ReferralCtx["completeReferral"] = (refereeId, orderTotal, credit) => {
    if (!getAppSettings().referral_enabled) return null;
    if (!config.enabled) return null;
    const rec = records.find((r) => r.refereeId === refereeId && r.status === "pending");
    if (!rec) return null;
    if (Date.now() - rec.createdAt > config.expiryDays * 86400000) {
      setRecords((p) => p.map((r) => (r.id === rec.id ? { ...r, status: "expired" } : r)));
      void patchRecord("referrals", rec.id, { status: "expired" });
      return null;
    }
    if (orderTotal < config.minOrder) return null;
    credit(refereeId, config.refereeReward, "credit", `Referral bonus (code ${rec.code})`);
    // Resolve the referrer from the live users table by deterministic code.
    const referrerId = Object.keys(names).find((id) => codeFromId(id) === rec.code);
    if (referrerId) {
      credit(referrerId, config.referrerReward, "credit", `Referral bonus — ${rec.refereeName}`);
      void patchRecord("referrals", rec.id, { referrer_id: referrerId });
    }
    const updated: ReferralRecord = { ...rec, status: "rewarded", rewardedAt: Date.now(), referrerId: referrerId ?? rec.referrerId };
    setRecords((p) => p.map((r) => (r.id === rec.id ? updated : r)));
    void patchRecord("referrals", rec.id, { status: "rewarded" });
    return updated;
  };

  const statsFor: ReferralCtx["statsFor"] = (customerId) => {
    const code = codeFor(customerId);
    const mine = records.filter((r) => r.code === code);
    const rewarded = mine.filter((r) => r.status === "rewarded").length;
    return {
      total: mine.length,
      rewarded,
      pending: mine.filter((r) => r.status === "pending").length,
      earned: rewarded * config.referrerReward,
    };
  };

  const value = useMemo(
    () => ({ config, updateConfig, codeFor, records, registerReferral, completeReferral, statsFor }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, records, names],
  );
  return <ReferralContext.Provider value={value}>{children}</ReferralContext.Provider>;
}

export const useReferral = () => {
  const c = useContext(ReferralContext);
  if (!c) throw new Error("useReferral must be used within ReferralProvider");
  return c;
};

/* ============================================================
   Combined
   ============================================================ */

export function ScoobixLoyaltyProviders({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <ReferralProvider>{children}</ReferralProvider>
    </WalletProvider>
  );
}

/** Public helper — build a QR image URL from any string (no dependency). */
export const qrUrl = (data: string, size = 220) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
