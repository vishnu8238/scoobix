import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, CreditCard, Wallet, Banknote, Smartphone, MapPin, Zap, Check, ShieldCheck, Tag, X, MessageSquareText, Clock3 } from "lucide-react";
import { useState } from "react";
import { useCart, useOrders } from "@/lib/stores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { currency, cn } from "@/lib/format";
import { savedAddresses, paymentMethods } from "@/lib/mock-data";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { scheduleOrder } from "@/lib/insforge";


export const Route = createFileRoute("/app/checkout")({
  head: () => ({ meta: [{ title: "Scoobix · Checkout" }] }),
  component: CheckoutPage,
});

const DELIVERY_OPTIONS = [
  { id: "standard", label: "Standard", note: "30–40 min", price: 0, icon: "🛵" },
  { id: "priority", label: "Priority", note: "20 min · skip the queue", price: 2.0, icon: "⚡" },
];

const PAY_OPTIONS = [
  { id: "card",  label: "Credit / Debit card", icon: CreditCard },
  { id: "upi",   label: "UPI / Pay App",       icon: Smartphone },
  { id: "wallet",label: "Scoobix Wallet",       icon: Wallet },
  { id: "cash",  label: "Cash on delivery",    icon: Banknote },
];

const INSTRUCTION_OPTIONS = [
  { id: "door", label: "Leave at door" },
  { id: "hand", label: "Hand to me" },
  { id: "call", label: "Call on arrival" },
  { id: "guard", label: "Hand to security" },
  { id: "avoid_bell", label: "Don't ring bell" },
];

