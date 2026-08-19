import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/cravio/AdminTable";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { Loader2, Database, Search, ChevronDown, Filter, X, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/logistics/orders")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Orders" }] }),
  component: LogisticsOrders,
});

const STATUS_TABS = [
  { id: "ALL", label: "Live" },
  { id: "UNASSIGNED", label: "Unassigned" },
  { id: "ASSIGNED", label: "Assigned" },
  { id: "DRIVER_CONFIRMED", label: "Driver confirmed" },
  { id: "REACHED_SHOP", label: "Reached shop" },
  { id: "SHIPPED", label: "Shipped" },
  { id: "REACHED_DROP", label: "Reached drop" },
];

/**
 * STATUS MAPPING:
 * Live = all (except DELIVERED)
 * Unassigned = PLACED (and no driver_id)
 * Assigned = PREPARING
 * Driver confirmed = READY
 * Reached shop = READY (alias for confirmed/ready state in this simplified flow)
 * Shipped = OUT_FOR_DELIVERY
 * Reached drop = DELIVERED
 */

function LogisticsOrders() {
  const routerState = useRouterState();
  const isDetail = routerState.location.pathname !== "/logistics/orders";

  if (isDetail) return <Outlet />;

  return <OrderLedger />;
}

function OrderLedger() {
  const [orders, setOrders] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL");
  const [isSeeding, setIsSeeding] = useState(false);
  
  // Filter states
  const [orderIdSearch, setOrderIdSearch] = useState("");
  const [tripIdSearch, setTripIdSearch] = useState("");
  const [driverIdSearch, setDriverIdSearch] = useState("");
  const [externalIdSearch, setExternalIdSearch] = useState("");
  
  const version = useTableVersion(["orders"]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, r] = await Promise.all([
        listTable<any>("orders", { order: "created_at.desc", limit: 300 }),
        listTable<any>("restaurants", { limit: 500 }),
      ]);
      setOrders(o);
      setRestaurants(r);
    } catch (e) {
      console.error("[ORDERS_LOAD_ERROR]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, version]);

  const restNames = useMemo(() => Object.fromEntries(restaurants.map(r => [r.id, r.name])), [restaurants]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Sidebar Filters
      if (orderIdSearch && !o.id.toLowerCase().includes(orderIdSearch.toLowerCase())) return false;
      if (tripIdSearch && !String(o.trip_id || "").toLowerCase().includes(tripIdSearch.toLowerCase())) return false;
      if (driverIdSearch && !String(o.driver_id || "").toLowerCase().includes(driverIdSearch.toLowerCase())) return false;
      if (externalIdSearch && !String(o.external_id || "").toLowerCase().includes(externalIdSearch.toLowerCase())) return false;
      
      const s = String(o.status || "PLACED").toUpperCase();
      
      // 2. Tab filtering logic
      if (activeTab === "ALL") {
        return s !== "DELIVERED";
      }
      if (activeTab === "UNASSIGNED") {
        return !o.driver_id && s === "PLACED";
      }
      if (activeTab === "ASSIGNED") {
        return s === "PREPARING";
      }
      if (activeTab === "DRIVER_CONFIRMED") {
        return s === "READY";
      }
      if (activeTab === "REACHED_SHOP") {
        return s === "READY";
      }
      if (activeTab === "SHIPPED") {
        return s === "OUT_FOR_DELIVERY";
      }
      if (activeTab === "REACHED_DROP") {
        return s === "DELIVERED";
      }
      
      return true;
    });
  }, [orders, activeTab, orderIdSearch, tripIdSearch, driverIdSearch, externalIdSearch]);

  const stats = useMemo(() => {
    const res: Record<string, number> = {};
    STATUS_TABS.forEach(t => res[t.id] = 0);
    
    orders.forEach(o => {
      const s = String(o.status || "PLACED").toUpperCase();
      
      if (s !== "DELIVERED") res.ALL++;
      if (!o.driver_id && s === "PLACED") res.UNASSIGNED++;
      if (s === "PREPARING") res.ASSIGNED++;
      if (s === "READY") {
        res.DRIVER_CONFIRMED++;
        res.REACHED_SHOP++;
      }
      if (s === "OUT_FOR_DELIVERY") res.SHIPPED++;
      if (s === "DELIVERED") res.REACHED_DROP++;
    });
    return res;
  }, [orders]);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const { createRecord } = await import("@/lib/insforge-crud");
      const now = new Date().toISOString();
      const statuses = ["PLACED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];
      
      for (let i = 0; i < 3; i++) {
        await createRecord("orders", {
          id: crypto.randomUUID(),
          status: statuses[i % statuses.length],
          total_price: 350 + (i * 120),
          created_at: now,
          items: { lines: [{ name: "Operations Demo", qty: 1, price: 350 }] },
          delivery_address: `Operation Sector #${i}, Vadodara`,
          payment_method: "CASH",
          payment_status: "PAID",
          external_id: `EXT-${Math.floor(Math.random() * 90000)}`
        });
      }
      toast.success("Operational demo orders seeded");
      load();
    } catch (e: any) {
      toast.error(e.message || "Seed failed");
    } finally {
      setIsSeeding(false);
    }
  };

  const resetFilters = () => {
    setOrderIdSearch("");
    setTripIdSearch("");
    setDriverIdSearch("");
    setExternalIdSearch("");
  };

  return (
    <div className="flex h-screen bg-[#F9F9F7] text-[#333333] font-sans overflow-hidden">
      {/* 260px Left SEARCH panel */}
      <aside className="w-[260px] border-r border-[#E8E8E2] bg-white p-6 flex flex-col gap-6 overflow-y-auto">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-4 w-4 text-[#1E9A62]" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#666666]">Search</h2>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-[#999999]">Order ID</label>
            <input 
              value={orderIdSearch}
              onChange={e => setOrderIdSearch(e.target.value)}
              placeholder="e.g. 560c..." 
              className="w-full rounded-xl border border-[#E8E8E2] bg-[#F9F9F7] px-3 py-2.5 text-xs font-medium focus:ring-1 focus:ring-[#1E9A62] outline-none transition-all placeholder:text-[#CCCCCC]" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-[#999999]">Trip ID</label>
            <input 
              value={tripIdSearch}
              onChange={e => setTripIdSearch(e.target.value)}
              placeholder="e.g. T-102..." 
              className="w-full rounded-xl border border-[#E8E8E2] bg-[#F9F9F7] px-3 py-2.5 text-xs font-medium focus:ring-1 focus:ring-[#1E9A62] outline-none transition-all placeholder:text-[#CCCCCC]" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-[#999999]">Driver / Rider ID</label>
            <input 
              value={driverIdSearch}
              onChange={e => setDriverIdSearch(e.target.value)}
              placeholder="e.g. DRV-..." 
              className="w-full rounded-xl border border-[#E8E8E2] bg-[#F9F9F7] px-3 py-2.5 text-xs font-medium focus:ring-1 focus:ring-[#1E9A62] outline-none transition-all placeholder:text-[#CCCCCC]" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-[#999999]">External Order ID</label>
            <input 
              value={externalIdSearch}
              onChange={e => setExternalIdSearch(e.target.value)}
              placeholder="e.g. EXT-..." 
              className="w-full rounded-xl border border-[#E8E8E2] bg-[#F9F9F7] px-3 py-2.5 text-xs font-medium focus:ring-1 focus:ring-[#1E9A62] outline-none transition-all placeholder:text-[#CCCCCC]" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-[#999999]">Geography</label>
            <div className="space-y-2">
              <button className="flex w-full items-center justify-between rounded-xl border border-[#E8E8E2] bg-[#F9F9F7] px-3 py-2.5 text-xs font-bold text-[#666666]">
                Vadodara <ChevronDown className="h-3 w-3 text-[#CCCCCC]" />
              </button>
              <button className="flex w-full items-center justify-between rounded-xl border border-[#E8E8E2] bg-[#F9F9F7] px-3 py-2.5 text-xs font-bold text-[#666666]">
                All Zones <ChevronDown className="h-3 w-3 text-[#CCCCCC]" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button 
            onClick={() => load()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E9A62] px-3 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-glow hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Apply
          </button>
          <button 
            onClick={resetFilters}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F9F9F7] px-3 py-3 text-[10px] font-black uppercase tracking-widest text-[#999999] border border-transparent hover:border-[#E8E8E2] transition-all"
          >
            <X className="h-3 w-3" /> Reset
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header & Workflow Tabs */}
        <div className="bg-white border-b border-[#E8E8E2] px-8 pt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-display text-2xl font-black tracking-tight text-[#333333]">Orders operations</h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#999999]">
                  Live status: <span className="text-[#1E9A62]">{stats.ALL} active orders</span>
                </p>
                <div className="h-1 w-1 rounded-full bg-[#E8E8E2]" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#999999]">
                  Refreshed: {format(new Date(), "HH:mm:ss")}
                </p>
              </div>
            </div>
            <button 
              onClick={handleSeed}
              disabled={isSeeding}
              className="flex items-center gap-2 rounded-xl bg-[#F9F9F7] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#1E9A62] border border-[#1E9A62]/10 hover:bg-white transition disabled:opacity-50"
            >
              {isSeeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
              Seed Demo Orders
            </button>
          </div>

          <div className="flex gap-8 overflow-x-auto no-scrollbar">
            {STATUS_TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative pb-4 flex items-center gap-2 transition-all group whitespace-nowrap`}
                >
                  <span className={`text-[11px] font-black uppercase tracking-widest transition-colors ${
                    isActive ? "text-[#1E9A62]" : "text-[#999999] group-hover:text-[#666666]"
                  }`}>
                    {tab.label}
                  </span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                    isActive ? "bg-[#1E9A62] text-white" : "bg-[#F9F9F7] text-[#999999]"
                  }`}>
                    {stats[tab.id] || 0}
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E9A62] rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Operational Ledger Table */}
        <section className="flex-1 overflow-auto p-8">
          <div className="bg-white rounded-3xl shadow-soft border border-[#E8E8E2] overflow-hidden flex flex-col h-full">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-3 text-[#999999]">
                <Loader2 className="h-5 w-5 animate-spin text-[#1E9A62]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Hydrating Operations Ledger...</span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center gap-4 py-20 text-[#999999]">
                <div className="h-16 w-16 rounded-full bg-[#F9F9F7] flex items-center justify-center border border-[#E8E8E2]">
                  <Search className="h-6 w-6 opacity-20 text-[#1E9A62]" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.1em] text-[#333333]">No operational records</p>
                  <p className="text-[10px] font-medium text-[#999999] mt-1">Adjust filters or select a different workflow stage.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto min-h-0 flex-1">
                <table className="w-full border-collapse">
                  <thead className="bg-[#F9F9F7] sticky top-0 z-10 border-b border-[#E8E8E2]">
                    <tr className="text-[10px] font-black uppercase tracking-[0.15em] text-[#999999]">
                      <th className="px-6 py-4 text-left font-black">Order ID</th>
                      <th className="px-6 py-4 text-left font-black">Trip ID</th>
                      <th className="px-6 py-4 text-left font-black">External Order ID</th>
                      <th className="px-6 py-4 text-left font-black">Current Status</th>
                      <th className="px-6 py-4 text-left font-black">Driver / Rider ID</th>
                      <th className="px-6 py-4 text-left font-black">City</th>
                      <th className="px-6 py-4 text-left font-black">Zone</th>
                      <th className="px-6 py-4 text-left font-black">Restaurant</th>
                      <th className="px-6 py-4 text-left font-black">Customer</th>
                      <th className="px-6 py-4 text-right font-black">Total Price</th>
                      <th className="px-6 py-4 text-left font-black">Created</th>
                      <th className="px-6 py-4 text-left font-black">Updated</th>
                      <th className="px-6 py-4 text-right font-black">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F9F9F7]">
                    {filteredOrders.map(o => (
                      <tr 
                        key={o.id} 
                        className="text-[11px] font-medium hover:bg-[#F9F9F7]/50 transition-colors group"
                      >
                        <td className="px-6 py-5 whitespace-nowrap">
                          <Link 
                            to="/logistics/orders/$orderId" 
                            params={{ orderId: o.id }} 
                            className="font-mono font-black text-[#1E9A62] underline decoration-[#1E9A62]/20 underline-offset-4 hover:decoration-[#1E9A62] transition-all"
                          >
                            #{o.id.slice(0, 8).toUpperCase()}
                          </Link>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-[#666666] font-bold">
                          {o.trip_id || "—"}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-[#999999]">
                          {o.external_id || "—"}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <StatusBadge label={o.status || "PLACED"} />
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          {o.driver_id ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-[#333333]">DRV-{o.driver_id.slice(-4).toUpperCase()}</span>
                              <span className="text-[9px] text-[#999999] font-medium uppercase tracking-tighter">Identity Verified</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-black text-[#CCCCCC] uppercase tracking-widest italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-[#666666]">
                          Vadodara
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-[#666666]">
                          {o.zone_id ? `Zone-${o.zone_id.slice(0, 4)}` : "All Zones"}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-[#333333] font-bold">
                          {restNames[o.restaurant_id] || "Scoobix Kitchen"}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-[#666666]">
                          {String(o.delivery_address || "").split(",")[0] || "Guest"}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-right text-[#333333] font-black">
                          {formatPrice(o.total_price || 0)}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-[#999999] font-mono">
                          {o.created_at ? format(new Date(o.created_at), "HH:mm") : "—"}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-[#999999] font-mono">
                          {o.updated_at ? format(new Date(o.updated_at), "HH:mm") : "—"}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-right">
                          <Link 
                            to="/logistics/orders/$orderId" 
                            params={{ orderId: o.id }}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#F9F9F7] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#666666] border border-[#E8E8E2] hover:bg-white hover:text-[#1E9A62] transition-all"
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
