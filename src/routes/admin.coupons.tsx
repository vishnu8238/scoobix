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

export const Route = createFileRoute("/admin/coupons")({
  head: () => ({
    meta: [
      { title: "Scoobix Admin · Coupon & promotion engine" },
      { name: "description", content: "Create, approve, audit and analyse every Scoobix coupon and promotion." },
    ],
  }),
  component: AdminCoupons,
});

type Filter = "all" | "active" | "pending" | "paused" | "expired";

function AdminCoupons() {
  const { user } = useAuth();
  const actor = { id: user?.id, email: user?.email, role: "admin" as const };
  const [rows, setRows] = useState<Coupon[]>([]);
  const [usage, setUsage] = useState<CouponUsage[]>([]);
  const [audit, setAudit] = useState<CouponAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: "", title: "", coupon_type: "platform", discount_type: "percent",
    discount_value: "10", minimum_order: "0", maximum_discount: "", usage_limit: "",
    per_user_limit: "1", cities: "", end_date: "", hidden: false,
  });

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

  const fraud = useMemo(() => fraudSignals(usage, rows), [usage, rows]);

  const create = async () => {
    if (!form.code.trim()) { toast.error("Coupon code is required"); return; }
    setBusy(true);
    const created = await createCoupon({
      scope: form.coupon_type === "restaurant" ? "restaurant" : "platform",
      coupon_type: form.coupon_type as Coupon["coupon_type"],
      code: form.code.trim().toUpperCase(),
      title: form.title.trim() || form.code.trim().toUpperCase(),
      discount_type: form.discount_type as Coupon["discount_type"],
      discount_value: Number(form.discount_value) || 0,
      minimum_order: Number(form.minimum_order) || 0,
      maximum_discount: form.maximum_discount ? Number(form.maximum_discount) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      per_user_limit: Number(form.per_user_limit) || 1,
      cities: form.cities ? form.cities.split(",").map((s) => s.trim()).filter(Boolean) : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      hidden: form.hidden,
      approved: true,
      status: "active",
      active: true,
    }, actor);
    setBusy(false);
    if (!created) { toast.error("Could not create coupon"); return; }
    toast.success(`${created.code} is live`);
    setForm({ ...form, code: "", title: "" });
    void refresh();
  };

  const approve = async (c: Coupon) => {
    await updateCoupon(c.id, { approved: true, status: "active", active: true }, actor);
    setRows((p) => p.map((x) => (x.id === c.id ? { ...x, approved: true, status: "active", active: true } : x)));
    toast.success(`${c.code} approved`);
  };

  const toggle = async (c: Coupon) => {
    const next = couponStatus(c) === "active" ? "paused" : "active";
    await setCouponStatus(c.id, next, actor);
    setRows((p) => p.map((x) => (x.id === c.id ? { ...x, status: next, active: next === "active" } : x)));
  };

  const duplicate = async (c: Coupon) => {
    const copy = await duplicateCoupon(c, actor);
    if (copy) { setRows((p) => [copy, ...p]); toast.success(`Duplicated as ${copy.code}`); }
  };

  const remove = async (c: Coupon) => {
    await deleteCoupon(c.id, actor);
    setRows((p) => p.filter((x) => x.id !== c.id));
  };

  const exportCsv = () => {
    const blob = new Blob([couponsToCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scoobix-coupons-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importCsv = async () => {
    const parsed = parseCouponsCsv(csv);
    if (!parsed.length) { toast.error("Nothing to import"); return; }
    setBusy(true);
    let ok = 0;
    for (const draft of parsed) {
      const created = await createCoupon({ ...draft, approved: true, status: "active", active: true }, actor);
      if (created) ok += 1;
    }
    setBusy(false);
    setCsv("");
    toast.success(`Imported ${ok}/${parsed.length} coupons`);
    void refresh();
  };

  return (
    <div className="mx-auto min-h-svh max-w-[720px] pb-24">
      <PageHeader title="Coupons & promotions" subtitle="Platform-wide offer control" />

      <section className="mx-4 mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
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

      <section className="mx-4 mt-4 space-y-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="font-display text-sm font-bold">Create coupon</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CODE" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm uppercase outline-none ring-1 ring-border/60" />
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60" />
          <select value={form.coupon_type} onChange={(e) => setForm({ ...form, coupon_type: e.target.value })} className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60">
            {Object.entries(COUPON_KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60">
            <option value="percent">Percent off</option>
            <option value="flat">Flat off</option>
            <option value="free_delivery">Free delivery</option>
            <option value="cashback">Cashback</option>
          </select>
          <input value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} inputMode="numeric" placeholder="Value" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60" />
          <input value={form.maximum_discount} onChange={(e) => setForm({ ...form, maximum_discount: e.target.value })} inputMode="numeric" placeholder="Max discount" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60" />
          <input value={form.minimum_order} onChange={(e) => setForm({ ...form, minimum_order: e.target.value })} inputMode="numeric" placeholder="Min order" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60" />
          <input value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} inputMode="numeric" placeholder="Total limit" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60" />
          <input value={form.per_user_limit} onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })} inputMode="numeric" placeholder="Per user limit" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60" />
          <input value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} placeholder="Cities (comma separated)" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60" />
          <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60" />
          <label className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2.5 text-sm ring-1 ring-border/60">
            <input type="checkbox" checked={form.hidden} onChange={(e) => setForm({ ...form, hidden: e.target.checked })} /> Hidden (code only)
          </label>
        </div>
        <button onClick={create} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
        </button>
      </section>

      <section className="mx-4 mt-4 space-y-2 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="font-display text-sm font-bold">Bulk operations</p>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={3} placeholder="code,title,discount_type,discount_value,minimum_order,maximum_discount,usage_limit,per_user_limit,end_date" className="w-full rounded-2xl bg-muted/50 px-3 py-2.5 text-xs outline-none ring-1 ring-border/60" />
        <div className="flex gap-2">
          <button onClick={importCsv} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-sm font-bold disabled:opacity-60"><Upload className="h-4 w-4" /> Import CSV</button>
          <button onClick={exportCsv} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-sm font-bold"><Download className="h-4 w-4" /> Export CSV</button>
        </div>
      </section>

      <section className="mx-4 mt-4 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="flex items-center gap-2 font-display text-sm font-bold"><ShieldCheck className="h-4 w-4 text-primary" /> Fraud signals</p>
        {fraud.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No suspicious redemption patterns detected.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {fraud.map((f, i) => (
              <li key={f.key} className="flex items-start gap-2 rounded-2xl bg-amber-50 p-2.5 text-[12px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span><b>{f.label}</b> — {f.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mx-4 mt-5 flex flex-wrap items-center gap-2">
        {(["all", "active", "pending", "paused", "expired"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{f}</button>
        ))}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code" className="ml-auto rounded-full bg-muted/50 px-3 py-1.5 text-sm outline-none ring-1 ring-border/60" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <ul className="mx-4 mt-3 space-y-3">
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
                      {c.hidden && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">hidden</span>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.title} · {stats.redemptions} used · {formatPrice(stats.revenue)} revenue · {stats.roi}x ROI</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.approved === false && <button onClick={() => approve(c)} className="rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">Approve</button>}
                  <button onClick={() => toggle(c)} className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider">{st === "active" ? "Pause" : "Activate"}</button>
                  <button onClick={() => duplicate(c)} className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider">Duplicate</button>
                  <button onClick={() => setCouponStatus(c.id, "expired", actor).then(refresh)} className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider">Expire</button>
                  <button onClick={() => remove(c)} className="rounded-full bg-rose-100 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-rose-700">Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mx-4 mt-5 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="font-display text-sm font-bold">Audit trail</p>
        {audit.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No coupon changes recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {audit.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="truncate"><b>{a.action}</b> · {a.actor_email ?? a.actor_role ?? "system"}</span>
                <span className="shrink-0 text-muted-foreground">{a.created_at ? new Date(a.created_at).toLocaleString() : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
