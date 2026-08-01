import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Tag, Copy, Sparkles, Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { toast } from "sonner";
import { EmptyState } from "@/components/cravio/EmptyState";
import { useAuth } from "@/lib/auth-store";
import { formatPrice } from "@/lib/format";
import { listCampaigns, effectiveStatus, CAMPAIGN_TYPE_LABEL, type Campaign } from "@/lib/campaigns-api";
import {
  listCoupons, listCouponUsage, listSavedCoupons, saveCoupon, unsaveCoupon,
  couponStatus, recommendCoupons, trackCouponEvent, COUPON_KIND_LABEL,
  type Coupon, type CouponUsage, type SavedCoupon,
} from "@/lib/coupons-api";

export const Route = createFileRoute("/app/coupons")({
  head: () => ({
    meta: [
      { title: "Scoobix · Coupon wallet & offers" },
      { name: "description", content: "Your eligible, saved, used and expired Scoobix coupons in one wallet." },
    ],
  }),
  component: CouponsPage;
});

type TabKey = "eligible" | "saved" | "recommended" | "used" | "expired";

const TABS: { key: TabKey; label: string }[] = [
  { key: "eligible", label: "Eligible" },
  { key: "recommended", label: "For you" },
  { key: "saved", label: "Saved" },
  { key: "used", label: "Used" },
  { key: "expired", label: "Expired" },
];

function valueLabel(c: Coupon): string {
  if (c.discount_type === "percent") return `${c.discount_value ?? 0}% off`;
  if (c.discount_type === "free_delivery") return "Free delivery";
  if (c.discount_type === "cashback") return `${formatPrice(c.discount_value ?? 0)} cashback`;
  return `${formatPrice(c.discount_value ?? 0)} off`;
}

function fmtDate(raw?: string | null): string {
  if (!raw) return "No expiry";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function CouponsPage() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [usage, setUsage] = useState<CouponUsage[]>([]);
  const [saved, setSaved] = useState<SavedCoupon[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tab, setTab] = useState<TabKey>("eligible");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [rows, camps, use, sav] = await Promise.all([
      listCoupons({ limit: 200 }),
      listCampaigns(),
      user?.id ? listCouponUsage({ user_id: user.id }) : Promise.resolve([] as CouponUsage[]),
      user?.id ? listSavedCoupons(user.id) : Promise.resolve([] as SavedCoupon[]),
    ]);
    setCoupons(rows);
    setCampaigns(camps.filter((c) => effectiveStatus(c) === "active"));
    setUsage(use);
    setSaved(sav);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const usedIds = useMemo(() => new Set(usage.map((u) => u.coupon_id)), [usage]);
  const savedByCoupon = useMemo(() => {
    const m = new Map<string, SavedCoupon>();
    saved.forEach((s) => { if (s.coupon_id) m.set(s.coupon_id, s); });
    return m;
  }, [saved]);

  const buckets = useMemo(() => {
    const active = coupons.filter((c) => couponStatus(c) === "active" && !c.hidden && c.approved !== false);
    return {
      eligible: active.filter((c) => !usedIds.has(c.id)),
      recommended: recommendCoupons(coupons, usage),
      saved: coupons.filter((c) => savedByCoupon.has(c.id)),
      used: coupons.filter((c) => usedIds.has(c.id)),
      expired: coupons.filter((c) => couponStatus(c) === "expired"),
    } satisfies Record<TabKey, Coupon[]>;
  }, [coupons, usedIds, savedByCoupon, usage]);

  const list = buckets[tab];

  // Impressions power the conversion metric in the admin analytics view.
  useEffect(() => {
    list.slice(0, 10).forEach((c) => trackCouponEvent(c, "impression"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const copy = (c: Coupon) => {
    navigator.clipboard?.writeText(c.code);
    trackCouponEvent(c, "click");
    toast.success(`${c.code} copied · paste at checkout`);
  };

  const toggleSave = async (c: Coupon) => {
    if (!user?.id) { toast.error("Sign in to save coupons"); return; }
    const existing = savedByCoupon.get(c.id);
    if (existing) {
      await unsaveCoupon(existing.id);
      setSaved((p) => p.filter((s) => s.id !== existing.id));
      return;
    }
    const row = await saveCoupon(user.id, c);
    if (row) setSaved((p) => [...p, row as SavedCoupon]);
    toast.success("Saved to your coupon wallet");
  };

  return (
    <div className="min-h-svh pb-16">
      <PageHeader
        title="Coupons & offers"
        subtitle={loading ? "Loading…" : `${buckets.eligible.length} usable · ${saved.length} saved`}
      />

      <div className="px-4 pt-4">
        <div className="rounded-3xl gradient-primary p-5 text-primary-foreground shadow-glow">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] opacity-90"><Sparkles className="h-3.5 w-3.5" /> Scoobix Plus</div>
          <h2 className="mt-2 font-display text-xl font-extrabold leading-tight">Unlock free delivery on every order</h2>
          <p className="mt-1 text-[12.5px] opacity-90">Try Scoobix Plus for ₹149/month. Cancel anytime.</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${tab === t.key ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}
          >
            {t.label} {buckets[t.key].length ? `· ${buckets[t.key].length}` : ""}
          </button>
        ))}
      </div>

      {campaigns.length > 0 && tab === "eligible" && (
        <ul className="mt-4 space-y-3 px-4">
          {campaigns.map((c) => (
            <li key={c.id} className="overflow-hidden rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">{c.description ?? CAMPAIGN_TYPE_LABEL[c.type]}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {CAMPAIGN_TYPE_LABEL[c.type]}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {c.promo_code ? (
                  <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[12px] font-bold tracking-wider">{c.promo_code}</span>
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Applies automatically</span>
                )}
                {c.promo_code && (
                  <button
                    onClick={() => { navigator.clipboard?.writeText(String(c.promo_code)); toast.success(`${c.promo_code} copied`); }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Tag className="h-9 w-9" />}
          title="Nothing here yet"
          description={
            tab === "used" ? "Coupons you redeem will show up here."
              : tab === "expired" ? "Expired coupons appear here for your records."
                : tab === "saved" ? "Save a coupon to keep it handy at checkout."
                  : "New offers land here as soon as they go live."
          }
        />
      ) : (
        <ul className="mt-4 space-y-3 px-4">
          {list.map((c) => {
            const isSaved = savedByCoupon.has(c.id);
            const used = usedIds.has(c.id);
            const usedRow = usage.find((u) => u.coupon_id === c.id);
            return (
              <li key={c.id} className="overflow-hidden rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold">{c.title || c.code}</h3>
                    <p className="text-xs text-muted-foreground">
                      {c.description || COUPON_KIND_LABEL[(c.coupon_type ?? "platform") as keyof typeof COUPON_KIND_LABEL]}
                      {c.minimum_order ? ` · min ${formatPrice(c.minimum_order)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {valueLabel(c)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[12px] font-bold tracking-wider">{c.code}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">
                      {used && usedRow
                        ? `Saved ${formatPrice(usedRow.discount_amount ?? 0)}`
                        : `Till ${fmtDate(c.end_date)}`}
                    </span>
                    {!used && (
                      <>
                        <button
                          onClick={() => toggleSave(c)}
                          aria-label={isSaved ? "Remove from wallet" : "Save coupon"}
                          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary"
                        >
                          {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => copy(c)} className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
