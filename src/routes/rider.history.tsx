import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";
import { deliveryHistory } from "@/lib/mock-extras";
import { formatPrice } from "@/lib/format";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/rider/history")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Delivery history" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Delivery history" subtitle={`${deliveryHistory.length} trips`} />

      <ul className="mx-4 mt-3 divide-y divide-border/60 rounded-3xl bg-card shadow-soft ring-1 ring-border/60">
        {deliveryHistory.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3.5">
            <span className={`grid h-10 w-10 place-items-center rounded-2xl ${d.status === "Delivered" ? "bg-primary-soft text-primary" : "bg-destructive/10 text-destructive"}`}>
              {d.status === "Delivered" ? <Check className="h-5 w-5" strokeWidth={2.6} /> : <X className="h-5 w-5" strokeWidth={2.6} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{d.restaurant} → {d.customer}</div>
              <div className="truncate text-xs text-muted-foreground">{d.id} · {d.date} · {d.distanceKm} km</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold">{d.status === "Cancelled" ? "—" : formatPrice(d.payout)}</div>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${d.status === "Delivered" ? "text-emerald-600" : "text-destructive"}`}>{d.status}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
