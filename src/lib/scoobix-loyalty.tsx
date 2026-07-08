/**
 * Scoobix loyalty — Wallet + Referral program.
 *
 * Local-first (localStorage) with the same graceful-fallback pattern used by
 * the other Scoobix extras. Deliberately does NOT create new backend tables;
 * the shape is backend-ready (customerId keyed) for future sync.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./auth-store";

const uid = () => Math.random().toString(36).slice(2, 10);

/* ============================================================
   WALLET
   ============================================================ */

export type WalletTxn = {
  id: string;
  customerId: string;
  amount: number;                // positive = credit, negative = debit
  kind: "credit" | "debit" | "cashback" | "refund" | "scratch" | "admin";
  note: string;
  createdAt: number;
};

type WalletCtx = {
  balance: (customerId: string) => number;
  txns: (customerId: string) => WalletTxn[];
  allTxns: WalletTxn[];
  credit: (customerId: string, amount: number, kind: WalletTxn["kind"], note: string) => WalletTxn;
  debit:  (customerId: string, amount: number, kind: WalletTxn["kind"], note: string) => { ok: boolean; txn?: WalletTxn; reason?: string };
};

const WKey = "scoobix_wallet_v1";
const WalletContext = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [txns, setTxns] = useState<WalletTxn[]>([]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(WKey) : null;
      if (raw) setTxns(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(WKey, JSON.stringify(txns));
  }, [txns]);

  const balanceOf = (cid: string) => txns.filter((t) => t.customerId === cid).reduce((s, t) => s + t.amount, 0);

  const credit: WalletCtx["credit"] = (customerId, amount, kind, note) => {
    const txn: WalletTxn = { id: uid(), customerId, amount: Math.abs(amount), kind, note, createdAt: Date.now() };
    setTxns((p) => [txn, ...p]);
    return txn;
  };
  const debit: WalletCtx["debit"] = (customerId, amount, kind, note) => {
    const amt = Math.abs(amount);
    if (balanceOf(customerId) < amt) return { ok: false, reason: "Insufficient wallet balance" };
    const txn: WalletTxn = { id: uid(), customerId, amount: -amt, kind, note, createdAt: Date.now() };
    setTxns((p) => [txn, ...p]);
    return { ok: true, txn };
  };

  const value: WalletCtx = {
    balance: balanceOf,
    txns: (cid) => txns.filter((t) => t.customerId === cid),
    allTxns: txns,
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

/** Convenience: current-user wallet balance. */
export const useMyWallet = () => {
  const { user } = useAuth();
  const wallet = useWallet();
  const cid = user?.id ?? "guest";
  return {
    balance: wallet.balance(cid),
    txns: wallet.txns(cid),
    credit: (amt: number, kind: WalletTxn["kind"], note: string) => wallet.credit(cid, amt, kind, note),
    debit:  (amt: number, kind: WalletTxn["kind"], note: string) => wallet.debit(cid, amt, kind, note),
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
  code: string;               // referrer's code
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
  /** Called at signup (or first-order flow) when a user enters someone's code. */
  registerReferral: (code: string, referee: { id: string; name: string }) => { ok: boolean; reason?: string };
  /** Called when the referee completes a qualifying first order. Credits both wallets. */
  completeReferral: (refereeId: string, orderTotal: number, credit: (customerId: string, amt: number, kind: WalletTxn["kind"], note: string) => WalletTxn) => ReferralRecord | null;
  statsFor: (customerId: string) => { total: number; rewarded: number; pending: number; earned: number };
};

const RKey = "scoobix_referral_v1";
const RCfgKey = "scoobix_referral_config_v1";
const ReferralContext = createContext<ReferralCtx | null>(null);

const DEFAULT_CONFIG: ReferralConfig = {
  enabled: true,
  referrerReward: 100,
  refereeReward: 50,
  minOrder: 199,
  expiryDays: 30,
};

const codeFromId = (id: string) => {
  // Deterministic 6-char code (upper-case alnum).
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `SCX${h.toString(36).toUpperCase().slice(0, 5).padStart(5, "0")}`;
};

export function ReferralProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ReferralConfig>(DEFAULT_CONFIG);
  const [records, setRecords] = useState<ReferralRecord[]>([]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(RKey) : null;
      if (raw) setRecords(JSON.parse(raw));
      const rc = typeof window !== "undefined" ? localStorage.getItem(RCfgKey) : null;
      if (rc) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(rc) });
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem(RKey, JSON.stringify(records)); }, [records]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem(RCfgKey, JSON.stringify(config)); }, [config]);

  const updateConfig: ReferralCtx["updateConfig"] = (patch) => setConfig((c) => ({ ...c, ...patch }));
  const codeFor: ReferralCtx["codeFor"] = (cid) => codeFromId(cid || "guest");

  const registerReferral: ReferralCtx["registerReferral"] = (code, referee) => {
    if (!config.enabled) return { ok: false, reason: "Referral program is disabled" };
    const normalised = code.trim().toUpperCase();
    if (!normalised) return { ok: false, reason: "Enter a referral code" };
    if (codeFor(referee.id) === normalised) return { ok: false, reason: "You can't refer yourself" };
    if (records.some((r) => r.refereeId === referee.id)) return { ok: false, reason: "Referral already applied for this account" };
    const rec: ReferralRecord = {
      id: uid(),
      code: normalised,
      referrerId: normalised, // opaque — resolved on completion by matching codeFor(user)
      refereeId: referee.id,
      refereeName: referee.name,
      status: "pending",
      createdAt: Date.now(),
    };
    setRecords((p) => [rec, ...p]);
    return { ok: true };
  };

  const completeReferral: ReferralCtx["completeReferral"] = (refereeId, orderTotal, credit) => {
    if (!config.enabled) return null;
    const rec = records.find((r) => r.refereeId === refereeId && r.status === "pending");
    if (!rec) return null;
    const expired = Date.now() - rec.createdAt > config.expiryDays * 86400000;
    if (expired) { setRecords((p) => p.map((r) => r.id === rec.id ? { ...r, status: "expired" } : r)); return null; }
    if (orderTotal < config.minOrder) return null;
    // Credit the referee
    credit(refereeId, config.refereeReward, "credit", `Referral bonus (code ${rec.code})`);
    // Credit the referrer if we can resolve them from stored profiles
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("cravio_users_v1") : null;
      const users = raw ? JSON.parse(raw) as Array<{ id: string; name?: string }> : [];
      const referrer = users.find((u) => codeFromId(u.id) === rec.code);
      if (referrer) credit(referrer.id, config.referrerReward, "credit", `Referral bonus — ${rec.refereeName}`);
    } catch { /* ignore */ }
    const updated: ReferralRecord = { ...rec, status: "rewarded", rewardedAt: Date.now() };
    setRecords((p) => p.map((r) => r.id === rec.id ? updated : r));
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

  const value = useMemo(() => ({ config, updateConfig, codeFor, records, registerReferral, completeReferral, statsFor }), [config, records]);
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
