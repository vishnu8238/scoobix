import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { Loader2, ExternalLink, Database } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/logistics/orders")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Orders" }] }),
  component: LogisticsOrders,
});

function LogisticsOrders() {
  const routerState = useRouterState();
  const isDetail = routerState.location.pathname !== "/logistics/orders";

  if (isDetail) {
    return <Outlet />;
  }

  return <OrderLedger />;
}

function OrderLedger() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [restaurants, setRestaurants] = useState<NamedRow[]>([]);
  const [users, setUsers] = useState<NamedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [isSeeding, setIsSeeding] = useState(false);
  const version = useTableVersion(["orders"]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, r, u] = await Promise.all([
        listTable<OrderRow>("orders", { order: "created_at.desc", limit: 300 }),
        listTable<NamedRow>("restaurants", { limit: 500 }),
        listTable<NamedRow>("users", { limit: 1000 }),
      ]);
      
      let finalOrders = o;
      if (o.length === 0) {
        const { getLogisticsDemoData } = await import("@/lib/logistics-ops.functions");
        const demo = await getLogisticsDemoData();
        if (demo?.orders?.length) {
          finalOrders = demo.orders as OrderRow[];
        }
      }

      setOrders(finalOrders); 
      setRestaurants(r); 
      setUsers(u);
    } catch (e) {
      console.error("[ORDERS_LOAD_ERROR]", e);
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    void load();
  }, [load, version]);

  const nameById = useMemo(() => Object.fromEntries(restaurants.map((r) => [String(r.id), r.name ?? "—"])), [restaurants]);
  const userById = useMemo(() => Object.fromEntries(users.map((u) => [String(u.id), u.name ?? "—"])), [users]);

  const today = new Date().toISOString().slice(0, 10);
  const status = (o: OrderRow) => String(o.status ?? "PLACED").toUpperCase();

  const stats = useMemo(() => {
    const todays = orders.filter((o) => (o.created_at ?? "").slice(0, 10) === today);
    return [
      { key: "ALL", label: "Placed today", value: todays.length },
      { key: "PROGRESS", label: "In progress", value: orders.filter((o) => IN_PROGRESS.includes(status(o))).length },
      { key: "DELIVERED", label: "Completed", value: orders.filter((o) => status(o) === "DELIVERED").length },
      { key: "CANCELLED", label: "Cancelled", value: orders.filter((o) => status(o) === "CANCELLED").length },
    ];
  }, [orders, today]);

  const visible = useMemo(() => {
    if (filter === "ALL") return orders;
    if (filter === "PROGRESS") return orders.filter((o) => IN_PROGRESS.includes(status(o)));
    return orders.filter((o) => status(o) === filter);
  }, [orders, filter]);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Orders</p>
        <div className="flex items-center justify-between mt-1">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Live order ledger</h1>
            <p className="mt-1 text-sm text-muted-foreground">Monitor every order across the platform in real time.</p>
          </div>
          <button
            onClick={async () => {
              setIsSeeding(true);
              try {
                console.log("[LOGISTICS_ORDERS] Seeding directly via SDK client...");
                const { insforge: sdk } = await import("@/lib/insforge");
                const { createRecord } = await import("@/lib/insforge-crud");
                
                // Construct demo data
                const zone1Id = "z1110000-0000-0000-0000-000000000001";
                const now = new Date().toISOString();
                
                // 1. Ensure Restaurant
                const { data: restData } = await sdk.database.from("restaurants").select("id").eq("name", "Scoobix Demo Kitchen").limit(1);
                let restaurantId = restData?.[0]?.id;
                
                if (!restaurantId) {
                  const rest: DemoRestaurantInsert = {
                    id: crypto.randomUUID(),
                    name: "Scoobix Demo Kitchen",
                    address: "123 Logistics Hub, Vadodara",
                    status: "ACTIVE",
                    city: "Vadodara"
                  };
                  // Use createRecord for retries and normalization
                  const created = await createRecord<any>("restaurants", rest);
                  if (!created) throw new Error(`Restaurant creation failed: Empty response`);
                  restaurantId = created.id || rest.id;
                }

                // 2. Ensure Customer
                const { data: custData } = await sdk.database.from("users").select("id").eq("email", "demo.customer@scoobix.test").limit(1);
                let customerId = custData?.[0]?.id;
                
                if (!customerId) {
                  const cust = {
                    id: crypto.randomUUID(),
                    name: "Demo Customer",
                    role: "CUSTOMER", // Uppercase to satisfy role constraint if strictly enforced
                    email: "demo.customer@scoobix.test"
                  };
                  // Use createRecord for retries and normalization
                  const created = await createRecord<any>("users", cust);
                  if (!created) throw new Error(`Customer creation failed: Empty response`);
                  customerId = created.id || cust.id;
                }

                // 3. Insert Orders
                const statuses = ["pending", "in_transit", "delivered"];
                let seededCount = 0;
                
                for (let i = 0; i < 5; i++) {
                  const deliveryAddress = `123 Demo Street, Vadodara #${i}`;
                  const { data: existing } = await sdk.database.from("orders").select("id").eq("delivery_address", deliveryAddress).limit(1);
                  
                  if (existing?.length) continue;

                  const order = {
                    id: crypto.randomUUID(),
                    customer_id: customerId,
                    restaurant_id: restaurantId,
                    status: statuses[i % statuses.length],
                    total_amount: 250 + (i * 50),
                    created_at: now,
                    items: {
                      lines: [{ id: "item1", name: "Demo Meal", price: 200, qty: 1 }],
                      meta: { restaurantName: "Scoobix Demo Kitchen", addressLine: "123 Demo St" }
                    },
                    delivery_address: deliveryAddress,
                    payment_method: "CASH",
                    payment_status: i % 2 === 0 ? "PAID" : "PENDING"
                  };

                  const created = await createRecord<any>("orders", order);
                  if (created) seededCount++;
                }
                
                if (seededCount > 0) {
                  toast.success(`Successfully seeded ${seededCount} demo orders`);
                  window.location.reload();
                } else {
                  toast.info("Demo orders already exist in the ledger");
                  void load();
                }
              } catch (e: any) {
                console.error("[SEED_ORDER_ERROR]", e);
                toast.error(`Backend seeding failed: ${e.message || "Unauthorized or RLS Blocked"}`);
                void load();
              } finally {
                setIsSeeding(false);
              }
            }}
            disabled={isSeeding}
            className="flex items-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-2.5 text-xs font-black text-amber-600 ring-1 ring-amber-500/20 transition hover:bg-amber-500/20 active:scale-95 disabled:opacity-50"
          >
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Seed Demo Orders
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-3xl p-5 text-left shadow-soft ring-1 transition ${filter === s.key ? "bg-primary/5 ring-primary/40" : "bg-card ring-border/60"}`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-display text-2xl font-extrabold">{s.value.toLocaleString()}</p>
          </button>
        ))}
      </div>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No orders in this view.</p>
        ) : (
          <DataTable
            columns={["Order", "Customer", "Restaurant", "Total", "Status", "Time", "Action"]}
            rows={visible.map((o) => [
              <div key={`order_ref_${o.id}`} className="flex flex-col">
                <code className="font-mono text-[10px] font-bold text-primary">#{o.id.slice(0, 8)}</code>
                {(o as any).metadata?.is_demo && (
                  <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Demo Data</span>
                )}
              </div>,

              <span key={`name${o.id}`} className="font-bold">{userById[String(o.customer_id)] || "—"}</span>,
              <span key={`owner${o.id}`} className="text-muted-foreground">{nameById[String(o.restaurant_id)] || "—"}</span>,
              <span key={`rating${o.id}`} className="font-bold">{formatPrice(o.total_amount || 0)}</span>,
              <StatusBadge key={`status${o.id}`} label={String(o.status || "PLACED")} />,
              <span key={`mgr${o.id}`} className="text-[10px] font-medium text-muted-foreground">{(o.created_at ?? "").slice(11, 16)}</span>,
              <Link 
                key={`act${o.id}`} 
                to="/logistics/orders/$orderId" 
                params={{ 
                  orderId: o.id === "e433da54-560b-4c50-bf0b-7cd68acf11e6" 
                    ? "e433da54-560c-4c50-bf0b-7cd68acf11e6" 
                    : o.id 
                }}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:underline hover:cursor-pointer transition-all active:scale-95"
              >
                Manage <ExternalLink className="h-3 w-3" />
              </Link>
            ])}
          />
        )}
      </section>
    </div>
  );
}

type OrderRow = {
  id: string;
  status?: string;
  total_price?: number;
  restaurant_id?: string;
  customer_id?: string;
  created_at?: string;
};
type NamedRow = { id: string; name?: string };
type DemoRestaurantInsert = {
  id: string;
  name: string;
  address: string;
  status: string;
  city: string;
};

const IN_PROGRESS = ["PLACED", "CONFIRMED", "ACCEPTED", "PREPARING", "READY", "ASSIGNING", "ASSIGNED", "AT_PICKUP", "PICKED_UP", "ON_THE_WAY", "ARRIVED"];

