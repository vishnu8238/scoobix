import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { formatPrice } from "@/lib/format";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listTable, createRecord } from "@/lib/insforge-crud";
import { partnerRestaurant } from "@/lib/role-data";
import { EmptyState } from "@/components/cravio/EmptyState";

export const Route = createFileRoute("/partner/addons")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Add-ons & variants" }] }),
  component: AddonsPage,
});

type MenuRow = { id: string; name?: string; restaurant_id?: string };
type AddonRow = { id: string; dish_id?: string; name?: string; price?: number; available?: boolean; is_variant?: boolean };

type Group = {
  dishId: string;
  dish: string;
  variants: { name: string; price: number }[];
  addons: { name: string; price: number }[];
};

function AddonsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const rawId = partnerRestaurant?.id ? String(partnerRestaurant.id) : "";
    // Backend ids are uuids; skip the filter for seed slugs so PostgREST
    // doesn't reject the query.
    const rid = /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : "";
    const [dishes, addons] = await Promise.all([
      listTable<MenuRow>("menu_items", { limit: 500, restaurant_id: rid ? `eq.${rid}` : undefined }),

      listTable<AddonRow>("addons", { limit: 2000 }),
    ]);
    const byDish = new Map<string, AddonRow[]>();
    for (const a of addons) {
      const key = String(a.dish_id ?? "");
      byDish.set(key, [...(byDish.get(key) ?? []), a]);
    }
    setGroups(
      dishes.map((d) => {
        const rows = byDish.get(String(d.id)) ?? [];
        return {
          dishId: String(d.id),
          dish: d.name ?? "Untitled",
          variants: rows.filter((r) => r.is_variant).map((r) => ({ name: r.name ?? "", price: Number(r.price ?? 0) })),
          addons: rows.filter((r) => !r.is_variant).map((r) => ({ name: r.name ?? "", price: Number(r.price ?? 0) })),
        };
      }),
    );
    setLoaded(true);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addAddon = async (g: Group) => {
    const name = typeof window !== "undefined" ? window.prompt(`New add-on for ${g.dish}`) : null;
    if (!name) return;
    const priceStr = typeof window !== "undefined" ? window.prompt("Price (₹)", "50") : "0";
    const created = await createRecord("addons", {
      dish_id: g.dishId,
      name,
      price: Number(priceStr ?? 0) || 0,
      available: true,
    });
    if (!created) return toast.error("Couldn't save add-on");
    toast.success("Add-on added");
    void load();
  };

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Add-ons & variants" subtitle="Customise sizes and toppings" />

      <div className="space-y-5 px-4 pt-4">
        {loaded && groups.length === 0 && (
          <EmptyState icon={<Plus className="h-6 w-6" />} title="No dishes yet" description="Add menu items first, then attach add-ons here." />
        )}

        {groups.map((m) => (
          <section key={m.dishId} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">{m.dish}</h2>
              <button className="text-[11px] font-bold uppercase tracking-wider text-primary"><Pencil className="mr-1 inline h-3 w-3" />Edit</button>
            </div>

            <div className="mt-4">
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Variants</h3>
              {m.variants.length === 0 ? (
                <p className="text-xs text-muted-foreground">No variants yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {m.variants.map((v) => (
                    <li key={v.name} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                      <span>{v.name}</span>
                      <span className="font-bold">{v.price === 0 ? "Base" : `+${formatPrice(v.price)}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4">
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Add-ons</h3>
              {m.addons.length === 0 ? (
                <p className="text-xs text-muted-foreground">No add-ons yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {m.addons.map((a) => (
                    <li key={a.name} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                      <span>{a.name}</span>
                      <span className="font-bold">+{formatPrice(a.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button onClick={() => void addAddon(m)} variant="ghost" className="mt-3 w-full rounded-2xl border-2 border-dashed border-border text-sm"><Plus className="mr-1 h-4 w-4" /> New add-on</Button>
          </section>
        ))}
      </div>
    </div>
  );
}
