import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
const KEY = "cravio_rewards_v1";

type Snap = { rewards: Reward[]; earned: Record<string, EarnedReward> };

function load(): Snap {
  if (typeof window === "undefined") return { rewards: DEFAULT_REWARDS, earned: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { rewards: DEFAULT_REWARDS, earned: {} };
    const parsed = JSON.parse(raw);
    return { rewards: parsed.rewards ?? DEFAULT_REWARDS, earned: parsed.earned ?? {} };
  } catch { return { rewards: DEFAULT_REWARDS, earned: {} }; }
}

const uid = () => "r-" + Math.random().toString(36).slice(2, 9);

export function RewardsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Snap>(() => load());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

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
    addReward: (r) => setState((s) => ({ ...s, rewards: [...s.rewards, { ...r, id: uid(), distributed: 0 }] })),
    updateReward: (id, patch) => setState((s) => ({ ...s, rewards: s.rewards.map((r) => r.id === id ? { ...r, ...patch } : r) })),
    deleteReward: (id) => setState((s) => ({ ...s, rewards: s.rewards.filter((r) => r.id !== id) })),
    toggleReward: (id) => setState((s) => ({ ...s, rewards: s.rewards.map((r) => r.id === id ? { ...r, status: r.status === "active" ? "disabled" : "active" } : r) })),
    earned: state.earned,
    drawReward,
    markApplied: (orderId) => {
      setState((s) => s.earned[orderId] ? { ...s, earned: { ...s.earned, [orderId]: { ...s.earned[orderId], applied: true } } } : s);
      void import("./insforge-crud").then(({ listTable, patchRecord }) => listTable<{ id?: string; order_id?: string }>("scratch_cards", { order_id: orderId, limit: 1 }).then((rs) => {
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
