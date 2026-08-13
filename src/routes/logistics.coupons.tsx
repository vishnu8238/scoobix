import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2, Plus, ShieldCheck, Tag, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { useAuth } from "@/lib/auth-store";
import { formatPrice } from "@/lib/format";
import {
  listCoupons, listCouponUsage, listCouponAudit, createCoupon, updateCoupon,
  setCouponStatus, removeCoupon as deleteCoupon, duplicateCoupon, couponStatus,
  couponStats, fraudSignals, couponsToCsv, parseCouponsCsv, COUPON_KIND_LABEL,
  type Coupon, type CouponUsage, type CouponAudit,
} from "@/lib/coupons-api";

export const Route = createFileRoute("/logistics/coupons")({
  head: () => ({
    meta: [
      { title: "Scoobix Logistics · Coupons" },
      { name: "description", content: "Create, approve, audit and analyse every Scoobix coupon and promotion." },
    ],
  }),
  component: LogisticsCoupons,
});

type Filter = "all" | "active" | "pending" | "paused" | "expired";

function LogisticsCoupons() {
  const { user } = useAuth();
  const actor = { id: user?.id, email: user?.email, role: "admin" as const };
  const [rows, setRows] = useState<Coupon[]>([]);
  const [usage, setUsage] = useState<CouponUsage[]>([]);
  const [audit, setAudit] = useState<CouponAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const [coupons, use, logs] = await Promise.all([
      listCoupons({ includeArchived: true, limit: 500 }),
      listCouponUsage({ limit: 500 }),
      listCouponAudit(),
    ]);
    setRows(coupons); setUsage(use); setAudit(logs); setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => {
      const st = couponStatus(c);
      if (filter === "pending" ? c.approved !== false : filter !== "all" && st !== filter) return false;
      if (!q) return true;
      return `${c.code} ${c.title ?? ""} ${c.description ?? ""}`.toLowerCase().includes(q);
    });
  }, [rows, filter, query]);

  const totals = useMemo(() => {
    const revenue = usage.reduce((s, u) => s + (u.order_value ?? 0), 0);
    const discount = usage.reduce((s, u) => s + (u.discount_amount ?? 0), 0);
    return {
      redemptions: usage.length,
      revenue: +revenue.toFixed(2),
      discount: +discount.toFixed(2),
      roi: discount > 0 ? +((revenue - discount) / discount).toFixed(2) : 0,
      active: rows.filter((c) => couponStatus(c) === "active").length,
    };
  }, [usage, rows]);

  return (
    <div className="mx-auto min-h-svh max-w-[720px] pb-24">
      <PageHeader title="Coupons & promotions" subtitle="Platform-wide offer control" />

      <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: "Active", value: String(totals.active) },
          { label: "Redemptions", value: String(totals.redemptions) },
          { label: "Revenue", value: formatPrice(totals.revenue) },
          { label: "Discount", value: formatPrice(totals.discount) },
          { label: "ROI", value: `${totals.roi}x` },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl bg-card p-3.5 shadow-soft ring-1 ring-border/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-lg font-extrabold">{s.value}</p>
          </div>
        ))}
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(["all", "active", "pending", "paused", "expired"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{f}</button>
        ))}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code" className="ml-auto rounded-full bg-muted/50 px-3 py-1.5 text-sm outline-none ring-1 ring-border/60" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <ul className="mt-3 space-y-3">
          {filtered.map((c) => {
            const stats = couponStats(c, usage);
            const st = couponStatus(c);
            return (
              <li key={c.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary"><Tag className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-extrabold">{c.code}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{COUPON_KIND_LABEL[(c.coupon_type ?? "platform") as keyof typeof COUPON_KIND_LABEL]}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{st}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.title} · {stats.redemptions} used · {formatPrice(stats.revenue)} revenue</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setCouponStatus(c.id, st === "active" ? "paused" : "active", actor).then(refresh)} className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider">{st === "active" ? "Pause" : "Activate"}</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
