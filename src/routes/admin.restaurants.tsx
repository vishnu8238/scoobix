import { createFileRoute } from "@tanstack/react-router";
import { adminRestaurants } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { DataTable, StatusBadge } from "./admin.index";
import { Star, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/restaurants")({
  head: () => ({ meta: [{ title: "Cravio Admin · Restaurants" }] }),
  component: AdminRestaurants,
});

function AdminRestaurants() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Restaurants</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Partner restaurants</h1>
        </div>
        <button className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
          <Plus className="h-4 w-4" /> Onboard restaurant
        </button>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["Restaurant", "Cuisine", "Rating", "Orders", "Revenue", "Status", ""]}
          rows={adminRestaurants.map((r) => [
            <div className="flex items-center gap-3">
              <img src={r.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
              <span className="font-bold">{r.name}</span>
            </div>,
            <span className="text-muted-foreground">{r.cuisine}</span>,
            <span className="flex items-center gap-1 font-bold"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {r.rating.toFixed(1)}</span>,
            r.orders,
            <span className="font-display font-extrabold text-primary">{formatPrice(r.revenue)}</span>,
            <StatusBadge label={r.status} />,
            <button className="text-[12px] font-bold text-primary">View</button>,
          ])}
        />
      </section>
    </div>
  );
}
