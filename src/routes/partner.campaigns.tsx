import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Megaphone, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { EmptyState } from "@/components/cravio/EmptyState";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { formatPrice, cn } from "@/lib/format";
import {
  listCampaigns, campaignAnalytics, effectiveStatus, CAMPAIGN_TYPE_LABEL, type Campaign,
} from "@/lib/campaigns-api";

export const Route = createFileRoute("/partner/campaigns")({
  head: () => ({
    meta: [
      { title: "Scoobix Partner · Campaigns" },
      { name: "description", content: "Promotions currently running on your store." },
    ],
  }),
  component: PartnerCampaigns,
});

function PartnerCampaigns() {
  const { restaurant } = usePartnerRestaurant();
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void listCampaigns().then((rows) => {
      if (cancelled) return;
      setList(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const mine = list.filter((c) => {
    const ids = c.restaurant_ids ?? [];
    const scoped = ids.length === 0 || (restaurant?.id ? ids.includes(restaurant.id) : false);
    return scoped && effectiveStatus(c) !== "archived";
  });

  return (
    <div className="min-h-svh pb-8">
      <PageHeader title="Campaigns" subtitle={loading ? "Loading…" : `${mine.length} applied to your store`} />

      <div className="space-y-3 p-4">
        {!loading && mine.length === 0 && (
          <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No campaigns yet" description="Scoobix promotions that include your store will appear here." />
        )}

        {mine.map((c) => {
          const st = effectiveStatus(c);
          const a = campaignAnalytics(c);
          const sponsoredByMe = !!c.sponsored && (!c.sponsor_restaurant_id || c.sponsor_restaurant_id === restaurant?.id);
          return (
            <article key={c.id} className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold">{c.name}</h3>
                    
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {CAMPAIGN_TYPE_LABEL[c.type]}
                    {c.promo_code ? ` · ${c.promo_code}` : c.auto_apply ? " · auto-applied" : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                    st === "active" ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {st}
                </span>
              </div>

              {c.description && <p className="mt-2 text-xs text-muted-foreground">{c.description}</p>}

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Redemptions" value={String(a.redemptions)} />
                <Stat label="Revenue" value={formatPrice(a.revenue)} />
                <Stat label="Discount" value={formatPrice(a.discount)} />
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                {sponsoredByMe
                  ? "Funded by your store — the discount is deducted from your settlement."
                  : "Funded by Scoobix — your payout is unaffected."}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-extrabold">{value}</p>
    </div>
  );
}
