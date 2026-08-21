import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, CreditCard, Wallet, Banknote, Smartphone, MapPin, Zap, Check, ShieldCheck, Tag, X, MessageSquareText, Clock3, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart, useOrders } from "@/lib/stores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { currency, cn } from "@/lib/format";
import { paymentMethods } from "@/lib/mock-data";
import { toast } from "sonner";
import { scheduleOrder } from "@/lib/insforge";
import { useMyWallet } from "@/lib/scoobix-loyalty";
import { useAuth } from "@/lib/auth-store";
import { redeemCampaign, type PaymentMethodKey } from "@/lib/campaigns-api";
import { campaignCouponId, recordCouponUsage } from "@/lib/coupons-api";
import { fetchAddresses, type Address } from "@/lib/addresses-api";
import { RoleGuard } from "@/components/cravio/RoleGuard";

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
  const { items, totals, restaurant, clear, coupon, coupons, applyCoupon, removeCoupon, appliedCampaign, eligibleOffers, pendingRewards, setPaymentMethod } = useCart();
  const { placeOrder } = useOrders();
  const { user } = useAuth();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState("standard");
  const [pay, setPay] = useState("card");
  const [placing, setPlacing] = useState(false);
  const [instructionId, setInstructionId] = useState<string | null>(null);
  const [contactless, setContactless] = useState(false);
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { balance: walletBalance, debit: walletDebit, credit: walletCredit } = useMyWallet();

  useEffect(() => {
    if (user?.id) {
      fetchAddresses(user.id).then(addrs => {
        setAddresses(addrs);
        const def = addrs.find(a => a.is_default) || addrs[0];
        if (def) setAddressId(def.id);
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("[CHECKOUT] Geolocation capture failed:", err.message),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  useEffect(() => { setPaymentMethod(pay as PaymentMethodKey); }, [pay, setPaymentMethod]);

  const address = addresses.find((a) => a.id === addressId);
  const deliveryObj = DELIVERY_OPTIONS.find((d) => d.id === delivery)!;
  const payObj = PAY_OPTIONS.find((p) => p.id === pay)!;

  const orderTotal = totals.total + deliveryObj.price;
  const walletApplied = pay === "wallet"
    ? Math.min(walletBalance, orderTotal)
    : (useWalletBalance ? Math.min(walletBalance, orderTotal) : 0);
  const finalTotal = Math.max(0, orderTotal - walletApplied);

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

  // Profile completion gate for checkout
  if (!user || !user.name || !user.phone || !address) {
    return (
      <div className="min-h-svh p-6 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <ShieldCheck className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-display font-extrabold italic uppercase tracking-tight mb-2">Complete your profile</h2>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm">We need your phone number and a saved address to finalize your order.</p>
        <Button onClick={() => navigate({ to: "/app/profile" })} className="w-full h-14 rounded-2xl text-sm font-bold uppercase tracking-widest shadow-glow">
          Go to Profile
        </Button>
      </div>
    );
  }

  const handlePlace = async () => {
    if (pay === "wallet" && walletBalance < orderTotal) {
      toast.error("Insufficient wallet balance for wallet-only payment.");
      return;
    }
    setPlacing(true);
    const instructionLabel = INSTRUCTION_OPTIONS.find((i) => i.id === instructionId)?.label;
    const res = await placeOrder({
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
      addressLine: address.address,
      paymentMethod: pay,
      paymentLabel: walletApplied > 0 && pay !== "wallet" ? `${payObj.label} + Wallet` : payObj.label,
      deliveryInstructions: instructionLabel,
      contactless,
      notes: notes.trim() || undefined,
      couponCode: coupon?.code,
      delivery_latitude: coords?.lat,
      delivery_longitude: coords?.lng,
    });

    if (!res.ok || !res.orderId) {
      setPlacing(false);
      toast.error(res.message ?? "Could not place the order");
      return;
    }
    const orderId = res.orderId;
    if (scheduledFor) void scheduleOrder(orderId, scheduledFor);
    if (appliedCampaign) {
      const couponId = campaignCouponId(appliedCampaign.campaign);
      const couponRow = couponId ? coupons.find((c) => c.id === couponId) : undefined;
      if (couponRow) {
        void recordCouponUsage({
          coupon: couponRow,
          userId: user?.id,
          orderId,
          restaurantId: restaurant.id,
          orderValue: totals.subtotal,
          discountAmount: appliedCampaign.discount,
          autoApplied: !coupon?.campaignId,
          paymentMethod: pay,
        });
      } else void redeemCampaign({
        campaign: appliedCampaign.campaign,
        orderId,
        restaurantId: restaurant.id,
        orderValue: totals.subtotal,
        discountAmount: appliedCampaign.discount,
        autoApplied: !coupon?.campaignId,
      });
      if (pendingRewards.cashback > 0) walletCredit(pendingRewards.cashback, "cashback", `${appliedCampaign.campaign.name} cashback`);
      if (pendingRewards.walletCredit > 0) walletCredit(pendingRewards.walletCredit, "credit", `${appliedCampaign.campaign.name} wallet credit`);
    }
    if (walletApplied > 0) walletDebit(walletApplied, "debit", `Order ${orderId}`);
    if (pay !== "cash" && finalTotal > 0) {
      const cashback = Math.round(finalTotal * 0.02);
      if (cashback > 0) walletCredit(cashback, "cashback", `Cashback · Order ${orderId}`);
    }
    clear();
    toast.success("Order placed!", { description: `Tracking #${orderId.slice(-5)}` });
    if (pay === "cash") navigate({ to: "/track/$orderId", params: { orderId } });
    else navigate({ to: "/app/success" });
  };

  return (
    <RoleGuard allow="customer">
      <div className="min-h-svh pb-32">
        <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_40px] items-center gap-3">
            <button onClick={() => navigate({ to: "/app/cart" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
            <h1 className="text-center font-display text-base font-bold">Checkout</h1>
            <div />
          </div>
        </header>

        <div className="space-y-4 p-4">
          <div className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-soft ring-1 ring-border/60">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary"><MapPin className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deliver to · {address.label}</div>
              <div className="truncate text-sm font-semibold">{address.address}</div>
            </div>
          </div>

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

          <section>
            <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment method</h3>
            <div className="mt-2 space-y-2">
              {PAY_OPTIONS.map((p) => {
                const Icon = p.icon;
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
                      {p.id === "wallet" && <div className="text-xs text-muted-foreground">Balance {currency(walletBalance)}</div>}
                    </div>
                    {pay === p.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="pt-6">
            <Button 
              onClick={handlePlace}
              disabled={placing}
              className="h-14 w-full rounded-full gradient-primary text-base font-bold text-primary-foreground shadow-glow"
            >
              {placing ? "Placing Order..." : `Place Order · ${currency(finalTotal)}`}
            </Button>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
