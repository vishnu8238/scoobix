import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { createRecord, deleteRecord, listTable, patchRecord } from "@/lib/insforge-crud";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/partner/coupons")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Coupons" }] }),
  component: PartnerCoupons,
});

type CouponRow = {
  id: string;
  restaurant_id?: string | null;
  code?: string | null;
  title?: string | null;
  discount_type?: string | null;
  discount_value?: number | null;
  minimum_order?: number | null;
  maximum_discount?: number | null;
  usage_limit?: number | null;
  used_count?: number | null;
  approved?: boolean | null;
  active?: boolean | null;
};

function PartnerCoupons() {
  const { restaurantId } = usePartnerRestaurant();
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", title: "", discount_type: "percent", discount_value: "10", minimum_order: "0" });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!restaurantId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setRows(await listTable<CouponRow>("coupons", { restaurant_id: `eq.${restaurantId}`, order: "created_at.desc", limit: 200 }));
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const add = async () => {
    if (!restaurantId) { toast.error("Restaurant not resolved yet"); return; }
    if (!form.code.trim() || !form.title.trim()) { toast.error("Add a code and title"); return; }
    setSaving(true);
    const created = await createRecord("coupons", {
      restaurant_id: restaurantId,
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      minimum_order: Number(form.minimum_order) || 0,
      used_count: 0,
      approved: false,
      active: true,
    });
    setSaving(false);
    if (!created) { toast.error("Could not create coupon"); return; }
    toast.success("Coupon submitted for approval");
    setForm({ code: "", title: "", discount_type: "percent", discount_value: "10", minimum_order: "0" });
    void refresh();
  };

  const toggle = async (c: CouponRow) => {
    await patchRecord("coupons", c.id, { active: !c.active });
    setRows((p) => p.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
  };

  const remove = async (c: CouponRow) => {
    await deleteRecord("coupons", c.id);
    setRows((p) => p.filter((x) => x.id !== c.id));
    toast.success("Coupon deleted");
  };

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Coupons" subtitle="Restaurant offers" />

      <section className="mx-4 mt-4 space-y-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="font-display text-sm font-bold">New coupon</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CODE" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm uppercase outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
          <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60">
            <option value="percent">Percent off</option>
            <option value="flat">Flat off</option>
          </select>
          <input value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} inputMode="numeric" placeholder="Value" className="rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
          <input value={form.minimum_order} onChange={(e) => setForm({ ...form, minimum_order: e.target.value })} inputMode="numeric" placeholder="Min order" className="col-span-2 rounded-2xl bg-muted/50 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:bg-background focus:ring-primary/40" />
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
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary"><Tag className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-extrabold">{c.code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{c.approved ? "Approved" : "Pending"}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.title} · {c.discount_type === "flat" ? formatPrice(c.discount_value ?? 0) : `${c.discount_value ?? 0}%`} off
                  {c.minimum_order ? ` · min ${formatPrice(c.minimum_order)}` : ""}
                </p>
              </div>
              <button onClick={() => toggle(c)} className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${c.active ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"}`}>{c.active ? "Live" : "Off"}</button>
              <button onClick={() => remove(c)} aria-label="Delete coupon" className="grid h-8 w-8 place-items-center rounded-full bg-rose-100 text-rose-700"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
