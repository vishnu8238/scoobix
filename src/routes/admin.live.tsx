import { createFileRoute } from "@tanstack/react-router";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { adminLiveOrders } from "@/lib/mock-extras";
import { formatPrice } from "@/lib/format";
import { Radio } from "lucide-react";
import { useLiveOrders, useLiveDriverLocations } from "@/lib/realtime-hooks";
import { useDispatchDaemon } from "@/lib/dispatch-engine";
import { useOrderFinalizationDaemon } from "@/lib/order-completion";

export const Route = createFileRoute("/admin/live")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Live orders" }] }),
  component: LiveOrders,
});

type OrderRow = { id: string; customer_id?: string; restaurant_id?: string; driver_id?: string | null; total_price?: number; status?: string };

const LIVE_STATUS_LABEL: Record<string, string> = {
  PLACED: "Placed",
  ACCEPTED: "Accepted",
  ASSIGNING: "Assigning",
  PREPARING: "Preparing",
  READY: "Ready",
  PICKED_UP: "Picked up",
  ON_THE_WAY: "On the way",
  ARRIVED: "Arrived",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
  NO_DRIVERS: "No drivers",
};

function LiveOrders() {
  useDispatchDaemon();
  useOrderFinalizationDaemon();
  const { rows } = useLiveOrders();
  useLiveDriverLocations(); // keep the driver-location stream warm

  const live = rows.map((r) => r as OrderRow);
  const active = live.filter((o) => !["DELIVERED", "CANCELLED", "REJECTED"].includes(String(o.status ?? "")));
  const placed = active.filter((o) => o.status === "PLACED").length;
  const preparing = active.filter((o) => o.status === "PREPARING" || o.status === "READY").length;
  const otw = active.filter((o) => ["PICKED_UP", "ON_THE_WAY", "ARRIVED"].includes(String(o.status ?? ""))).length;

  const useMock = !rows.length;

  return (
    <div className="space-y-6">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          <Radio className="h-3.5 w-3.5 animate-pulse" /> Live
        </div>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight">Live order monitoring</h1>
        <p className="text-sm text-muted-foreground">Real-time view across all cities</p>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <KPI label="Active orders"  value={(useMock ? adminLiveOrders.length : active.length).toString()} tone="primary" />
        <KPI label="Placed (new)"   value={(useMock ? adminLiveOrders.filter((o) => o.status === "Placed").length : placed).toString()}     tone="amber" />
        <KPI label="Preparing"      value={(useMock ? adminLiveOrders.filter((o) => o.status === "Preparing").length : preparing).toString()}  tone="sky" />
        <KPI label="On the way"     value={(useMock ? adminLiveOrders.filter((o) => o.status === "On the way").length : otw).toString()}        tone="emerald" />
      </div>

      <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        {useMock ? (
          <DataTable
            columns={["Order", "Customer", "Restaurant", "City", "Rider", "ETA", "Total", "Status"]}
            rows={adminLiveOrders.map((o) => [
              <span className="font-mono text-xs font-bold">{o.id}</span>,
              o.customer,
              o.restaurant,
              o.city,
              o.rider,
              o.eta,
              formatPrice(o.total),
              <StatusBadge label={o.status} />,
            ])}
          />
        ) : (
          <DataTable
            columns={["Order", "Customer", "Restaurant", "Rider", "Total", "Status"]}
            rows={active.map((o) => [
              <span className="font-mono text-xs font-bold">{String(o.id).slice(-8)}</span>,
              o.customer_id ? String(o.customer_id).slice(0, 8) : "—",
              o.restaurant_id ? String(o.restaurant_id).slice(0, 8) : "—",
              o.driver_id ? String(o.driver_id).slice(0, 8) : "—",
              formatPrice(Number(o.total_price ?? 0)),
              <StatusBadge label={LIVE_STATUS_LABEL[String(o.status ?? "")] ?? String(o.status ?? "—")} />,
            ])}
          />
        )}
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  primary:  "bg-primary-soft text-primary",
  amber:    "bg-amber-100 text-amber-700",
  sky:      "bg-sky-100 text-sky-700",
  emerald:  "bg-emerald-100 text-emerald-700",
};

function KPI({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE[tone]}`}>{label}</span>
      <p className="mt-3 font-display text-3xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}
