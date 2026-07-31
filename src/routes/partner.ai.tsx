/**
 * Restaurant AI Studio — menu copy, SEO, tags/allergens, multilingual menu,
 * pricing, bestseller & inventory prediction, sales insights.
 * Every generation goes through the central AI gateway.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { AiPanel, AiText } from "@/components/ai/AiPanel";
import { AiJson } from "@/components/ai/AiJson";
import { useAuth } from "@/lib/auth-store";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { runAI, useAiTask } from "@/lib/ai/client";
import { listTable } from "@/lib/insforge-crud";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/partner/ai")({
  head: () => ({
    meta: [
      { title: "Scoobix Partner · AI Studio" },
      { name: "description", content: "Generate menu descriptions, SEO copy, translations, pricing and demand insights with Scoobix AI." },
      { property: "og:title", content: "Scoobix Partner · AI Studio" },
      { property: "og:description", content: "AI menu copy, translations, pricing and demand insights for your restaurant." },
    ],
  }),
  component: PartnerAi,
});

const TABS = ["Menu copy", "Translate", "Pricing", "Insights"] as const;

function PartnerAi() {
  const { user } = useAuth();
  const { restaurant } = usePartnerRestaurant();
  const [menu, setMenu] = useState<any[]>([]);

  useEffect(() => {
    if (!restaurant?.id) return;
    void listTable<any>("menu_items", { restaurant_id: `eq.${restaurant.id}`, limit: 60 }).then(setMenu);
  }, [restaurant?.id]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Menu copy");

  const dishes = useMemo(
    () =>
      (Array.isArray(menu) ? menu : []).slice(0, 30).map((d: any) => ({
        id: String(d.id),
        name: String(d.name ?? ""),
        price: Number(d.price ?? 0),
        category: d.category ?? null,
      })),
    [menu],
  );

  const ctx = { restaurant: (restaurant as any)?.name ?? "", cuisine: (restaurant as any)?.cuisine ?? "", city: "Vadodara", dishes };

  return (
    <div className="min-h-svh pb-24">
      <PageHeader title="AI Studio" subtitle="Copy, translations, pricing & forecasts" />

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
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

      <div className="space-y-4 px-4 py-4">
        {tab === "Menu copy" && <MenuCopy ctx={ctx} userId={user?.id} />}
        {tab === "Translate" && <Translate ctx={ctx} userId={user?.id} />}
        {tab === "Pricing" && <Pricing ctx={ctx} userId={user?.id} />}
        {tab === "Insights" && <Insights ctx={ctx} userId={user?.id} restaurantId={restaurant?.id} />}
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text);
        toast.success("Copied");
      }}
      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold"
    >
      <Copy className="h-3 w-3" /> Copy
    </button>
  );
}

function MenuCopy({ ctx, userId }: { ctx: any; userId?: string }) {
  const [dish, setDish] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [copy, setCopy] = useState<any>(null);
  const [seo, setSeo] = useState<any>(null);
  const [tags, setTags] = useState<any>(null);

  const generate = async () => {
    if (!dish.trim()) return toast.error("Enter a dish name first");
    setBusy(true);
    const payload = { dish, notes, ...ctx };
    const [a, b, c] = await Promise.all([
      runAI("menu_copy", payload, { app: "partner", userId }),
      runAI("seo_meta", payload, { app: "partner", userId }),
      runAI("dish_tags", payload, { app: "partner", userId }),
    ]);
    setCopy(a.ok ? a.data : null);
    setSeo(b.ok ? b.data : null);
    setTags(c.ok ? c.data : null);
    setBusy(false);
    if (!a.ok && !b.ok && !c.ok) toast.error("AI is unavailable right now");
  };

  return (
    <>
      <section className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <h3 className="text-sm font-bold">Describe a dish</h3>
        <input
          value={dish}
          onChange={(e) => setDish(e.target.value)}
          placeholder="Dish name e.g. Paneer Tikka Masala"
          className="mt-2 h-11 w-full rounded-2xl bg-secondary px-3 text-sm outline-none ring-1 ring-border/60 focus:ring-primary"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Key ingredients or notes (optional)"
          className="mt-2 w-full rounded-2xl bg-secondary p-3 text-sm outline-none ring-1 ring-border/60 focus:ring-primary"
        />
        <button
          onClick={generate}
          disabled={busy}
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full gradient-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          <Wand2 className="h-4 w-4" /> {busy ? "Generating…" : "Generate with AI"}
        </button>
      </section>

      {copy && (
        <AiPanel title="Menu description" app="partner" task="menu_copy" userId={userId} res={{ ok: true } as any}>
          <p className="text-sm leading-relaxed">{copy.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CopyBtn text={String(copy.description ?? "")} />
            {(copy.highlights ?? []).map((h: string) => (
              <span key={h} className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{h}</span>
            ))}
          </div>
        </AiPanel>
      )}
      {seo && (
        <AiPanel title="SEO title & meta description" app="partner" task="seo_meta" userId={userId} res={{ ok: true } as any}>
          <AiJson data={seo} />
          <div className="mt-2"><CopyBtn text={`${seo.title}\n${seo.description}`} /></div>
        </AiPanel>
      )}
      {tags && (
        <AiPanel title="Tags, allergens & spice level" app="partner" task="dish_tags" userId={userId} res={{ ok: true } as any}>
          <AiJson data={tags} />
        </AiPanel>
      )}
    </>
  );
}

function Translate({ ctx, userId }: { ctx: any; userId?: string }) {
  const { data, loading, res, refresh } = useAiTask<any>(
    "translate_menu",
    { items: ctx.dishes.slice(0, 15).map((d: any) => ({ id: d.id, text: d.name })), languages: ["en", "hi", "gu", "ml", "ta"] },
    { app: "partner", userId, enabled: ctx.dishes.length > 0 },
  );
  if (!ctx.dishes.length) return <Empty text="Add menu items first — translations run on your live menu." />;
  return (
    <AiPanel
      title="Menu in 5 languages"
      subtitle="English · हिन्दी · ગુજરાતી · മലയാളം · தமிழ்"
      app="partner"
      task="translate_menu"
      userId={userId}
      loading={loading}
      res={res}
      onRefresh={refresh}
    >
      <div className="space-y-2">
        {(data?.items ?? []).map((row: any) => (
          <div key={row.id} className="rounded-2xl bg-secondary/50 p-3 ring-1 ring-border/40">
            <p className="text-sm font-bold">{row.en}</p>
            <p className="text-xs text-muted-foreground">{row.hi} · {row.gu} · {row.ml} · {row.ta}</p>
          </div>
        ))}
      </div>
    </AiPanel>
  );
}

function Pricing({ ctx, userId }: { ctx: any; userId?: string }) {
  const pricing = useAiTask<any>("pricing_suggest", ctx, { app: "partner", userId, enabled: ctx.dishes.length > 0 });
  const best = useAiTask<any>("bestseller_predict", ctx, { app: "partner", userId, enabled: ctx.dishes.length > 0 });
  const inv = useAiTask<any>("inventory_suggest", ctx, { app: "partner", userId, enabled: ctx.dishes.length > 0 });
  if (!ctx.dishes.length) return <Empty text="Add menu items to unlock pricing and demand suggestions." />;
  return (
    <>
      <AiPanel title="Pricing suggestions" app="partner" task="pricing_suggest" userId={userId} loading={pricing.loading} res={pricing.res} onRefresh={pricing.refresh}>
        <AiJson data={pricing.data?.suggestions ?? pricing.data} />
      </AiPanel>
      <AiPanel title="Bestseller prediction · next 7 days" app="partner" task="bestseller_predict" userId={userId} loading={best.loading} res={best.res} onRefresh={best.refresh}>
        <AiJson data={best.data?.predictions ?? best.data} />
      </AiPanel>
      <AiPanel title="Inventory & prep plan" app="partner" task="inventory_suggest" userId={userId} loading={inv.loading} res={inv.res} onRefresh={inv.refresh}>
        <AiJson data={inv.data?.items ?? inv.data} />
      </AiPanel>
    </>
  );
}

function Insights({ ctx, userId, restaurantId }: { ctx: any; userId?: string; restaurantId?: string }) {
  const payload = { ...ctx, restaurantId };
  const sales = useAiTask<string>("sales_insights", payload, { app: "partner", userId });
  const perf = useAiTask<string>("performance_summary", payload, { app: "partner", userId });
  return (
    <>
      <AiPanel title="Sales insights" app="partner" task="sales_insights" userId={userId} loading={sales.loading} res={sales.res} onRefresh={sales.refresh}>
        <AiText text={typeof sales.data === "string" ? sales.data : ""} />
      </AiPanel>
      <AiPanel title="Performance summary" app="partner" task="performance_summary" userId={userId} loading={perf.loading} res={perf.res} onRefresh={perf.refresh}>
        <AiText text={typeof perf.data === "string" ? perf.data : ""} />
      </AiPanel>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
