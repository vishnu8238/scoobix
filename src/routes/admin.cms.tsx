import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles, Image as ImageIcon, LayoutGrid, Layers, SlidersHorizontal, Ticket,
  Plus, Trash2, ChevronUp, ChevronDown, Pencil, X, Eye, EyeOff, RotateCcw, Check, Leaf, Star,
} from "lucide-react";
import {
  useCms, CMS_IMAGE_OPTIONS,
  type Banner, type CmsCategory, type CmsCoupon, type FilterGroupKey,
} from "@/lib/cms-store";
import { restaurants as allRestaurants, allDishes, findDish } from "@/lib/mock-data";
import { isPureVeg } from "@/lib/restaurant-extras";
import { cn, currency } from "@/lib/format";

export const Route = createFileRoute("/admin/cms")({
  head: () => ({ meta: [{ title: "Cravio Admin · CMS Studio" }] }),
  component: CmsStudio,
});

type TabKey = "banners" | "categories" | "sections" | "filters" | "offers" | "veg";

const TABS: { key: TabKey; label: string; icon: any; hint: string }[] = [
  { key: "banners", label: "Home Carousel", icon: ImageIcon, hint: "Promo banners shown on the customer home" },
  { key: "categories", label: "Categories", icon: LayoutGrid, hint: "Cuisine pills on the home rail" },
  { key: "sections", label: "Home Sections", icon: Layers, hint: "Toggle visibility of homepage modules" },
  { key: "filters", label: "Filters", icon: SlidersHorizontal, hint: "Search & discover filter chips" },
  { key: "offers", label: "Offers & Coupons", icon: Ticket, hint: "Discount codes and promotions" },
  { key: "veg", label: "Veg / Non-veg", icon: Leaf, hint: "Restaurant & dish veg classification" },
];

