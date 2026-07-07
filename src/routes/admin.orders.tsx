import { createFileRoute } from "@tanstack/react-router";
import { adminOrdersRecent } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Orders" }] }),
  component: AdminOrders,
});

function AdminOrders() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Orders</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Live order ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitor every order across the platform in real time.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Placed today", value: "8,421" },
          { label: "In progress", value: "612" },
          { label: "Completed", value: "7,488" },
          { label: "Cancelled", value: "321" },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-display text-2xl font-extrabold">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["Order", "Customer", "Restaurant", "Total", "Status", "Time", ""]}
          rows={adminOrdersRecent.map((o) => [
            <span className="font-bold text-primary">{o.id}</span>,
            o.customer,
            o.restaurant,
            <span className="font-bold">{formatPrice(o.total)}</span>,
            <StatusBadge label={o.status} />,
            <span className="text-muted-foreground">{o.time}</span>,
            <button className="text-[12px] font-bold text-primary">View</button>,
          ])}
        />
      </section>
    </div>
  );
}
