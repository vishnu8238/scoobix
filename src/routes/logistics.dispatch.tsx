import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { ClipboardList, Loader2, User, Store, MapPin } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/logistics/dispatch")({
  component: LogisticsDispatch,
});

function LogisticsDispatch() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    // Fetch orders needing assignment
    const data = await listTable<any>("orders", { 
      status: "in.(PLACED,CONFIRMED,ACCEPTED,PREPARING,READY)",
      order: "created_at.desc" 
    });
    setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Dispatch Control Center</h1>
        <p className="text-sm text-muted-foreground">Manage active assignments and real-time order flow.</p>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <DataTable
            columns={["Order ID", "Status", "Customer", "Restaurant", "Value", "Action"]}
            rows={orders.map(o => [
              <span key={o.id} className="font-bold">#{o.id.slice(-5)}</span>,
              <StatusBadge key={o.id} label={o.status} />,
              <div key={o.id} className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {o.customer_name || "Guest"}</div>,
              <div key={o.id} className="flex items-center gap-2"><Store className="h-4 w-4 text-muted-foreground" /> {o.restaurant_name || "Restaurant"}</div>,
              <span key={o.id} className="font-bold">{formatPrice(o.total_price)}</span>,
              <button key={o.id} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-glow">Assign</button>
            ])}
          />
        )}
      </section>
    </div>
  );
}
