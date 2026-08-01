import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Crown, Gift, Sparkles, Store, Ticket } from "lucide-react";
import { toast } from "sonner";
import { useLoyalty } from "@/lib/scoobix-loyalty";
import { LEVELS, nextLevel, type RewardStoreItem } from "@/lib/loyalty-engine";
import { EmptyState } from "@/components/cravio/EmptyState";
import { ScratchCard } from "@/components/cravio/ScratchCard";
import { Button } from "@/components/ui/button";
import { currency } from "@/lib/format";

export const Route = createFileRoute("/app/rewards")({
  head: () => ({
    meta: [
      { title: "Scoobix Rewards & Loyalty" },
      { name: "description", content: "Track loyalty points, unlock levels, scratch reward cards and redeem from the Scoobix rewards store." },
      { property: "og:title", content: "Scoobix Rewards & Loyalty" },
      { property: "og:description", content: "Earn points on every order, level up and redeem rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RewardsPage,
});

function RewardsPage() {
  const navigate = useNavigate();
  const { summary, history, store, cards, redemptions, loading, redeem, scratch } = useLoyalty();
  const [busy, setBusy] = useState<string | null>(null);

  const spec = summary?.level ?? LEVELS[0];
  const next = summary?.next ?? nextLevel(spec.id);
  const lifetime = summary?.lifetime ?? 0;
  const progress = next
    ? Math.min(100, Math.round(((lifetime - spec.minLifetimePoints) / Math.max(1, next.minLifetimePoints - spec.minLifetimePoints)) * 100))
    : 100;

  const onRedeem = async (item: RewardStoreItem) => {
    setBusy(item.id);
    const res = await redeem(item);
    setBusy(null);
    if (!res.ok) { toast.error(res.reason ?? "Could not redeem"); return; }
    toast.success(res.code ? `Redeemed · code ${res.code}` : "Reward redeemed");
  };

  const onScratch = async (cardId: string) => {
    const res = await scratch(cardId);
    if (!res.ok) { toast.error(res.reason ?? "Card already used"); return; }
    toast.success("Reward credited to your wallet");
  };

  const unscratched = cards.filter((c) => c.status !== "scratched" && c.status !== "expired");

  return (
    <div className="min-h-svh pb-24">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_40px] items-center gap-3">
          <button onClick={() => navigate({ to: "/app/more" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-center font-display text-base font-bold">Rewards & loyalty</h1>
          <div />
        </div>
      </header>

      <section className="p-4">
        <div className="rounded-3xl gradient-primary p-5 text-primary-foreground shadow-glow">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs opacity-90"><Sparkles className="h-3.5 w-3.5" /> Points balance</div>
              <p className="mt-1 font-display text-3xl font-extrabold">{summary?.points ?? 0}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
              <Crown className="h-3.5 w-3.5" /> {spec.name}
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] opacity-85">
            {next
              ? `${Math.max(0, next.minLifetimePoints - lifetime)} points to ${next.name}`
              : "Top level unlocked — you're a Scoobix legend."}
          </p>
        </div>

        <ul className="mt-3 grid gap-1.5">
          {spec.benefits.map((b) => (
            <li key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {b}
            </li>
          ))}
        </ul>
      </section>

      {unscratched.length > 0 && (
        <section className="px-4 pb-2">
          <h2 className="eyebrow mb-2 flex items-center gap-1"><Gift className="h-3 w-3" /> Scratch cards</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {unscratched.map((c) => (
              <ScratchCard key={c.id} className="h-28 rounded-2xl" onReveal={() => void onScratch(c.id)}>
                <div className="grid h-full place-items-center rounded-2xl bg-card p-3 text-center ring-1 ring-border/60">
                  <p className="text-sm font-bold">{c.title ?? "Surprise reward"}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(c.reward_value ?? 0) > 0 ? currency(Number(c.reward_value)) : `${c.points ?? 0} points`}
                  </p>
                </div>
              </ScratchCard>
            ))}
          </div>
        </section>
      )}

      <section className="px-4 py-2">
        <h2 className="eyebrow mb-2 flex items-center gap-1"><Store className="h-3 w-3" /> Rewards store</h2>
        {loading ? (
          <div className="h-24 animate-pulse rounded-3xl bg-secondary" />
        ) : store.length === 0 ? (
          <EmptyState icon={<Store className="h-5 w-5" />} title="Store is empty" description="New rewards drop here regularly — check back soon." />
        ) : (
          <ul className="grid gap-2">
            {store.map((item) => {
              const affordable = (summary?.points ?? 0) >= Number(item.cost_points ?? 0);
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card ring-1 ring-border/60">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><Ticket className="h-4 w-4 text-primary" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{item.title ?? "Reward"}</span>
                    <span className="block text-[11px] text-muted-foreground">{item.subtitle ?? `${item.cost_points ?? 0} points`}</span>
                  </span>
                  <Button
                    size="sm"
                    disabled={!affordable || busy === item.id}
                    onClick={() => void onRedeem(item)}
                    className="rounded-full"
                  >
                    {item.cost_points ?? 0} pts
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="px-4 py-2">
        <h2 className="eyebrow mb-2">Points activity</h2>
        {history.length === 0 ? (
          <EmptyState icon={<Sparkles className="h-5 w-5" />} title="No points yet" description="Order, review and refer friends to start earning." />
        ) : (
          <ul className="divide-y divide-border/60 rounded-3xl bg-card shadow-card ring-1 ring-border/60">
            {history.slice(0, 40).map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{h.reason ?? "Points"}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {h.created_at ? new Date(h.created_at).toLocaleString() : ""}
                  </span>
                </span>
                <span className={`font-bold ${Number(h.points ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {Number(h.points ?? 0) >= 0 ? "+" : ""}{h.points ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {redemptions.length > 0 && (
        <section className="px-4 py-2">
          <h2 className="eyebrow mb-2">My redemptions</h2>
          <ul className="divide-y divide-border/60 rounded-3xl bg-card shadow-card ring-1 ring-border/60">
            {redemptions.slice(0, 20).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                <span className="truncate font-semibold">{r.title ?? "Reward"}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{r.code ?? r.status ?? ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
