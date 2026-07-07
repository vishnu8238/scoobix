import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { adminPayments } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Payments" }] }),
  component: AdminPayments,
});

type RefundStatus = "none" | "pending" | "refunded";

function AdminPayments() {
  const total = adminPayments.reduce((s, p) => s + p.amount, 0);
  const [refunds, setRefunds] = useState<Record<string, RefundStatus>>({});

  const cycle = (id: string) => {
    setRefunds((p) => {
      const cur = p[id] ?? "none";
      const next: RefundStatus = cur === "none" ? "pending" : cur === "pending" ? "refunded" : "none";
      toast.success(next === "none" ? "Refund cleared" : `Refund ${next}`);
      return { ...p, [id]: next };
    });
  };

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
          columns={["ID", "Party", "Type", "Amount", "Date", "Status", "Refund", ""]}
          rows={adminPayments.map((p) => {
            const refund = refunds[p.id] ?? "none";
            const refundCls =
              refund === "refunded" ? "bg-primary-soft text-primary"
              : refund === "pending" ? "bg-amber-100 text-amber-700"
              : "bg-muted text-muted-foreground";
            return [
              <span className="font-bold text-primary">{p.id}</span>,
              <span className="font-bold">{p.party}</span>,
              <span className="text-muted-foreground">{p.type}</span>,
              <span className="font-display font-extrabold">{formatPrice(p.amount)}</span>,
              <span className="text-muted-foreground">{p.date}</span>,
              <StatusBadge label={p.status} />,
              <button
                onClick={() => cycle(p.id)}
                className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider transition active:scale-95 ${refundCls}`}
              >
                {refund === "none" ? "Not refunded" : refund}
              </button>,
              <button className="text-[12px] font-bold text-primary">Details</button>,
            ];
          })}
        />
      </section>
    </div>
  );
}
