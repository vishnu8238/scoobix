import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { restaurants } from "@/lib/mock-data";
import { useOrders } from "@/lib/stores";
import { formatPrice } from "@/lib/format";
import { EmptyState } from "@/components/cravio/EmptyState";
import { toast } from "sonner";
import { useCart } from "@/lib/stores";

export const Route = createFileRoute("/app/recent")({
  head: () => ({ meta: [{ title: "Scoobix · Recently viewed" }] }),
  component: RecentPage,
});

function RecentPage() {
  const { orders, reorder } = useOrders();
  const recentlyViewed = restaurants.slice(0, 5);
  const cart = useCart();

  const handleReorder = (id: string) => {
    const items = reorder(id);
    if (!items || items.length === 0) return toast.error("Couldn't reorder");
    cart.clear();
    items.forEach((it) => cart.addItem({
      dishId: it.dishId, name: it.name, image: it.image, price: it.price,
      restaurantId: it.restaurantId, restaurantName: it.restaurantName, customizations: it.customizations,
    }, it.qty));
    toast.success(`${items.length} items added to cart`);
  };

  return (
    <div className="min-h-svh pb-16">
      <PageHeader title="Recent activity" />

      <section className="px-4 pt-4">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Recently viewed</h3>
        {recentlyViewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="space-y-3">
            {recentlyViewed.map((r) => (
              <li key={r.id}>
                <Link to="/restaurant/$id" params={{ id: r.id }} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60">
                  <img src={r.logo} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{r.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.cuisine} · {r.deliveryMins} min · ⭐ {r.rating}</div>
                  </div>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="px-4 pt-8">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Reorder past orders</h3>
        {orders.length === 0 ? (
          <EmptyState
            icon={<RotateCcw className="h-9 w-9" />}
            title="No orders yet"
            description="Place your first order to see quick reorder shortcuts here."
            action={{ label: "Start ordering", to: "/app" }}
          />
        ) : (
          <ul className="space-y-3">
            {orders.slice(0, 6).map((o) => (
              <li key={o.id} className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                <div className="flex items-center gap-3">
                  <img src={o.restaurantImage} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{o.restaurantName}</div>
                    <div className="truncate text-xs text-muted-foreground">{o.items.length} items · {formatPrice(o.total)}</div>
                  </div>
                  <button onClick={() => handleReorder(o.id)} className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-glow active:scale-95">
                    <RotateCcw className="h-3 w-3" /> Reorder
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
