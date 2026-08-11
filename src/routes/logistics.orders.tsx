import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { ClipboardList, Loader2, User, Store } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/logistics/orders")({
  component: LogisticsOrders,
});

function LogisticsOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await listTable<any>("orders", { order: "created_at.desc", limit: 100 });
    setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Order Ledger</h1>
        <p className="text-sm text-muted-foreground">Comprehensive history of all logistics-managed orders.</p>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <DataTable
            columns={["Order", "Customer", "Restaurant", "Total", "Status", "Time"]}
            rows={orders.map(o => [
              <span key={o.id} className="font-bold">#{o.id.slice(-5).toUpperCase()}</span>,
              <div key={o.id} className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {o.customer_name || "Guest"}</div>,
              <div key={o.id} className="flex items-center gap-2"><Store className="h-4 w-4 text-muted-foreground" /> {o.restaurant_name || "Restaurant"}</div>,
              <span key={o.id} className="font-bold">{formatPrice(o.total_price)}</span>,
              <StatusBadge key={o.id} label={o.status} />,
              <span key={o.id} className="text-muted-foreground text-xs">
                {o.created_at ? new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
              </span>
            ])}
          />
        )}
      </section>
    </div>
  );
}
