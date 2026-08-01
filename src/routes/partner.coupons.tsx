import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Tag, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { useAuth } from "@/lib/auth-store";
import { formatPrice } from "@/lib/format";
import {
  listCoupons, listCouponUsage, createCoupon, updateCoupon, removeCoupon as deleteCoupon,
  setCouponStatus, couponStatus, couponStats, clampToLimits, couponLimits,
  type Coupon, type CouponUsage,
} from "@/lib/coupons-api";

export const Route = createFileRoute("/partner/coupons")({
  head: () => ({
    meta: [
      { title: "Scoobix Partner · Coupons" },
      { name: "description", content: "Create restaurant coupons and track usage, revenue, ROI and repeat orders." },
    ],
  }),
  component: PartnerCoupons,
});

function PartnerCoupons() {
  const { restaurantId } = usePartnerRestaurant();
  const { user } = useAuth();
  const [rows, setRows] = useState<Coupon[]>([]);
  const [usage, setUsage] = useState<CouponUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    code: "", title: "", discount_type: "percent", discount_value: "10",
    minimum_order: "0", maximum_discount: "", per_user_limit: "1", usage_limit: "", end_date: "",
  });
  const [saving, setSaving] = useState(false);
  const limits = couponLimits();

  const refresh = useCallback(async () => {
    if (!restaurantId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const [coupons, use] = await Promise.all([
      listCoupons({ restaurantId, includeArchived: true }),
      listCouponUsage({ restaurant_id: restaurantId, limit: 200 }),
    ]);
    setRows(coupons);
    setUsage(use);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const totals = useMemo(() => {
    const revenue = usage.reduce((s, u) => s + (u.order_value ?? 0), 0);
    const discount = usage.reduce((s, u) => s + (u.discount_amount ?? 0), 0);
    return {
      redemptions: usage.length,
      revenue: +revenue.toFixed(2),
      discount: +discount.toFixed(2),
      roi: discount > 0 ? +((revenue - discount) / discount).toFixed(2) : 0,
    };
  }, [usage]);

  const add = async () => {
    if (!restaurantId) { toast.error("Restaurant not resolved yet"); return; }
    if (!form.code.trim() || !form.title.trim()) { toast.error("Add a code and title"); return; }
    setSaving(true);
    const { patch, notes } = clampToLimits({
      discount_type: form.discount_type as Coupon["discount_type"],
      discount_value: Number(form.discount_value) || 0,
      maximum_discount: form.maximum_discount ? Number(form.maximum_discount) : null,
    });
    const created = await createCoupon(
      {
        restaurant_id: restaurantId,
        scope: "restaurant",
        coupon_type: "restaurant",
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        minimum_order: Number(form.minimum_order) || 0,
        per_user_limit: Number(form.per_user_limit) || 1,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        approved: !limits.requireApproval,
        status: limits.requireApproval ? "paused" : "active",
        active: !limits.requireApproval,
        ...patch,
      },
      { id: user?.id, email: user?.email, role: "restaurant" },
    );
    setSaving(false);
    if (!created) { toast.error("Could not create coupon"); return; }
    notes.forEach((n) => toast.info(n));
    toast.success(limits.requireApproval ? "Coupon submitted for approval" : "Coupon is live");
    setForm({ code: "", title: "", discount_type: "percent", discount_value: "10", minimum_order: "0", maximum_discount: "", per_user_limit: "1", usage_limit: "", end_date: "" });
    void refresh();
  };

  const toggle = async (c: Coupon) => {
    const next = couponStatus(c) === "active" ? "paused" : "active";
    await setCouponStatus(c.id, next, { id: user?.id, email: user?.email, role: "restaurant" });
    setRows((p) => p.map((x) => (x.id === c.id ? { ...x, status: next, active: next === "active" } : x)));
  };

  const remove = async (c: Coupon) => {
    await deleteCoupon(c.id, { id: user?.id, email: user?.email, role: "restaurant" });
    setRows((p) => p.filter((x) => x.id !== c.id));
    toast.success("Coupon deleted");
  };

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Coupons" subtitle="Restaurant offers" />

      <section className="mx-4 mt-4 grid grid-cols-2 gap-2">
        {[
          { label: "Redemptions", value: String(totals.redemptions) },
          { label: "Revenue", value: formatPrice(totals.revenue) },
          { label: "Discount given", value: formatPrice(totals.discount) },
          { label: "ROI", value: `${totals.roi}x` },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl bg-card p-3.5 shadow-soft ring-1 ring-border/60">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-lg font-extrabold">{s.value}</p>
          </div>
        ))}
      </section>

      <section className="mx-4 mt-4 space-y-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="font-display text-sm font-bold">New coupon</p>
        <p className="text-[11px] text-muted-foreground">
          Platform limits: up to {limits.maxPercent}% or {formatPrice(limits.maxFlat)} flat, capped at {formatPrice(limits.maxDiscountCap)} per order.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CODE" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm uppercase outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
          <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60">
            <option value="percent">Percent off</option>
            <option value="flat">Flat off</option>
            <option value="free_delivery">Free delivery</option>
          </select>
          <input value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} inputMode="numeric" placeholder="Value" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
          <input value={form.minimum_order} onChange={(e) => setForm({ ...form, minimum_order: e.target.value })} inputMode="numeric" placeholder="Min order" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
          <input value={form.maximum_discount} onChange={(e) => setForm({ ...form, maximum_discount: e.target.value })} inputMode="numeric" placeholder="Max discount" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
          <input value={form.per_user_limit} onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })} inputMode="numeric" placeholder="Per user limit" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
          <input value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} inputMode="numeric" placeholder="Total limit" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
          <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="col-span-2 rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
        </div>
        <button onClick={add} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create coupon
        </button>
      </section>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="mx-4 mt-6 text-center text-sm text-muted-foreground">No coupons yet.</p>
      ) : (
        <ul className="mx-4 mt-4 space-y-3">
          {rows.map((c) => {
            const stats = couponStats(c, usage);
            const live = couponStatus(c) === "active";
            return (
              <li key={c.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary"><Tag className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-extrabold">{c.code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{c.approved ? "Approved" : "Pending"}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.title} · {c.discount_type === "flat" ? formatPrice(c.discount_value ?? 0) : c.discount_type === "free_delivery" ? "Free delivery" : `${c.discount_value ?? 0}%`} off
                      {c.minimum_order ? ` · min ${formatPrice(c.minimum_order)}` : ""}
                    </p>
                  </div>
                  <button onClick={() => toggle(c)} className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${live ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"}`}>{live ? "Live" : "Off"}</button>
                  <button onClick={() => remove(c)} aria-label="Delete coupon" className="grid h-8 w-8 place-items-center rounded-full bg-rose-100 text-rose-700"><Trash2 className="h-4 w-4" /></button>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border/60 pt-3 text-center">
                  {[
                    { label: "Used", value: String(stats.redemptions) },
                    { label: "Revenue", value: formatPrice(stats.revenue) },
                    { label: "Conv.", value: `${stats.conversionRate}%` },
                    { label: "Repeat", value: String(stats.repeatOrders) },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.label}</p>
                      <p className="text-[13px] font-extrabold">{m.value}</p>
                    </div>
                  ))}
                </div>
                {stats.roi > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <TrendingUp className="h-3 w-3" /> {stats.roi}x return on {formatPrice(stats.discount)} of discount
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
