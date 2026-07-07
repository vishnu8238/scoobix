import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Minus, Plus, Tag, Trash2, X, ShoppingBag, AlertTriangle, Users, Truck } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/stores";
import { useCms } from "@/lib/cms-store";
import { useGroupCart } from "@/lib/scoobix-extras";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currency } from "@/lib/format";
import { EmptyState } from "@/components/cravio/EmptyState";
import { toast } from "sonner";


export const Route = createFileRoute("/app/cart")({
  head: () => ({ meta: [{ title: "Scoobix · Cart" }] }),
  component: CartPage,
});

function CartPage() {
  const navigate = useNavigate();
  const { items, setQty, removeItem, totals, coupon, applyCoupon, removeCoupon, restaurant, clear } = useCart();
  const { closedRestaurants, dishAvailability } = useCms();
  const { createSession } = useGroupCart();
  const { user } = useAuth();
  const restaurantClosed = restaurant ? !!closedRestaurants[restaurant.id] : false;
  const unavailableItems = items.filter((it) => dishAvailability[it.dishId] === false);
  const [code, setCode] = useState("");

  const startGroup = async () => {
    if (!restaurant) return;
    const s = createSession({
      hostId: user?.id ?? "guest",
      hostName: user?.name ?? "Host",
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
    });
    const url = `${window.location.origin}/app/group/${s.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Join my Scoobix cart", url });
      else { await navigator.clipboard.writeText(url); toast.success("Invite link copied"); }
    } catch { /* cancelled */ }
    navigate({ to: "/app/group/$sessionId", params: { sessionId: s.id } });
  };

  if (items.length === 0) {

    return (
      <div className="min-h-svh">
        <Header onBack={() => navigate({ to: "/app" })} title="Your cart" />
        <EmptyState
          icon={<ShoppingBag className="h-9 w-9" />}
          title="Your cart is empty"
          description="Add dishes from any restaurant to get started."
          action={{ label: "Browse restaurants", to: "/app" }}
        />
      </div>
    );
  }

  const handleApply = () => {
    if (!code.trim()) return;
    const res = applyCoupon(code);
    if (res.ok) { toast.success(res.message); setCode(""); } else { toast.error(res.message); }
  };

  return (
    <div className="min-h-svh pb-32">
      <Header onBack={() => navigate({ to: "/app" })} title="Your cart" right={
        <button onClick={() => { clear(); toast.success("Cart cleared"); }} className="text-xs font-semibold text-destructive">Clear</button>
      } />

      {restaurant && (
        <Link to="/restaurant/$id" params={{ id: restaurant.id }} className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60">
          <img src={restaurant.logo} alt="" className="h-12 w-12 rounded-xl object-cover" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{restaurant.name}</div>
            <div className="truncate text-xs text-muted-foreground">{restaurant.cuisine} · {restaurant.deliveryMins} min</div>
          </div>
        </Link>
      )}

      <div className="mx-4 mt-3 flex flex-wrap items-center gap-2">
        {totals.freeDeliveryEligible && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-extrabold text-primary"><Truck className="h-3 w-3" /> Free delivery</span>
        )}
        {restaurant && (
          <button onClick={startGroup} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px] font-bold"><Users className="h-3 w-3" /> Invite to cart</button>
        )}
      </div>

      )}

      {restaurantClosed && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <div className="font-bold text-destructive">Restaurant is currently closed</div>
            <div className="text-destructive/80">You can't check out until they reopen.</div>
          </div>
        </div>
      )}
      {unavailableItems.length > 0 && (
        <div className="mx-4 mt-3 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-[oklch(0.45_0.14_70)]"><AlertTriangle className="h-4 w-4" /> Some items are unavailable</div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {unavailableItems.map((u) => <li key={u.lineId}>{u.name}</li>)}
          </ul>
          <button onClick={() => { unavailableItems.forEach((u) => removeItem(u.lineId)); toast.success("Unavailable items removed"); }} className="mt-2 rounded-full bg-card px-3 py-1 font-semibold text-foreground ring-1 ring-border">Remove unavailable items</button>
        </div>
      )}

      <ul className="mt-4 divide-y divide-border px-4">
        {items.map((it) => (
          <li key={it.lineId} className="flex gap-3 py-4 animate-fade-up">
            <img src={it.image} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-soft" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold leading-tight">{it.name}</h4>
                <button onClick={() => removeItem(it.lineId)} aria-label="Remove" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {it.customizations.length > 0 && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{it.customizations.join(" · ")}</p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
                  <button onClick={() => setQty(it.lineId, it.qty - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-card shadow-soft"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-5 text-center text-xs font-bold">{it.qty}</span>
                  <button onClick={() => setQty(it.lineId, it.qty + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-card shadow-soft"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <span className="text-sm font-bold">{currency(it.price * it.qty)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mx-4 mt-4 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <h4 className="flex items-center gap-2 text-sm font-bold"><Tag className="h-4 w-4 text-primary" /> Apply coupon</h4>
        {coupon ? (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-primary-soft p-3">
            <div>
              <div className="text-sm font-bold text-primary">{coupon.code}</div>
              <div className="text-xs text-primary/80">{coupon.label}</div>
            </div>
            <button onClick={removeCoupon} className="grid h-7 w-7 place-items-center rounded-full bg-white text-primary"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Try SCOOBIX10 or FREESHIP" className="rounded-full" />
            <Button onClick={handleApply} className="rounded-full">Apply</Button>
          </div>
        )}
      </div>

      <div className="mx-4 mt-4 space-y-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60 text-sm">
        <Row label="Item total" value={currency(totals.subtotal)} />
        <Row label="Delivery fee" value={totals.delivery === 0 ? "Free" : currency(totals.delivery)} />
        <Row label="Taxes" value={currency(totals.taxes)} />
        {totals.discount > 0 && <Row label="Discount" value={`- ${currency(totals.discount)}`} accent />}
        <div className="my-2 h-px bg-border" />
        <Row label="Total to pay" value={currency(totals.total)} strong />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[460px] px-4">
        <Button
          onClick={() => navigate({ to: "/app/checkout" })}
          className="h-14 w-full rounded-full gradient-primary text-base font-bold text-primary-foreground shadow-glow"
        >
          Proceed to checkout · {currency(totals.total)}
        </Button>
      </div>
    </div>
  );
}

function Header({ onBack, title, right }: { onBack: () => void; title: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        <h1 className="truncate text-center font-display text-base font-bold">{title}</h1>
        <div className="min-w-[40px] text-right">{right}</div>
      </div>
    </header>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "text-base font-bold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className={accent ? "font-bold text-primary" : strong ? "text-foreground" : ""}>{value}</span>
    </div>
  );
}
