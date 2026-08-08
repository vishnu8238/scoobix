import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { partnerMenu } from "@/lib/role-data";
import type { Dish } from "@/lib/mock-data";
import { Plus, Pencil, Trash2, X, Leaf, Sparkles, Trophy } from "lucide-react";
import { cn, formatPrice } from "@/lib/format";
import { toast } from "sonner";
import { partnerRestaurant } from "@/lib/role-data";
import { upsertMenuItem, deleteMenuItem, upsertAddon, deleteAddon } from "@/lib/insforge";
import { usePartnerRestaurant } from "@/lib/partner-store";

export const Route = createFileRoute("/partner/menu")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Menu" }] }),
  component: PartnerMenu,
});

const CATEGORIES = ["All", "Starters", "Main Course", "Drinks", "Desserts"] as const;

export type DishAddon = { id: string; name: string; price: number; available: boolean };
type EditableDish = Dish & { available: boolean; recommended?: boolean; bestSeller?: boolean; hasAddons?: boolean; addons?: DishAddon[] };

function PartnerMenu() {
  const { restaurant, restaurantId } = usePartnerRestaurant();
  const rid = restaurantId || partnerRestaurant.id;
  const [items, setItems] = useState<EditableDish[]>([]);
  const syncedFor = useRef<string | null>(null);

  // Load the resolved restaurant's live menu once identity resolves.
  useEffect(() => {
    if (!rid) { setItems([]); return; }
    if (syncedFor.current === rid) return;
    
    let cancelled = false;
    void (async () => {
      const { listTable } = await import("@/lib/insforge-crud");
      const rows = await listTable<any>("menu_items", { 
        restaurant_id: `eq.${rid}`,
        order: "created_at.desc",
        limit: 200
      }, { fresh: true });
      
      if (cancelled) return;
      syncedFor.current = rid;
      
      if (rows.length > 0) {
        setItems(rows.map((row) => ({
          id: row.id,
          name: row.name ?? "Untitled",
          description: row.description ?? "",
          price: Number(row.price ?? 0),
          image: row.image_url || "/placeholder.svg",
          category: row.category ?? "Main Course",
          veg: row.veg_type === "veg",
          available: row.available !== false,
          recommended: !!row.recommended,
          bestSeller: !!row.best_seller
        } as EditableDish)));
      } else {
        // Fallback to role-data if no live items yet
        const menu = partnerMenu as Dish[];
        setItems(menu.map((d) => ({ available: true, ...d }) as EditableDish));
      }
    })();
    
    return () => { cancelled = true; };
  }, [rid, restaurant]);

  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const [editing, setEditing] = useState<EditableDish | null>(null);
  const [showNew, setShowNew] = useState(false);

  const visible = cat === "All" ? items : items.filter((d) => d.category === cat);

  const toggle = (id: string) => setItems((prev) => prev.map((d) => {
    if (d.id !== id) return d;
    const next = { ...d, available: !d.available };
    void upsertMenuItem({ id: next.id, restaurant_id: rid, name: next.name, price: next.price, available: next.available });
    return next;
  }));
  const toggleVeg = (id: string) => setItems((prev) => prev.map((d) => {
    if (d.id !== id) return d;
    const next = { ...d, veg: !d.veg };
    void upsertMenuItem({ id: next.id, restaurant_id: rid, name: next.name, price: next.price, veg_type: next.veg ? "veg" : "non_veg" });
    return next;
  }));
  const toggleRecommended = (id: string) => setItems((prev) => prev.map((d) => {
    if (d.id !== id) return d;
    const next = { ...d, recommended: !d.recommended };
    void upsertMenuItem({ id: next.id, restaurant_id: rid, name: next.name, price: next.price, recommended: !!next.recommended });
    return next;
  }));
  const toggleBestSeller = (id: string) => setItems((prev) => prev.map((d) => {
    if (d.id !== id) return d;
    const next = { ...d, bestSeller: !d.bestSeller };
    void upsertMenuItem({ id: next.id, restaurant_id: rid, name: next.name, price: next.price, best_seller: !!next.bestSeller });
    return next;
  }));
  const remove = (id: string) => {
    void deleteMenuItem(id);
    setItems((prev) => prev.filter((d) => d.id !== id));
    toast.success("Item removed");
  };
  const save = async (d: EditableDish) => {
    const { upsertMenuItem } = await import("@/lib/insforge");
    void upsertMenuItem({
      id: d.id,
      restaurant_id: rid,
      name: d.name,
      description: d.description,
      price: d.price,
      image_url: d.image,
      category: d.category,
      veg_type: d.veg ? "veg" : "non_veg",
      available: d.available,
      recommended: !!d.recommended,
      best_seller: !!d.bestSeller,
    }).then(res => {
      if (res.ok) {
        import("@/lib/insforge-crud").then(m => m.invalidateTable("menu_items"));
      }
    });
    (d.addons ?? []).forEach((a) => {
      void upsertAddon({ id: a.id, dish_id: d.id, name: a.name, price: a.price, available: a.available });
    });
    // Track removed addons against previous version
    setItems((prev) => {
      const old = prev.find((x) => x.id === d.id);
      const oldIds = new Set((old?.addons ?? []).map((a) => a.id));
      const newIds = new Set((d.addons ?? []).map((a) => a.id));
      oldIds.forEach((id) => { if (!newIds.has(id)) void deleteAddon(id); });
      return prev.some((x) => x.id === d.id) ? prev.map((x) => (x.id === d.id ? d : x)) : [...prev, d];
    });
    setEditing(null); setShowNew(false);
    toast.success("Menu updated");
  };

  return (
    <div className="animate-fade-up px-5 pt-7">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="eyebrow">Menu</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Manage menu</h1>
        </div>
        <button onClick={() => setShowNew(true)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow transition active:scale-90">
          <Plus className="h-5 w-5" strokeWidth={2.6} />
        </button>
      </header>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[12px] font-bold transition",
              cat === c ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground",
            )}
          >{c}</button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((d) => (
          <div key={d.id} className={cn("flex gap-3 rounded-3xl bg-card p-3 shadow-soft ring-1 ring-border/60 transition", !d.available && "opacity-60")}>
            <img src={d.image} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-sm font-bold flex items-center gap-1.5">
                  <button
                    onClick={() => toggleVeg(d.id)}
                    title={d.veg ? "Veg — click to mark non-veg" : "Non-veg — click to mark veg"}
                    className={cn(
                      "grid h-4 w-4 place-items-center rounded-sm border-2 transition active:scale-90",
                      d.veg ? "border-primary" : "border-rose-600",
                    )}
                  >
                    <Leaf className={cn("h-2.5 w-2.5", d.veg ? "text-primary fill-primary" : "text-rose-600 fill-rose-600")} />
                  </button>
                  <span className="truncate">{d.name}</span>
                </h3>
                <span className="font-display text-sm font-extrabold text-primary">{formatPrice(d.price)}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{d.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => toggleRecommended(d.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition active:scale-95",
                    d.recommended ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                ><Sparkles className="h-2.5 w-2.5" /> Recommended</button>
                <button
                  onClick={() => toggleBestSeller(d.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition active:scale-95",
                    d.bestSeller ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground",
                  )}
                ><Trophy className="h-2.5 w-2.5" /> Best seller</button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="relative inline-flex h-5 w-9 items-center">
                    <input type="checkbox" checked={d.available} onChange={() => toggle(d.id)} className="peer sr-only" />
                    <span className="absolute inset-0 rounded-full bg-muted transition peer-checked:bg-primary" />
                    <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                  </span>
                  {d.available ? "Available" : "Hidden"}
                </label>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(d)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground transition hover:bg-primary/10 hover:text-primary">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(d.id)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(editing || showNew) && (
        <EditSheet
          dish={editing}
          onClose={() => { setEditing(null); setShowNew(false); }}
          onSave={save}
        />
      )}
    </div>
  );
}

function EditSheet({ dish, onClose, onSave }: { dish: EditableDish | null; onClose: () => void; onSave: (d: EditableDish) => void }) {
  const [name, setName] = useState(dish?.name ?? "");
  const [price, setPrice] = useState(String(dish?.price ?? ""));
  const [desc, setDesc] = useState(dish?.description ?? "");
  const [category, setCategory] = useState<Dish["category"]>(dish?.category ?? "Main Course");
  const [hasAddons, setHasAddons] = useState<boolean>(dish?.hasAddons ?? (dish?.addons?.length ?? 0) > 0);
  const [addons, setAddons] = useState<DishAddon[]>(dish?.addons ?? []);
  const [aName, setAName] = useState("");
  const [aPrice, setAPrice] = useState("");

  const addAddon = () => {
    if (!aName.trim()) return;
    setAddons((prev) => [...prev, { id: `a${Date.now()}`, name: aName.trim(), price: parseFloat(aPrice) || 0, available: true }]);
    setAName(""); setAPrice("");
  };
  const updateAddon = (id: string, patch: Partial<DishAddon>) =>
    setAddons((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const removeAddon = (id: string) => setAddons((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[480px] max-h-[92svh] overflow-y-auto rounded-t-3xl bg-card p-6 shadow-pop animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">{dish ? "Edit item" : "New item"}</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-2xl bg-muted px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40" /></Field>
          <Field label="Price"><input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.5" className="w-full rounded-2xl bg-muted px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40" /></Field>
          <Field label="Description"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="w-full rounded-2xl bg-muted px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40" /></Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value as Dish["category"])} className="w-full rounded-2xl bg-muted px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40">
              {["Starters", "Main Course", "Drinks", "Desserts"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>

          <div className="rounded-2xl bg-muted/60 p-3 ring-1 ring-border/60">
            <label className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Add-ons / Toppings</span>
              <span className="relative inline-flex h-5 w-9 items-center">
                <input type="checkbox" checked={hasAddons} onChange={() => setHasAddons((v) => !v)} className="peer sr-only" />
                <span className="absolute inset-0 rounded-full bg-muted-foreground/30 transition peer-checked:bg-primary" />
                <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
              </span>
            </label>

            {hasAddons && (
              <div className="mt-3 space-y-2">
                {addons.length === 0 && <p className="text-[11px] text-muted-foreground">No add-ons yet. Add one below.</p>}
                {addons.map((a) => (
                  <div key={a.id} className={cn("flex items-center gap-2 rounded-xl bg-card px-3 py-2 ring-1 ring-border/60", !a.available && "opacity-60")}>
                    <input
                      value={a.name}
                      onChange={(e) => updateAddon(a.id, { name: e.target.value })}
                      className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none"
                    />
                    <div className="flex items-center gap-0.5 text-sm font-bold text-primary">
                      <span>+₹</span>
                      <input
                        value={String(a.price)}
                        onChange={(e) => updateAddon(a.id, { price: parseFloat(e.target.value) || 0 })}
                        type="number"
                        className="w-14 bg-transparent text-right outline-none"
                      />
                    </div>
                    <label className="relative inline-flex h-5 w-9 items-center" title={a.available ? "Available" : "Disabled"}>
                      <input type="checkbox" checked={a.available} onChange={() => updateAddon(a.id, { available: !a.available })} className="peer sr-only" />
                      <span className="absolute inset-0 rounded-full bg-muted-foreground/30 transition peer-checked:bg-primary" />
                      <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                    </label>
                    <button onClick={() => removeAddon(a.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-2">
                  <input
                    value={aName}
                    onChange={(e) => setAName(e.target.value)}
                    placeholder="Add-on name (e.g. Extra Cheese)"
                    className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                  />
                  <input
                    value={aPrice}
                    onChange={(e) => setAPrice(e.target.value)}
                    placeholder="₹40"
                    type="number"
                    className="w-16 bg-transparent text-right text-sm outline-none"
                  />
                  <button onClick={addAddon} className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground active:scale-90">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => onSave({
            id: dish?.id ?? `n${Date.now()}`,
            name: name || "Untitled",
            price: parseFloat(price) || 0,
            description: desc,
            image: dish?.image ?? "/placeholder.svg",
            rating: dish?.rating ?? 4.5,
            category, cuisineTag: dish?.cuisineTag ?? "House",
            available: true,
            hasAddons,
            addons: hasAddons ? addons : [],
          })}
          className="mt-5 w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          {dish ? "Save changes" : "Add to menu"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
