/**
 * Admin AI Insights — revenue/daily/weekly/monthly summaries, top & low
 * performers, forecasts, fraud + duplicate detection, campaign/coupon/ranking
 * suggestions, plus the marketing copy generator.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { AiPanel, AiText } from "@/components/ai/AiPanel";
import { AiJson } from "@/components/ai/AiJson";
import { useAuth } from "@/lib/auth-store";
import { runAI, useAiTask } from "@/lib/ai/client";
import { listTable } from "@/lib/insforge-crud";
import { cn } from "@/lib/format";
import type { AiTask } from "@/lib/ai/tasks";

export const Route = createFileRoute("/admin/ai")({
  head: () => ({
    meta: [
      { title: "Scoobix Admin · AI Insights" },
      { name: "description", content: "AI revenue summaries, forecasts, fraud detection and marketing copy for the Scoobix platform." },
      { property: "og:title", content: "Scoobix Admin · AI Insights" },
      { property: "og:description", content: "Platform-wide AI insights, forecasts and marketing generation." },
    ],
  }),
  component: AdminAi,
});

const TABS = ["Insights", "Forecast", "Risk", "Growth", "Marketing"] as const;

type OrderRow = { id: string; total?: number; status?: string; created_at?: string; restaurant_id?: string; customer_id?: string };

function AdminAi() {
  const { user } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Insights");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    void Promise.all([
      listTable<OrderRow>("orders", { order: "-created_at", limit: 300 }),
      listTable<any>("restaurants", { limit: 200 }),
      listTable<any>("drivers", { limit: 200 }),
    ]).then(([o, r, d]) => {
      setOrders(o);
      setRestaurants(r);
      setDrivers(d);
    });
  }, []);

  const snapshot = useMemo(() => {
    const now = Date.now();
    const within = (days: number) => orders.filter((o) => o.created_at && now - new Date(o.created_at).getTime() < days * 864e5);
    const sum = (rows: OrderRow[]) => Math.round(rows.reduce((s, o) => s + Number(o.total ?? 0), 0));
    const byRestaurant: Record<string, { orders: number; revenue: number }> = {};
    for (const o of orders) {
      const k = o.restaurant_id ?? "unknown";
      byRestaurant[k] ??= { orders: 0, revenue: 0 };
      byRestaurant[k].orders += 1;
      byRestaurant[k].revenue += Number(o.total ?? 0);
    }
    const nameOf = (id: string) => restaurants.find((r) => r.id === id)?.name ?? id;
    const ranked = Object.entries(byRestaurant)
      .map(([id, v]) => ({ restaurant: nameOf(id), orders: v.orders, revenue: Math.round(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      city: "Vadodara",
      generatedAt: new Date().toISOString(),
      totals: {
        orders: orders.length,
        revenue: sum(orders),
        cancelled: orders.filter((o) => (o.status ?? "").toUpperCase() === "CANCELLED").length,
        restaurants: restaurants.length,
        liveRestaurants: restaurants.filter((r) => r.is_live).length,
        drivers: drivers.length,
        customers: new Set(orders.map((o) => o.customer_id).filter(Boolean)).size,
      },
      today: { orders: within(1).length, revenue: sum(within(1)) },
      week: { orders: within(7).length, revenue: sum(within(7)) },
      month: { orders: within(30).length, revenue: sum(within(30)) },
      prevMonth: { orders: within(60).length - within(30).length, revenue: sum(within(60)) - sum(within(30)) },
      topRestaurants: ranked.slice(0, 10),
      lowRestaurants: ranked.slice(-8).reverse(),
    };
  }, [orders, restaurants, drivers]);

  const ready = orders.length > 0 || restaurants.length > 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">AI Insights</h1>
        <p className="text-sm text-muted-foreground">Live platform data summarised by the Scoobix AI gateway.</p>
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold",
              tab === t ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Insights" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Text task="revenue_summary" title="Revenue summary" input={snapshot} enabled={ready} userId={user?.id} />
          <Text task="daily_insights" title="Today's insights" input={snapshot} enabled={ready} userId={user?.id} />
          <Text task="weekly_summary" title="Weekly summary" input={snapshot} enabled={ready} userId={user?.id} />
          <Text task="monthly_summary" title="Monthly summary" input={snapshot} enabled={ready} userId={user?.id} />
          <Json task="top_entities" title="Top restaurants, riders & categories" input={snapshot} enabled={ready} userId={user?.id} />
        </div>
      )}

      {tab === "Forecast" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Json task="growth_forecast" title="Customer growth & revenue forecast" input={snapshot} enabled={ready} userId={user?.id} />
          <Json task="demand_forecast" title="Demand forecast" input={snapshot} enabled={ready} userId={user?.id} />
        </div>
      )}

      {tab === "Risk" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Json
            task="fraud_detect"
            title="Fraud signals"
            input={{ orders: orders.slice(0, 120).map((o) => ({ id: o.id, total: o.total, status: o.status, customer: o.customer_id, at: o.created_at })) }}
            enabled={orders.length > 0}
            userId={user?.id}
          />
          <Json
            task="duplicate_detect"
            title="Possible duplicate restaurants"
            input={{ restaurants: restaurants.slice(0, 120).map((r) => ({ id: r.id, name: r.name, address: r.address, phone: r.phone })) }}
            enabled={restaurants.length > 0}
            userId={user?.id}
          />
        </div>
      )}

      {tab === "Growth" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Json task="campaign_suggest" title="Campaign suggestions" input={snapshot} enabled={ready} userId={user?.id} />
          <Json task="coupon_suggest" title="Coupon suggestions" input={snapshot} enabled={ready} userId={user?.id} />
          <Json task="ranking_suggest" title="Restaurant ranking suggestions" input={snapshot} enabled={ready} userId={user?.id} />
        </div>
      )}

      {tab === "Marketing" && <Marketing userId={user?.id} snapshot={snapshot} />}
    </div>
  );
}

function Text({ task, title, input, enabled, userId }: { task: AiTask; title: string; input: unknown; enabled: boolean; userId?: string }) {
  const { data, loading, res, refresh } = useAiTask<string>(task, input, { app: "admin", userId, enabled });
  return (
    <AiPanel title={title} app="admin" task={task} userId={userId} loading={loading} res={res} onRefresh={refresh}>
      <AiText text={typeof data === "string" ? data : ""} />
    </AiPanel>
  );
}

function Json({ task, title, input, enabled, userId }: { task: AiTask; title: string; input: unknown; enabled: boolean; userId?: string }) {
  const { data, loading, res, refresh } = useAiTask<any>(task, input, { app: "admin", userId, enabled });
  return (
    <AiPanel title={title} app="admin" task={task} userId={userId} loading={loading} res={res} onRefresh={refresh}>
      <AiJson data={data} />
    </AiPanel>
  );
}

const MARKETING: { task: AiTask; label: string }[] = [
  { task: "push_copy", label: "Push notification" },
  { task: "offer_headline", label: "Offer headline" },
  { task: "campaign_desc", label: "Campaign description" },
  { task: "promo_text", label: "Restaurant promo text" },
  { task: "blog_ideas", label: "SEO blog ideas" },
  { task: "landing_copy", label: "Landing page copy" },
  { task: "email_draft", label: "Email campaign draft" },
  { task: "festival_ideas", label: "Festival campaign ideas" },
  { task: "social_caption", label: "Social caption + hashtags" },
];

function Marketing({ userId, snapshot }: { userId?: string; snapshot: unknown }) {
  const [task, setTask] = useState<AiTask>("push_copy");
  const [brief, setBrief] = useState("");
  const [out, setOut] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    const res = await runAI(task, { brief, context: snapshot }, { app: "admin", userId, fresh: true });
    setOut(res.ok ? (res.data ?? res.text) : null);
    setBusy(false);
  };

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <h3 className="text-sm font-bold">Marketing generator</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {MARKETING.map((m) => (
            <button
              key={m.task}
              onClick={() => setTask(m.task)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                task === m.task ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={4}
          placeholder="Brief — audience, occasion, offer, tone…"
          className="mt-3 w-full rounded-2xl bg-secondary p-3 text-sm outline-none ring-1 ring-border/60 focus:ring-primary"
        />
        <button
          onClick={generate}
          disabled={busy}
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full gradient-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <Wand2 className="h-4 w-4" /> {busy ? "Generating…" : "Generate"}
        </button>
      </div>
      <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <h3 className="text-sm font-bold">Output</h3>
        <div className="mt-3">
          {out ? <AiJson data={out} /> : <p className="text-sm text-muted-foreground">Pick a format, add a brief and generate.</p>}
        </div>
      </div>
    </section>
  );
}
