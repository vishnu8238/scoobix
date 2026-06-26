import { createFileRoute } from "@tanstack/react-router";
import { adminPayments } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Cravio Admin · Payments" }] }),
  component: AdminPayments,
});

function AdminPayments() {
  const total = adminPayments.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Payments</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Payouts & commissions</h1>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-strong px-5 py-3 text-primary-foreground shadow-glow">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Settled this week</p>
          <p className="font-display text-2xl font-extrabold">{formatPrice(total)}</p>
        </div>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["ID", "Party", "Type", "Amount", "Date", "Status", ""]}
          rows={adminPayments.map((p) => [
            <span className="font-bold text-primary">{p.id}</span>,
            <span className="font-bold">{p.party}</span>,
            <span className="text-muted-foreground">{p.type}</span>,
            <span className="font-display font-extrabold">{formatPrice(p.amount)}</span>,
            <span className="text-muted-foreground">{p.date}</span>,
            <StatusBadge label={p.status} />,
            <button className="text-[12px] font-bold text-primary">Details</button>,
          ])}
        />
      </section>
    </div>
  );
}
