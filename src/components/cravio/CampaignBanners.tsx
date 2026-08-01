import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/format";
import {
import { OptimizedImage } from "@/components/cravio/OptimizedImage";
  listCampaigns, effectiveStatus, trackCampaignEvent, CAMPAIGN_TYPE_LABEL, type Campaign,
} from "@/lib/campaigns-api";

/**
 * Home-screen campaign banners. Reads live campaigns from InsForge, shows only
 * the ones that are running right now, and records an impression per render so
 * admin analytics can compute a conversion rate.
 */
export function CampaignBanners() {
  const { user } = useAuth();
  const [list, setList] = useState<Campaign[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listCampaigns().then((rows) => { if (!cancelled) setList(rows); });
    return () => { cancelled = true; };
  }, []);

  const live = useMemo(
    () =>
      list
        .filter((c) => effectiveStatus(c) === "active")
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
        .slice(0, 8),
    [list],
  );

  useEffect(() => {
    live.forEach((c) => trackCampaignEvent(c.id, "impression", user?.id));
    // Impressions are recorded once per banner set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.map((c) => c.id).join(",")]);

  if (live.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-5">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-extrabold tracking-tight">Offers for you</h2>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
        {live.map((c) => (
          <Link
            key={c.id}
            to="/app/coupons"
            onClick={() => trackCampaignEvent(c.id, "click", user?.id)}
            className={cn(
              "relative w-[260px] shrink-0 overflow-hidden rounded-3xl p-4 shadow-soft ring-1 ring-border/60",
              c.banner_url ? "text-white" : "gradient-primary text-primary-foreground",
            )}
          >
            {c.banner_url && (
              <>
                <OptimizedImage src={c.banner_url} alt={c.name} type="banner" className="absolute inset-0 h-full w-full" />
                <div className="absolute inset-0 bg-black/45" />
              </>
            )}
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-90">
                {CAMPAIGN_TYPE_LABEL[c.type]}
              </p>
              <h3 className="mt-1 font-display text-base font-extrabold leading-tight">{c.name}</h3>
              {c.description && <p className="mt-1 line-clamp-2 text-[12px] opacity-90">{c.description}</p>}
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wider opacity-95">
                {c.promo_code ? `Code ${c.promo_code}` : "Applied automatically"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