function CheckoutPage() {
  const navigate = useNavigate();
  const { items, totals, restaurant, clear, coupon, applyCoupon, removeCoupon } = useCart();
  const { placeOrder } = useOrders();

  const [addressId, setAddressId] = useState(savedAddresses.find((a) => a.default)!.id);
  const [delivery, setDelivery] = useState("standard");
  const [pay, setPay] = useState("card");
  const [addrOpen, setAddrOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [instructionId, setInstructionId] = useState<string | null>(null);
  const [contactless, setContactless] = useState(false);
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [scheduledFor, setScheduledFor] = useState<string>("");


  const address = savedAddresses.find((a) => a.id === addressId)!;
  const deliveryObj = DELIVERY_OPTIONS.find((d) => d.id === delivery)!;
  const payObj = PAY_OPTIONS.find((p) => p.id === pay)!;

  const finalTotal = totals.total + deliveryObj.price;

  if (!restaurant || items.length === 0) {
    return (
      <div className="min-h-svh">
        <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <button onClick={() => navigate({ to: "/app/cart" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
        </header>
        <div className="px-6 py-20 text-center">
          <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          <Button onClick={() => navigate({ to: "/app" })} className="mt-4 rounded-full">Browse restaurants</Button>
        </div>
      </div>
    );
  }

  const handlePlace = () => {
    setPlacing(true);
    const instructionLabel = INSTRUCTION_OPTIONS.find((i) => i.id === instructionId)?.label;
    setTimeout(() => {
      const orderId = placeOrder({
        items,
        totals: {
          subtotal: totals.subtotal,
          delivery: deliveryObj.price + (totals.delivery > 0 ? totals.delivery : 0),
          taxes: totals.taxes,
          discount: totals.discount,
          total: finalTotal,
        },
        restaurant,
        addressLabel: address.label,
        addressLine: `${address.line1}, ${address.line2}`,
        paymentLabel: payObj.label,
        deliveryInstructions: instructionLabel,
        contactless,
        notes: notes.trim() || undefined,
        couponCode: coupon?.code,
      });
      clear();
      toast.success("Order placed!", { description: `Tracking #${orderId}` });
      if (pay === "cash") navigate({ to: "/track/$orderId", params: { orderId } });
      else navigate({ to: "/app/success" });
    }, 700);
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    const res = applyCoupon(couponCode);
    if (res.ok) { toast.success(res.message); setCouponCode(""); } else { toast.error(res.message); }
  };

  return (
    <div className="min-h-svh pb-32">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_40px] items-center gap-3">
          <button onClick={() => navigate({ to: "/app/cart" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-center font-display text-base font-bold">Checkout</h1>
          <div />
        </div>
      </header>

      <div className="space-y-4 p-4">
        {/* Address */}
        <button onClick={() => setAddrOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-soft ring-1 ring-border/60">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary"><MapPin className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deliver to · {address.label}</div>
            <div className="truncate text-sm font-semibold">{address.line1}</div>
            <div className="truncate text-xs text-muted-foreground">{address.line2}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Delivery options */}
        <section>
          <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Delivery option</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {DELIVERY_OPTIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => setDelivery(d.id)}
                className={cn(
                  "rounded-2xl border-2 p-3 text-left",
                  delivery === d.id ? "border-primary bg-primary-soft" : "border-border bg-card",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{d.icon}</span>
                  {d.id === "priority" && <Zap className="h-4 w-4 text-warning" />}
                </div>
                <div className="mt-1 text-sm font-bold">{d.label}</div>
                <div className="text-[11px] text-muted-foreground">{d.note}</div>
                <div className="mt-1 text-xs font-semibold text-primary">{d.price === 0 ? "Free" : `+ ${currency(d.price)}`}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Payment */}
        <section>
          <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment method</h3>
          <div className="mt-2 space-y-2">
            {PAY_OPTIONS.map((p) => {
              const Icon = p.icon;
              const card = pay === "card" && p.id === "card" ? paymentMethods.find((m) => m.default) : null;
              return (
                <button
                  key={p.id}
                  onClick={() => setPay(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left",
                    pay === p.id ? "border-primary bg-primary-soft" : "border-border bg-card",
                  )}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground"><Icon className="h-4 w-4" /></span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{p.label}</div>
                    {card && <div className="text-xs text-muted-foreground">{card.brand} •••• {card.last4}</div>}
                  </div>
                  {pay === p.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* Delivery instructions */}
        <section>
          <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Delivery instructions</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {INSTRUCTION_OPTIONS.map((opt) => {
              const active = instructionId === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setInstructionId(active ? null : opt.id)}
                  className={cn(
                    "rounded-full border-2 px-3 py-1.5 text-xs font-bold transition active:scale-95",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Contactless delivery */}
        <section className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary"><ShieldCheck className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">Contactless delivery</div>
            <div className="text-xs text-muted-foreground">Rider will leave your order at the door.</div>
          </div>
          <Switch checked={contactless} onCheckedChange={setContactless} />
        </section>

        {/* Order notes */}
        <section>
          <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes for the restaurant</h3>
          <div className="mt-2 rounded-2xl bg-card p-2 shadow-soft ring-1 ring-border/60">
            <div className="flex items-start gap-2 px-2 pt-2">
              <MessageSquareText className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 240))}
                placeholder="Allergies, less spicy, no onions… (optional)"
                className="min-h-[64px] border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="px-2 pb-1 text-right text-[10px] text-muted-foreground">{notes.length}/240</div>
          </div>
        </section>

        {/* Coupon */}
        <section>
          <h3 className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Tag className="h-3.5 w-3.5" /> Coupon</h3>
          {coupon ? (
            <div className="mt-2 flex items-center justify-between rounded-2xl bg-primary-soft p-3 ring-1 ring-primary/30">
              <div>
                <div className="text-sm font-bold text-primary">{coupon.code}</div>
                <div className="text-xs text-primary/80">{coupon.label}</div>
              </div>
              <button onClick={removeCoupon} className="grid h-7 w-7 place-items-center rounded-full bg-white text-primary"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Enter coupon code" className="rounded-full" />
              <Button onClick={handleApplyCoupon} className="rounded-full">Apply</Button>
            </div>
          )}
        </section>


        {/* Summary */}
        <section className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <h3 className="text-sm font-bold">Order summary</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {items.map((it) => (
              <li key={it.lineId} className="flex justify-between gap-2">
                <span className="min-w-0 truncate"><span className="font-bold">{it.qty}×</span> {it.name}</span>
                <span className="shrink-0 font-semibold">{currency(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="my-3 h-px bg-border" />
          <div className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={currency(totals.subtotal)} />
            <Row label="Delivery" value={deliveryObj.price + totals.delivery === 0 ? "Free" : currency(deliveryObj.price + totals.delivery)} />
            <Row label="Taxes" value={currency(totals.taxes)} />
            {totals.discount > 0 && <Row label="Discount" value={`- ${currency(totals.discount)}`} accent />}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[460px] px-4">
        <Button
          onClick={handlePlace}
          disabled={placing}
          className="h-14 w-full rounded-full gradient-primary text-base font-bold text-primary-foreground shadow-glow disabled:opacity-70"
        >
          {placing ? "Placing order…" : `Place order · ${currency(finalTotal)}`}
        </Button>
      </div>

      <Sheet open={addrOpen} onOpenChange={setAddrOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle>Choose address</SheetTitle>
            <SheetDescription>We'll deliver to your selected address.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {savedAddresses.map((a) => (
              <button
                key={a.id}
                onClick={() => { setAddressId(a.id); setAddrOpen(false); }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left",
                  addressId === a.id ? "border-primary bg-primary-soft" : "border-border bg-card",
                )}
              >
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div className="flex-1">
                  <div className="text-sm font-bold">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.line1}, {a.line2}</div>
                </div>
                {addressId === a.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-bold text-primary" : "font-semibold"}>{value}</span>
    </div>
  );
}
