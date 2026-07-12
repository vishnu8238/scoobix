import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { formatPrice } from "@/lib/format";
import { Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { listTable } from "@/lib/insforge-crud";
import { EmptyState } from "@/components/cravio/EmptyState";

export const Route = createFileRoute("/rider/history")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Delivery history" }] }),
  component: HistoryPage,
});

type Row = {
  id: string;
  status?: string;
  total_price?: number;
  driver_earnings?: number;
  restaurant_id?: string;
  customer_id?: string;
  created_at?: string;
  driver_id?: string;
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return "—"; }
}

function HistoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    void (async () => {
      const list = await listTable<Row>("orders", { limit: 200, order: "-created_at" });
      if (cancelled) return;
      setRows(list.filter((o) => o.driver_id === user.id && ["DELIVERED", "CANCELLED", "REJECTED"].includes(String(o.status ?? ""))));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Delivery history" subtitle={loading ? "Loading…" : `${rows.length} trips`} />

      {!loading && rows.length === 0 ? (
        <div className="px-4 pt-6"><EmptyState icon={<Check className="h-6 w-6" />} title="No trips yet" description="Completed and cancelled deliveries appear here." /></div>
      ) : (
        <ul className="mx-4 mt-3 divide-y divide-border/60 rounded-3xl bg-card shadow-soft ring-1 ring-border/60">
          {rows.map((d) => {
            const delivered = d.status === "DELIVERED";
            const payout = Number(d.driver_earnings ?? 0);
            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className={`grid h-10 w-10 place-items-center rounded-2xl ${delivered ? "bg-primary-soft text-primary" : "bg-destructive/10 text-destructive"}`}>
                  {delivered ? <Check className="h-5 w-5" strokeWidth={2.6} /> : <X className="h-5 w-5" strokeWidth={2.6} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{d.restaurant_id ? d.restaurant_id.slice(0, 8) : "—"} → {d.customer_id ? d.customer_id.slice(0, 8) : "—"}</div>
                  <div className="truncate text-xs text-muted-foreground">{d.id.slice(-8)} · {fmtDate(d.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{delivered ? formatPrice(payout) : "—"}</div>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${delivered ? "text-emerald-600" : "text-destructive"}`}>{d.status}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
