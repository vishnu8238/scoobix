import { createFileRoute } from "@tanstack/react-router";
import { formatPrice } from "@/lib/format";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { useLiveTable } from "@/lib/realtime-hooks";
import { patchRecord } from "@/lib/insforge-crud";
import { nudgeTable } from "@/lib/realtime";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Payments" }] }),
  component: AdminPayments,
});

type PaymentRow = {
  id: string;
  order_id?: string | null;
  amount?: number | null;
  method?: string | null;
  status?: string | null;
  created_at?: string | null;
};

function AdminPayments() {
  const { rows: payments } = useLiveTable<PaymentRow>("payments", {
    params: { limit: 300, order: "-created_at" },
    minMs: 8000,
    maxMs: 45000,
  });
  const total = payments
    .filter((p) => (p.status ?? "").toUpperCase() === "SUCCESS")
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const refund = async (p: PaymentRow) => {
    const refunded = (p.status ?? "").toUpperCase() === "REFUNDED";
    await patchRecord("payments", p.id, { status: refunded ? "SUCCESS" : "REFUNDED" });
    nudgeTable("payments");
    toast.success(refunded ? "Refund reverted" : "Payment refunded");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Payments</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Payouts & commissions</h1>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-strong px-5 py-3 text-primary-foreground shadow-glow">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Settled</p>
          <p className="font-display text-2xl font-extrabold">{formatPrice(total)}</p>
        </div>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["ID", "Order", "Method", "Amount", "Date", "Status", "Refund", ""]}
          rows={payments.map((p) => {
            const refunded = (p.status ?? "").toUpperCase() === "REFUNDED";
            const refundCls = refunded ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground";
            return [
              <span className="font-bold text-primary">{p.id.slice(0, 8)}</span>,
              <span className="font-bold">{(p.order_id ?? "—").slice(0, 8)}</span>,
              <span className="text-muted-foreground">{p.method ?? "—"}</span>,
              <span className="font-display font-extrabold">{formatPrice(Number(p.amount ?? 0))}</span>,
              <span className="text-muted-foreground">{(p.created_at ?? "").slice(0, 10) || "—"}</span>,
              <StatusBadge label={p.status ?? "PENDING"} />,
              <button
                onClick={() => void refund(p)}
                className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider transition active:scale-95 ${refundCls}`}
              >
                {refunded ? "refunded" : "Not refunded"}
              </button>,
              <button className="text-[12px] font-bold text-primary">Details</button>,
            ];
          })}
        />
      </section>
    </div>
  );
}
