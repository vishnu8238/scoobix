import { createFileRoute } from "@tanstack/react-router";
import { adminDrivers } from "@/lib/role-data";
import { DataTable, StatusBadge } from "./admin.index";
import { Star, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/drivers")({
  head: () => ({ meta: [{ title: "Cravio Admin · Drivers" }] }),
  component: AdminDrivers,
});

function AdminDrivers() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Drivers</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Delivery partners</h1>
        </div>
        <button className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
          <Plus className="h-4 w-4" /> Add driver
        </button>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["ID", "Name", "Vehicle", "Rating", "Deliveries", "Status", ""]}
          rows={adminDrivers.map((d) => [
            <span className="font-bold text-primary">{d.id}</span>,
            <span className="font-bold">{d.name}</span>,
            <span className="text-muted-foreground">{d.vehicle}</span>,
            <span className="flex items-center gap-1 font-bold"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {d.rating.toFixed(2)}</span>,
            d.deliveries,
            <StatusBadge label={d.status} />,
            <button className="text-[12px] font-bold text-primary">Manage</button>,
          ])}
        />
      </section>
    </div>
  );
}