function CmsStudio() {
  const [tab, setTab] = useState<TabKey>("banners");
  const { resetAll } = useCms();
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> CMS Studio</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">Customer app content</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{active.hint}. Changes save instantly and reflect across the Cravio customer experience.</p>
        </div>
        <button
          onClick={() => { resetAll(); toast.success("CMS reset to defaults"); }}
          className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 text-sm font-bold shadow-soft ring-1 ring-border transition hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </header>

      <nav className="no-scrollbar flex gap-2 overflow-x-auto rounded-3xl bg-card p-2 shadow-soft ring-1 ring-border/60">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition",
                isActive ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </nav>

      <div className="animate-fade-up">
        {tab === "banners" && <BannersPanel />}
        {tab === "categories" && <CategoriesPanel />}
        {tab === "sections" && <SectionsPanel />}
        {tab === "filters" && <FiltersPanel />}
        {tab === "offers" && <OffersPanel />}
        {tab === "veg" && <VegPanel />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SHARED                                                              */
/* ------------------------------------------------------------------ */

function Card({ children, className }: { children: any; className?: string }) {
  return <div className={cn("rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60", className)}>{children}</div>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition",
        checked ? "bg-primary shadow-glow" : "bg-muted",
      )}
    >
      <span className={cn(
        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
        checked ? "left-[22px]" : "left-0.5",
      )} />
    </button>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "h-10 w-full rounded-xl bg-muted/40 px-3 text-sm font-medium outline-none ring-1 ring-border/60 transition focus:bg-background focus:ring-2 focus:ring-primary/40";

function ImagePicker({ value, onChange }: { value: string; onChange: (src: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CMS_IMAGE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.src)}
          className={cn(
            "relative h-14 w-14 overflow-hidden rounded-xl ring-2 transition",
            value === opt.src ? "ring-primary scale-105" : "ring-transparent hover:ring-border",
          )}
        >
          <img src={opt.src} alt={opt.key} className="h-full w-full object-cover" />
          {value === opt.src && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/30">
              <Check className="h-5 w-5 text-white" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: any }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm animate-fade-up">
      <div className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-pop ring-1 ring-border/60">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-extrabold">{title}</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-muted hover:bg-foreground/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. BANNERS                                                          */
/* ------------------------------------------------------------------ */

function BannersPanel() {
  const { banners, addBanner, updateBanner, deleteBanner, moveBanner } = useCms();
  const [editing, setEditing] = useState<Banner | "new" | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{banners.length} banners · {banners.filter((b) => b.active).length} live</p>
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          <Plus className="h-4 w-4" /> Add banner
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {banners.map((b) => (
          <Card key={b.id} className="p-0 overflow-hidden">
            <div className="relative h-40">
              <img src={b.image} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="font-display text-lg font-extrabold text-white">{b.title}</p>
                <p className="text-xs text-white/80">{b.subtitle}</p>
              </div>
              <span className={cn(
                "absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider",
                b.active ? "bg-primary text-primary-foreground" : "bg-zinc-800/80 text-white",
              )}>
                {b.active ? "Live" : "Hidden"}
              </span>
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-muted px-2 py-1 text-[11px] font-bold">#{b.order + 1}</span>
                <button onClick={() => moveBanner(b.id, -1)} className="grid h-8 w-8 place-items-center rounded-lg bg-muted hover:bg-foreground/10"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => moveBanner(b.id, 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-muted hover:bg-foreground/10"><ChevronDown className="h-4 w-4" /></button>
                <Toggle checked={b.active} onChange={() => { updateBanner(b.id, { active: !b.active }); }} />
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setEditing(b)} className="grid h-9 w-9 place-items-center rounded-xl bg-muted hover:bg-foreground/10"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => { deleteBanner(b.id); toast.success("Banner deleted"); }} className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <BannerEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            if (editing === "new") {
              addBanner(data);
              toast.success("Banner created");
            } else {
              updateBanner(editing.id, data);
              toast.success("Banner updated");
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function BannerEditor({ initial, onClose, onSave }: { initial: Banner | null; onClose: () => void; onSave: (b: Omit<Banner, "id" | "order">) => void }) {
  const [b, setB] = useState<Omit<Banner, "id" | "order">>({
    title: initial?.title ?? "",
    subtitle: initial?.subtitle ?? "",
    cta: initial?.cta ?? "Order now",
    code: initial?.code ?? "",
    image: initial?.image ?? CMS_IMAGE_OPTIONS[0].src,
    active: initial?.active ?? true,
  });
  return (
    <Modal open onClose={onClose} title={initial ? "Edit banner" : "New banner"}>
      <div className="space-y-4">
        <Field label="Image">
          <ImagePicker value={b.image} onChange={(image) => setB({ ...b, image })} />
        </Field>
        <Field label="Title">
          <input className={inputCls} value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} placeholder="50% OFF on first order" />
        </Field>
        <Field label="Subtitle">
          <input className={inputCls} value={b.subtitle} onChange={(e) => setB({ ...b, subtitle: e.target.value })} placeholder="Up to ₹800. Limited time." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CTA label">
            <input className={inputCls} value={b.cta} onChange={(e) => setB({ ...b, cta: e.target.value })} />
          </Field>
          <Field label="Promo code">
            <input className={inputCls} value={b.code} onChange={(e) => setB({ ...b, code: e.target.value.toUpperCase() })} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
          <div>
            <p className="text-sm font-bold">Active</p>
            <p className="text-xs text-muted-foreground">Show this banner on the customer home</p>
          </div>
          <Toggle checked={b.active} onChange={() => setB({ ...b, active: !b.active })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-2xl bg-muted px-5 py-2.5 text-sm font-bold">Cancel</button>
          <button onClick={() => onSave(b)} disabled={!b.title} className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">Save</button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 2. CATEGORIES                                                       */
/* ------------------------------------------------------------------ */

function CategoriesPanel() {
  const { categories, addCategory, updateCategory, deleteCategory, moveCategory } = useCms();
  const [editing, setEditing] = useState<CmsCategory | "new" | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{categories.length} categories · drag with arrows to reorder</p>
        <button onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-95">
          <Plus className="h-4 w-4" /> Add category
        </button>
      </div>

      <Card className="p-0">
        <ul className="divide-y divide-border/60">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-4 p-4">
              <span className="w-7 text-center text-[11px] font-bold text-muted-foreground">{c.order + 1}</span>
              <div className="relative h-12 w-12 overflow-hidden rounded-2xl">
                <img src={c.image} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 grid place-items-center bg-black/30 text-xl">{c.emoji}</span>
              </div>
              <div className="flex-1">
                <p className="font-bold">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">id: {c.id}</p>
              </div>
              <Toggle checked={c.active} onChange={() => updateCategory(c.id, { active: !c.active })} />
              <button onClick={() => moveCategory(c.id, -1)} className="grid h-8 w-8 place-items-center rounded-lg bg-muted hover:bg-foreground/10"><ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => moveCategory(c.id, 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-muted hover:bg-foreground/10"><ChevronDown className="h-4 w-4" /></button>
              <button onClick={() => setEditing(c)} className="grid h-9 w-9 place-items-center rounded-xl bg-muted hover:bg-foreground/10"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => { deleteCategory(c.id); toast.success("Category deleted"); }} className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </Card>

      {editing && (
        <CategoryEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            if (editing === "new") { addCategory(data); toast.success("Category added"); }
            else { updateCategory(editing.id, data); toast.success("Category updated"); }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryEditor({ initial, onClose, onSave }: { initial: CmsCategory | null; onClose: () => void; onSave: (c: Omit<CmsCategory, "id" | "order">) => void }) {
  const [c, setC] = useState<Omit<CmsCategory, "id" | "order">>({
    name: initial?.name ?? "",
    emoji: initial?.emoji ?? "🍽️",
    image: initial?.image ?? CMS_IMAGE_OPTIONS[0].src,
    active: initial?.active ?? true,
  });
  return (
    <Modal open onClose={onClose} title={initial ? "Edit category" : "New category"}>
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_88px] gap-3">
          <Field label="Name"><input className={inputCls} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field label="Emoji"><input className={cn(inputCls, "text-center text-xl")} value={c.emoji} onChange={(e) => setC({ ...c, emoji: e.target.value })} maxLength={2} /></Field>
        </div>
        <Field label="Image"><ImagePicker value={c.image} onChange={(image) => setC({ ...c, image })} /></Field>
        <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
          <div><p className="text-sm font-bold">Active</p><p className="text-xs text-muted-foreground">Visible to customers</p></div>
          <Toggle checked={c.active} onChange={() => setC({ ...c, active: !c.active })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-2xl bg-muted px-5 py-2.5 text-sm font-bold">Cancel</button>
          <button onClick={() => onSave(c)} disabled={!c.name} className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">Save</button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 3. SECTIONS                                                         */
/* ------------------------------------------------------------------ */

function SectionsPanel() {
  const { sections, toggleSection } = useCms();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sections.map((s) => (
        <Card key={s.key} className="flex items-center gap-4">
          <div className={cn(
            "grid h-12 w-12 place-items-center rounded-2xl",
            s.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}>
            {s.active ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </div>
          <div className="flex-1">
            <p className="font-display text-lg font-extrabold">{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.description}</p>
          </div>
          <Toggle checked={s.active} onChange={() => { toggleSection(s.key); toast.success(`${s.label} ${s.active ? "hidden" : "enabled"}`); }} />
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. FILTERS                                                          */
/* ------------------------------------------------------------------ */

function FiltersPanel() {
  const { filters, toggleFilter, addFilter, deleteFilter } = useCms();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {filters.map((g) => (
        <FilterGroupCard
          key={g.key}
          groupKey={g.key}
          label={g.label}
          options={g.options}
          onToggle={(id) => toggleFilter(g.key, id)}
          onAdd={(label) => addFilter(g.key, label)}
          onDelete={(id) => deleteFilter(g.key, id)}
        />
      ))}
    </div>
  );
}

function FilterGroupCard({ groupKey, label, options, onToggle, onAdd, onDelete }: {
  groupKey: FilterGroupKey;
  label: string;
  options: { id: string; label: string; active: boolean }[];
  onToggle: (id: string) => void;
  onAdd: (label: string) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-extrabold">{label}</p>
          <p className="text-xs text-muted-foreground">{options.filter((o) => o.active).length} of {options.length} active</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{groupKey}</span>
      </div>

      <div className="space-y-2">
        {options.map((o) => (
          <div key={o.id} className="flex items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2">
            <Toggle checked={o.active} onChange={() => onToggle(o.id)} />
            <span className="flex-1 text-sm font-medium">{o.label}</span>
            <button onClick={() => onDelete(o.id)} className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (!draft.trim()) return; onAdd(draft.trim()); setDraft(""); }}
        className="mt-4 flex gap-2"
      >
        <input className={inputCls} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add option…" />
        <button className="rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-glow"><Plus className="h-4 w-4" /></button>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 5. OFFERS / COUPONS                                                 */
/* ------------------------------------------------------------------ */

function OffersPanel() {
  const { coupons, addCoupon, updateCoupon, deleteCoupon } = useCms();
  const [editing, setEditing] = useState<CmsCoupon | "new" | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{coupons.length} coupons · {coupons.filter((c) => c.active).length} active</p>
        <button onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow active:scale-95">
          <Plus className="h-4 w-4" /> New coupon
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {coupons.map((c) => {
          const expired = new Date(c.expiry) < new Date();
          return (
            <Card key={c.id} className="relative overflow-hidden">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Ticket className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-lg font-extrabold">{c.title}</p>
                    {!c.active && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase">Off</span>}
                    {expired && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">Expired</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.subtitle}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                    <span className="rounded-lg bg-primary/10 px-2 py-1 text-primary font-mono tracking-wider">{c.code}</span>
                    <span className="rounded-lg bg-muted px-2 py-1">
                      {c.kind === "pct" ? `${c.value}% off` : c.kind === "flat" ? `₹${c.value} off` : "Free delivery"}
                    </span>
                    <span className="rounded-lg bg-muted px-2 py-1">Min ₹{c.minOrder}</span>
                    <span className="rounded-lg bg-muted px-2 py-1">Exp {c.expiry}</span>
                  </div>
                </div>
              </div>
              <div className="relative mt-4 flex items-center justify-between border-t border-dashed border-border pt-3">
                <Toggle checked={c.active} onChange={() => updateCoupon(c.id, { active: !c.active })} />
                <div className="flex gap-1.5">
                  <button onClick={() => setEditing(c)} className="grid h-9 w-9 place-items-center rounded-xl bg-muted hover:bg-foreground/10"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => { deleteCoupon(c.id); toast.success("Coupon deleted"); }} className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {editing && (
        <CouponEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            if (editing === "new") { addCoupon(data); toast.success("Coupon created"); }
            else { updateCoupon(editing.id, data); toast.success("Coupon updated"); }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CouponEditor({ initial, onClose, onSave }: { initial: CmsCoupon | null; onClose: () => void; onSave: (c: Omit<CmsCoupon, "id">) => void }) {
  const [c, setC] = useState<Omit<CmsCoupon, "id">>({
    code: initial?.code ?? "",
    title: initial?.title ?? "",
    subtitle: initial?.subtitle ?? "",
    kind: initial?.kind ?? "pct",
    value: initial?.value ?? 10,
    minOrder: initial?.minOrder ?? 300,
    expiry: initial?.expiry ?? "2026-12-31",
    active: initial?.active ?? true,
  });
  return (
    <Modal open onClose={onClose} title={initial ? "Edit coupon" : "New coupon"}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code"><input className={cn(inputCls, "font-mono uppercase tracking-wider")} value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Discount type">
            <select className={inputCls} value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value as CmsCoupon["kind"] })}>
              <option value="pct">% off</option>
              <option value="flat">Flat ₹ off</option>
              <option value="freeship">Free delivery</option>
            </select>
          </Field>
        </div>
        <Field label="Title"><input className={inputCls} value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} /></Field>
        <Field label="Subtitle"><input className={inputCls} value={c.subtitle} onChange={(e) => setC({ ...c, subtitle: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={c.kind === "pct" ? "% value" : c.kind === "flat" ? "₹ value" : "Value"}>
            <input type="number" className={inputCls} value={c.value} onChange={(e) => setC({ ...c, value: Number(e.target.value) })} disabled={c.kind === "freeship"} />
          </Field>
          <Field label="Min order ₹"><input type="number" className={inputCls} value={c.minOrder} onChange={(e) => setC({ ...c, minOrder: Number(e.target.value) })} /></Field>
          <Field label="Expiry"><input type="date" className={inputCls} value={c.expiry} onChange={(e) => setC({ ...c, expiry: e.target.value })} /></Field>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
          <div><p className="text-sm font-bold">Active</p><p className="text-xs text-muted-foreground">Customers can apply this code</p></div>
          <Toggle checked={c.active} onChange={() => setC({ ...c, active: !c.active })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-2xl bg-muted px-5 py-2.5 text-sm font-bold">Cancel</button>
          <button onClick={() => onSave(c)} disabled={!c.code || !c.title} className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">Save</button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 6. VEG / NON-VEG                                                    */
/* ------------------------------------------------------------------ */

function VegPanel() {
  const { pureVegOverrides, setPureVeg, dishVegOverrides, setDishVeg } = useCms();
  const [tab, setTab] = useState<"restaurants" | "dishes">("restaurants");
  const dishes = allDishes();

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("restaurants")}
          className={cn(
            "rounded-2xl px-4 py-2 text-sm font-bold transition",
            tab === "restaurants" ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground",
          )}
        >Restaurants</button>
        <button
          onClick={() => setTab("dishes")}
          className={cn(
            "rounded-2xl px-4 py-2 text-sm font-bold transition",
            tab === "dishes" ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground",
          )}
        >Dishes</button>
      </div>

      {tab === "restaurants" ? (
        <Card className="p-0">
          <ul className="divide-y divide-border/60">
            {allRestaurants.map((r) => {
              const pure = isPureVeg(r.id, pureVegOverrides);
              return (
                <li key={r.id} className="flex items-center gap-4 p-4">
                  <img src={r.cover} alt="" className="h-12 w-12 rounded-2xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-bold">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">{r.cuisine}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider",
                      pure ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >{pure ? "Pure Veg" : "Mixed"}</span>
                  <Toggle checked={pure} onChange={() => { setPureVeg(r.id, !pure); toast.success(`${r.name} marked ${!pure ? "pure veg" : "mixed"}`); }} />
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border/60">
            {dishes.map((d) => {
              const veg = d.id in dishVegOverrides ? dishVegOverrides[d.id] : !!d.veg;
              return (
                <li key={d.id} className="flex items-center gap-4 p-4">
                  <img src={d.image} alt="" className="h-12 w-12 rounded-2xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-bold">{d.name}</p>
                    <p className="text-[11px] text-muted-foreground">₹{d.price} · {d.category}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider",
                      veg ? "bg-primary text-primary-foreground" : "bg-rose-600 text-white",
                    )}
                  >{veg ? "Veg" : "Non-veg"}</span>
                  <Toggle checked={veg} onChange={() => setDishVeg(d.id, !veg)} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
