import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { Loader2, ExternalLink, Database, Search, ChevronDown, Filter } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/logistics/orders")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Orders" }] }),
  component: LogisticsOrders,
});

const STATUS_TABS = [
  { id: "ALL", label: "Live" },
  { id: "UNASSIGNED", label: "Unassigned" },
  { id: "ASSIGNED", label: "Assigned" },
  { id: "PICKED_UP", label: "Driver Confirmed" },
  { id: "AT_PICKUP", label: "Reached Shop" },
  { id: "OUT_FOR_DELIVERY", label: "Shipped" },
  { id: "ARRIVED", label: "Reached Drop" },
];

function LogisticsOrders() {
  const routerState = useRouterState();
  const isDetail = routerState.location.pathname !== "/logistics/orders";

  if (isDetail) return <Outlet />;

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-6 p-6">
      <aside className="hidden w-64 flex-col gap-6 lg:flex">
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Filters</h2>
          <div className="space-y-3">
            <input placeholder="Order ID" className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
            <input placeholder="Driver ID" className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm" />
            <button className="flex w-full items-center justify-between rounded-xl bg-card px-3 py-2 text-sm border border-border">
              City <ChevronDown className="h-4 w-4" />
            </button>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
              <Filter className="h-4 w-4" /> Apply Filters
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl">
            {STATUS_TABS.map(tab => (
              <button key={tab.id} className="rounded-xl px-4 py-2 text-xs font-bold hover:bg-card hover:shadow-sm transition">
                {tab.label}
              </button>
            ))}
          </div>
          <button className="rounded-xl bg-card px-4 py-2 text-xs font-bold ring-1 ring-border shadow-sm">Seed Demo Orders</button>
        </div>

        <section className="flex-1 overflow-auto rounded-3xl bg-card shadow-card ring-1 ring-border/60">
           {/* Ledger rendering here */}
           <div className="p-8 text-center text-sm text-muted-foreground">No orders match these filters.</div>
        </section>
      </main>
    </div>
  );
}
