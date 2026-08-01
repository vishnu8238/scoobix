/**
 * Rewards store — scratch cards and the reward catalogue.
 *
 * All state is server-authoritative: cards live in `scratch_cards`, the
 * catalogue in `reward_campaigns` (via `loyalty-engine`). No localStorage,
 * no seed/demo rewards.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getAppSettings } from "./app-settings";
import { useAuth } from "./auth-store";
import { onTablesChange } from "./realtime-bus";
import {
  createRewardCampaign,
  deleteRewardCampaign,
  issueScratchCard,
  listAllScratchCards,
  listRewardCampaigns,
  scratchCard,
  updateRewardCampaign,
  type RewardCampaignRow,
  type ScratchCardRow,
} from "./loyalty-engine";

export type RewardType = "coupon" | "voucher" | "cravio";

export type Reward = {
  id: string;
  title: string;
  type: RewardType;
  discount: number;
  /** YYYY-MM-DD */
  expiry: string;
  status: "active" | "disabled";
  limit: number;
  distributed: number;
  sponsor?: string;
  subtitle?: string;
};

export type EarnedReward = {
  rewardId: string;
  orderId: string;
  earnedAt: number;
  applied: boolean;
  title: string;
  value: number;
  scratched: boolean;
  cardId: string;
};

const toReward = (c: RewardCampaignRow): Reward => ({
  id: c.id,
  title: c.title ?? "Reward",
  type: ((c.reward_type === "wallet_credit" ? "cravio" : c.reward_type === "voucher" ? "voucher" : "coupon") as RewardType),
  discount: Number(c.reward_value ?? 0),
  expiry: (c.ends_at ?? "").slice(0, 10),
  status: c.active === false ? "disabled" : "active",
  limit: Number(c.max_issuance ?? 0),
  distributed: Number(c.issued_count ?? 0),
  sponsor: c.sponsor ?? undefined,
  subtitle: c.subtitle ?? undefined,
});

const toEarned = (c: ScratchCardRow): EarnedReward => ({
  rewardId: c.campaign_id ?? c.id,
  orderId: c.order_id ?? "",
  earnedAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
  applied: c.status === "redeemed",
  title: c.title ?? "Scratch card",
  value: Number(c.reward_value ?? 0),
  scratched: c.status === "scratched" || c.status === "redeemed",
  cardId: c.id,
});

type Ctx = {
  rewards: Reward[];
  loading: boolean;
  refresh: () => Promise<void>;
  addReward: (r: Omit<Reward, "id" | "distributed">) => Promise<void>;
  updateReward: (id: string, patch: Partial<Reward>) => Promise<void>;
  deleteReward: (id: string) => Promise<void>;
  toggleReward: (id: string) => Promise<void>;

  /** Earned cards keyed by orderId (current user for customers, all for admin). */
  earned: Record<string, EarnedReward>;
  /** Issue (or fetch existing) the scratch card entitlement for an order. */
  drawReward: (orderId: string) => Promise<EarnedReward | null>;
  /** Reveal the card and credit its reward. */
  markApplied: (orderId: string) => Promise<void>;
};

const RewardsContext = createContext<Ctx | null>(null);

export function RewardsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [earned, setEarned] = useState<Record<string, EarnedReward>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [campaigns, cards] = await Promise.all([listRewardCampaigns(), listAllScratchCards()]);
    setRewards(campaigns.map(toReward));
    const mine = uid ? cards.filter((c) => c.user_id === uid) : cards;
    const map: Record<string, EarnedReward> = {};
    for (const c of mine) if (c.order_id) map[c.order_id] = toEarned(c);
    setEarned(map);
    setLoading(false);
  }, [uid]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => onTablesChange(["scratch_cards", "reward_campaigns"], () => { void refresh(); }), [refresh]);

  const ctx: Ctx = {
    rewards,
    loading,
    refresh,
    addReward: async (r) => {
      await createRewardCampaign({
        title: r.title,
        subtitle: r.subtitle ?? null,
        reward_type: r.type === "cravio" ? "wallet_credit" : r.type === "voucher" ? "voucher" : "coupon",
        reward_value: r.discount,
        ends_at: r.expiry || null,
        active: r.status === "active",
        max_issuance: r.limit,
        sponsor: r.sponsor ?? null,
      });
      await refresh();
    },
    updateReward: async (id, patch) => {
      await updateRewardCampaign(id, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.subtitle !== undefined ? { subtitle: patch.subtitle } : {}),
        ...(patch.discount !== undefined ? { reward_value: patch.discount } : {}),
        ...(patch.expiry !== undefined ? { ends_at: patch.expiry || null } : {}),
        ...(patch.limit !== undefined ? { max_issuance: patch.limit } : {}),
        ...(patch.sponsor !== undefined ? { sponsor: patch.sponsor } : {}),
        ...(patch.status !== undefined ? { active: patch.status === "active" } : {}),
        ...(patch.type !== undefined
          ? { reward_type: patch.type === "cravio" ? "wallet_credit" : patch.type === "voucher" ? "voucher" : "coupon" }
          : {}),
      });
      await refresh();
    },
    deleteReward: async (id) => { await deleteRewardCampaign(id); await refresh(); },
    toggleReward: async (id) => {
      const current = rewards.find((r) => r.id === id);
      if (!current) return;
      await updateRewardCampaign(id, { active: current.status !== "active" });
      await refresh();
    },
    earned,
    drawReward: async (orderId) => {
      if (earned[orderId]) return earned[orderId];
      if (!getAppSettings().scratch_enabled || !uid) return null;
      const card = await issueScratchCard({ userId: uid, orderId });
      if (!card) return null;
      const row = toEarned(card);
      setEarned((e) => ({ ...e, [orderId]: row }));
      return row;
    },
    markApplied: async (orderId) => {
      const card = earned[orderId];
      if (!card || !uid) return;
      await scratchCard(card.cardId, uid);
      await refresh();
    },
  };

  return <RewardsContext.Provider value={ctx}>{children}</RewardsContext.Provider>;
}

export const useRewards = () => {
  const c = useContext(RewardsContext);
  if (!c) throw new Error("useRewards must be used within RewardsProvider");
  return c;
};
