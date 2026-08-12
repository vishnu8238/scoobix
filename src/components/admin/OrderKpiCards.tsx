import { 
  CreditCard, Calendar, Utensils, IndianRupee, 
  CheckCircle2, Clock, AlertTriangle 
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { format } from "date-fns";
import { cn } from "@/lib/format";

export function OrderKpiCards({ order, restaurant, payment }: { order: any; restaurant: any; payment: any }) {
  const kpis = [
    {
      label: "Total Amount",
      value: formatPrice(order.total_price),
      icon: IndianRupee,
      tone: "primary"
    },
    {
      label: "Payment",
      value: payment?.method || order.payment_method || "N/A",
      sub: payment?.status || order.payment_status || "PENDING",
      icon: CreditCard,
      tone: payment?.status === "COMPLETED" ? "emerald" : "amber"
    },
    {
      label: "Order Date",
      value: format(new Date(order.created_at), "MMM d, yyyy"),
      sub: format(new Date(order.created_at), "HH:mm:ss"),
      icon: Calendar,
      tone: "primary"
    },
    {
      label: "Kitchen",
      value: restaurant?.name || "N/A",
      sub: order.status === "PREPARING" ? "Cooking" : order.status === "READY" ? "Ready" : "Pending",
      icon: Utensils,
      tone: order.status === "READY" ? "emerald" : "amber"
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k) => (
        <div key={k.label} className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-2xl",
              k.tone === "primary" ? "bg-primary/10 text-primary" :
              k.tone === "emerald" ? "bg-emerald-100 text-emerald-600" :
              "bg-amber-100 text-amber-600"
            )}>
              <k.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className="font-display text-lg font-extrabold">{k.value}</p>
              {k.sub && <p className="text-[10px] text-muted-foreground font-medium">{k.sub}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
