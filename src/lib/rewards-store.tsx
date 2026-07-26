import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getAppSettings } from "./app-settings";
import { kvGet, kvSet } from "./kv-store";

/* ============================================================
   REWARDS STORE — Scratch card rewards.
   Pure frontend, persisted to localStorage. Backend-ready shape:
   Reward { id, title, type, discount, expiry, status, limit, distributed }
   ============================================================ */

export type RewardType = "coupon" | "voucher" | "cravio";

export type Reward = {
  id: string;
  title: string;
  type: RewardType;
  /** Discount amount or % depending on type. */
  discount: number;
  /** YYYY-MM-DD */
  expiry: string;
  status: "active" | "disabled";
  /** Distribution cap; 0 = unlimited. */
  limit: number;
  distributed: number;
  /** Sponsor brand name for voucher type, optional. */
  sponsor?: string;
  /** Sub-label (e.g. "₹100 off your next order"). */
  subtitle?: string;
};

export type EarnedReward = {
  rewardId: string;
  orderId: string;
  earnedAt: number;
  applied: boolean;
};

const DEFAULT_REWARDS: Reward[] = [
  { id: "r-cravio-100", title: "₹100 Scoobix Cash", type: "cravio", discount: 100, expiry: "2027-01-01", status: "active", limit: 0, distributed: 0, subtitle: "Auto-applied on next order" },
  { id: "r-coupon-50",  title: "50% off next order", type: "coupon", discount: 50, expiry: "2026-12-31", status: "active", limit: 0, distributed: 0, subtitle: "Max ₹150 · code SCRATCH50" },
  { id: "r-voucher-zo", title: "Zomo Café · Free coffee", type: "voucher", discount: 0, expiry: "2026-10-31", status: "active", limit: 250, distributed: 0, sponsor: "Zomo Café", subtitle: "Show at counter" },
  { id: "r-coupon-30",  title: "Flat ₹30 off", type: "coupon", discount: 30, expiry: "2026-09-30", status: "active", limit: 0, distributed: 0, subtitle: "Min order ₹199" },
];

type Ctx = {
  rewards: Reward[];
  addReward: (r: Omit<Reward, "id" | "distributed">) => void;
  updateReward: (id: string, patch: Partial<Reward>) => void;
  deleteReward: (id: string) => void;
  toggleReward: (id: string) => void;

  earned: Record<string, EarnedReward>; // by orderId
  /** Pull a random eligible reward for an order. Returns null when none. */
  drawReward: (orderId: string) => Reward | null;
  markApplied: (orderId: string) => void;
};

const RewardsContext = createContext<Ctx | null>(null);

type Snap = { rewards: Reward[]; earned: Record<string, EarnedReward> };



const uid = () => "r-" + Math.random().toString(36).slice(2, 9);

export function RewardsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Snap>({ rewards: DEFAULT_REWARDS, earned: {} });

  // Reward catalogue has no dedicated table — persisted as a JSON row in
  // app_settings; earned cards live in `scratch_cards`.
  useEffect(() => {
    let cancelled = false;
    void kvGet<Reward[]>("reward_catalog").then((rows) => {
      if (!cancelled && Array.isArray(rows) && rows.length) setState((s) => ({ ...s, rewards: rows }));
    });
    return () => { cancelled = true; };
  }, []);

  const persistCatalog = (rewards: Reward[]) => { void kvSet("reward_catalog", rewards); };

  // Hydrate earned scratch cards from InsForge on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { listTable } = await import("./insforge-crud");
      const rows = await listTable<{ order_id?: string; reward_id?: string; earned_at?: string; applied?: boolean }>("scratch_cards");
      if (cancelled || !rows.length) return;
      setState((s) => {
        const earned = { ...s.earned };
        for (const r of rows) {
          if (!r.order_id || !r.reward_id) continue;
          earned[r.order_id] = {
            rewardId: r.reward_id,
            orderId: r.order_id,
            earnedAt: r.earned_at ? new Date(r.earned_at).getTime() : Date.now(),
            applied: !!r.applied,
          };
        }
        return { ...s, earned };
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const drawReward: Ctx["drawReward"] = (orderId) => {
    if (state.earned[orderId]) {
      return state.rewards.find((r) => r.id === state.earned[orderId].rewardId) ?? null;
    }
    // Gate on the global app_settings toggle — admin can disable the entire
    // scratch-card program platform-wide without touching UI.
    if (!getAppSettings().scratch_enabled) return null;
    const pool = state.rewards.filter((r) => r.status === "active" && (r.limit === 0 || r.distributed < r.limit));
    if (pool.length === 0) return null;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setState((s) => ({
      rewards: s.rewards.map((r) => r.id === picked.id ? { ...r, distributed: r.distributed + 1 } : r),
      earned: { ...s.earned, [orderId]: { rewardId: picked.id, orderId, earnedAt: Date.now(), applied: false } },
    }));
    void import("./insforge-crud").then(({ createRecord }) => createRecord("scratch_cards", {
      order_id: orderId, reward_id: picked.id, applied: false,
    }));
    return picked;
  };

  const ctx: Ctx = {
    rewards: state.rewards,
    addReward: (r) => setState((s) => {
      const rewards = [...s.rewards, { ...r, id: uid(), distributed: 0 }];
      persistCatalog(rewards);
      return { ...s, rewards };
    }),
    updateReward: (id, patch) => setState((s) => {
      const rewards = s.rewards.map((r) => r.id === id ? { ...r, ...patch } : r);
      persistCatalog(rewards);
      return { ...s, rewards };
    }),
    deleteReward: (id) => setState((s) => {
      const rewards = s.rewards.filter((r) => r.id !== id);
      persistCatalog(rewards);
      return { ...s, rewards };
    }),
    toggleReward: (id) => setState((s) => {
      const rewards = s.rewards.map((r) => r.id === id ? { ...r, status: (r.status === "active" ? "disabled" : "active") as Reward["status"] } : r);
      persistCatalog(rewards);
      return { ...s, rewards };
    }),
    earned: state.earned,
    drawReward,
    markApplied: (orderId) => {
      setState((s) => s.earned[orderId] ? { ...s, earned: { ...s.earned, [orderId]: { ...s.earned[orderId], applied: true } } } : s);
      void import("./insforge-crud").then(({ listTable, patchRecord }) => listTable<{ id?: string; order_id?: string }>("scratch_cards", { order_id: `eq.${orderId}`, limit: 1 }).then((rs) => {
        const row = rs[0];
        if (row?.id) void patchRecord("scratch_cards", row.id, { applied: true });
      }));
    },
  };

  return <RewardsContext.Provider value={ctx}>{children}</RewardsContext.Provider>;
}

export const useRewards = () => {
  const c = useContext(RewardsContext);
  if (!c) throw new Error("useRewards must be used within RewardsProvider");
  return c;
};
