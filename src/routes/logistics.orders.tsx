import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { Loader2, ExternalLink, Database, Search, ChevronDown, Filter, X } from "lucide-react";
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
  const [driverIdSearch, setDriverIdSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  
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
      if (orderIdSearch && !o.id.toLowerCase().includes(orderIdSearch.toLowerCase())) return false;
      if (driverIdSearch && !String(o.driver_id || "").toLowerCase().includes(driverIdSearch.toLowerCase())) return false;
      
      const s = String(o.status || "PLACED").toUpperCase();
      if (activeTab === "UNASSIGNED") return !o.driver_id && s !== "DELIVERED";
      if (activeTab === "ASSIGNED") return !!o.driver_id && s !== "DELIVERED";
      if (activeTab !== "ALL" && s !== activeTab) return false;
      if (activeTab === "ALL" && s === "DELIVERED") return false;
      
      return true;
    });
  }, [orders, activeTab, orderIdSearch, driverIdSearch]);

  const stats = useMemo(() => {
    const res: Record<string, number> = { ALL: 0 };
    STATUS_TABS.forEach(t => res[t.id] = 0);
    
    orders.forEach(o => {
      const s = String(o.status || "PLACED").toUpperCase();
      if (s !== "DELIVERED") res.ALL++;
      if (!o.driver_id && s !== "DELIVERED") res.UNASSIGNED++;
      if (!!o.driver_id && s !== "DELIVERED") res.ASSIGNED++;
      if (res[s] !== undefined) res[s]++;
    });
    return res;
  }, [orders]);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const { insforge: sdk } = await import("@/lib/insforge");
      const { createRecord } = await import("@/lib/insforge-crud");
      const now = new Date().toISOString();
      const statuses = ["PLACED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];
      
      for (let i = 0; i < 3; i++) {
        await createRecord("orders", {
          id: crypto.randomUUID(),
          status: statuses[i % statuses.length],
          total_price: 300 + (i * 100),
          created_at: now,
          items: { lines: [{ name: "Demo Order", qty: 1, price: 300 }] },
          delivery_address: `Demo St #${i}, Vadodara`,
          payment_method: "CASH",
          payment_status: "PAID"
        });
      }
      toast.success("Demo orders seeded");
      load();
    } catch (e: any) {
      toast.error(e.message || "Seed failed");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F9F9F7] text-[#333333]">
      {/* Sidebar Filters */}
      <aside className="w-72 border-r border-[#E8E8E2] bg-white p-6 flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#1E9A62]" />
          <h2 className="text-xs font-black uppercase tracking-widest text-[#666666]">Dispatch Filters</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">Order Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#CCCCCC]" />
              <input 
                value={orderIdSearch}
                onChange={e => setOrderIdSearch(e.target.value)}
                placeholder="Order ID..." 
                className="w-full rounded-xl border border-[#E8E8E2] bg-[#F9F9F7] pl-9 pr-3 py-2 text-xs focus:ring-1 focus:ring-[#1E9A62] outline-none" 
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">Driver Search</label>
            <input 
              value={driverIdSearch}
              onChange={e => setDriverIdSearch(e.target.value)}
              placeholder="Trip / Driver ID..." 
              className="w-full rounded-xl border border-[#E8E8E2] bg-[#F9F9F7] px-3 py-2 text-xs focus:ring-1 focus:ring-[#1E9A62] outline-none" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">Geography</label>
            <button className="flex w-full items-center justify-between rounded-xl border border-[#E8E8E2] bg-[#F9F9F7] px-3 py-2 text-xs">
              Vadodara <ChevronDown className="h-3 w-3 text-[#CCCCCC]" />
            </button>
            <button className="flex w-full items-center justify-between rounded-xl border border-[#E8E8E2] bg-[#F9F9F7] px-3 py-2 text-xs">
              All Zones <ChevronDown className="h-3 w-3 text-[#CCCCCC]" />
            </button>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <button 
            onClick={() => { setOrderIdSearch(""); setDriverIdSearch(""); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F9F9F7] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#666666] hover:bg-[#E8E8E2] transition"
          >
            <X className="h-3 w-3" /> Clear All
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-8 overflow-hidden gap-6">
        <header className="flex items-center justify-between">
          <div className="flex gap-1 bg-[#E8E8E2]/50 p-1 rounded-2xl overflow-x-auto no-scrollbar">
            {STATUS_TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-wider transition ${
                    isActive 
                      ? "bg-white text-[#1E9A62] shadow-sm" 
                      : "text-[#666666] hover:text-[#333333]"
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-md px-1.5 py-0.5 text-[9px] ${isActive ? "bg-[#1E9A62]/10" : "bg-black/5"}`}>
                    {stats[tab.id] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          <button 
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#1E9A62] ring-1 ring-[#1E9A62]/20 shadow-sm hover:bg-[#F9F9F7] active:scale-95 transition disabled:opacity-50"
          >
            {isSeeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
            Seed Data
          </button>
        </header>

        <section className="flex-1 overflow-auto bg-white rounded-3xl shadow-sm border border-[#E8E8E2]">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-3 text-[#999999]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Hydrating Ledger...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center gap-2 text-[#999999]">
              <div className="h-12 w-12 rounded-full bg-[#F9F9F7] flex items-center justify-center border border-[#E8E8E2]">
                <Search className="h-5 w-5 opacity-20" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest">No matching orders</p>
            </div>
          ) : (
            <div className="min-w-full inline-block align-middle">
              <table className="min-w-full divide-y divide-[#F9F9F7]">
                <thead className="bg-[#F9F9F7]/50 sticky top-0 z-10">
                  <tr className="text-[10px] font-black uppercase tracking-[0.15em] text-[#999999]">
                    <th className="px-6 py-4 text-left">Order / Ext ID</th>
                    <th className="px-6 py-4 text-left">Trip / Driver</th>
                    <th className="px-6 py-4 text-left">State</th>
                    <th className="px-6 py-4 text-left">Restaurant</th>
                    <th className="px-6 py-4 text-left">Locality</th>
                    <th className="px-6 py-4 text-left">City / Zone</th>
                    <th className="px-6 py-4 text-left">Created</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F9F9F7]">
                  {filteredOrders.map(o => (
                    <tr key={o.id} className="text-xs hover:bg-[#F9F9F7]/80 transition group">
                      <td className="px-6 py-4">
                        <Link to="/logistics/orders/$orderId" params={{ orderId: o.id }} className="flex flex-col gap-0.5">
                          <code className="font-mono text-[10px] font-black text-[#1E9A62] group-hover:underline">
                            #{o.id.slice(0, 8).toUpperCase()}
                          </code>
                          <span className="text-[9px] text-[#CCCCCC]">EXT: {o.external_id || "N/A"}</span>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {o.driver_id ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-[#333333]">DRV-{o.driver_id.slice(-4).toUpperCase()}</span>
                            <span className="text-[9px] text-[#999999]">TRIP: {o.trip_id || "ACT-1"}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-black text-[#CCCCCC] italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge label={o.status || "PLACED"} />
                      </td>
                      <td className="px-6 py-4 text-[#666666] font-medium">
                        {restNames[o.restaurant_id] || "Scoobix Kitchen"}
                      </td>
                      <td className="px-6 py-4 text-[#999999]">
                        {String(o.delivery_address || "").split(",")[0]}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#333333]">Vadodara</span>
                          <span className="text-[9px] text-[#999999]">Main Zone</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[#999999] font-mono text-[10px]">
                        {(o.created_at || "").slice(11, 16)}
                      </td>
                      <td className="px-6 py-4 text-right font-black text-[#333333]">
                        {formatPrice(o.total_price || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
