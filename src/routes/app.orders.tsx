import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useCart, useOrders, STATUS_LABEL, type Order } from "@/lib/stores";
import { ReceiptText, RotateCcw, ArrowLeft, X, FileText, Star, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { currency, cn } from "@/lib/format";
import { EmptyState } from "@/components/cravio/EmptyState";
import { toast } from "sonner";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/app/orders")({
  head: () => ({ meta: [{ title: "Scoobix · Orders" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const navigate = useNavigate();
  const { orders, reorder, cancelOrder } = useOrders();
  const { addItem, clear } = useCart();
  const [tab, setTab] = useState<"active" | "past">("active");
  const [sheet, setSheet] = useState<{ kind: "invoice" | "rate" | "report"; order: Order } | null>(null);
  const [rating, setRating] = useState(5);
  const [reportText, setReportText] = useState("");

  const active = orders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED");
  const past = orders.filter((o) => o.status === "DELIVERED" || o.status === "CANCELLED");
  const list = tab === "active" ? active : past;

  const handleReorder = (id: string) => {
    const items = reorder(id);
    if (!items) return;
    clear();
    for (const it of items) {
      addItem({
        dishId: it.dishId,
        name: it.name,
        image: it.image,
        price: it.price,
        restaurantId: it.restaurantId,
        restaurantName: it.restaurantName,
        customizations: it.customizations,
      }, it.qty);
    }
    toast.success("Items added to cart");
    navigate({ to: "/app/cart" });
  };

  return (
    <RoleGuard allow="customer">
      <div className="min-h-svh">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_40px] items-center gap-3">
          <button onClick={() => navigate({ to: "/app" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-center font-display text-base font-bold">Your orders</h1>
          <div />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
          {(["active", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full py-1.5 text-xs font-bold capitalize transition",
                tab === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {t} {t === "active" && active.length > 0 && <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-primary">{active.length}</span>}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 space-y-3">
        {list.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-9 w-9" />}
            title={tab === "active" ? "No active orders" : "No past orders"}
            description={tab === "active" ? "When you place an order it will show up here." : "Your delivered orders will appear here."}
            action={{ label: "Browse restaurants", to: "/app" }}
          />
        ) : list.map((o) => (
          <div key={o.id} className="overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-border/60 animate-fade-up">
            <div className="flex items-center gap-3 p-4">
              <img src={o.restaurantImage} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{o.restaurantName}</div>
                <div className="truncate text-xs text-muted-foreground">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">{currency(o.total)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">#{o.id.slice(-5)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 bg-secondary/40 px-4 py-2.5">
              <span className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-bold",
                o.status === "DELIVERED" ? "bg-primary-soft text-primary" :
                o.status === "CANCELLED" ? "bg-destructive/10 text-destructive" :
                "bg-warning/15 text-[oklch(0.45_0.14_70)]",
              )}>
                {STATUS_LABEL[o.status]}
              </span>
              <div className="flex gap-2">
                {o.status !== "DELIVERED" && o.status !== "CANCELLED" && (
                  <Link to="/track/$orderId" params={{ orderId: o.id }}>
                    <Button size="sm" className="h-8 rounded-full px-3 text-xs font-bold gradient-primary text-primary-foreground">Track</Button>
                  </Link>
                )}
                {o.status !== "DELIVERED" && o.status !== "CANCELLED" && o.status !== "PICKED_UP" && o.status !== "OUT_FOR_DELIVERY" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const res = await cancelOrder(o.id);
                      res.ok ? toast.success(res.message) : toast.error(res.message);
                    }}
                    className="h-8 rounded-full px-3 text-xs font-bold text-destructive"
                  >

                    <X className="mr-1 h-3 w-3" /> Cancel
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => handleReorder(o.id)} className="h-8 rounded-full px-3 text-xs font-bold">
                  <RotateCcw className="mr-1 h-3 w-3" /> Reorder
                </Button>
              </div>
            </div>
            {(o.status === "DELIVERED" || o.status === "CANCELLED") && (
              <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2.5">
                <button onClick={() => setSheet({ kind: "invoice", order: o })} className="inline-flex h-8 items-center gap-1 rounded-full bg-secondary px-3 text-xs font-bold">
                  <FileText className="h-3 w-3" /> Invoice
                </button>
                {o.status === "DELIVERED" && (
                  <button onClick={() => { setRating(5); setSheet({ kind: "rate", order: o }); }} className="inline-flex h-8 items-center gap-1 rounded-full bg-secondary px-3 text-xs font-bold">
                    <Star className="h-3 w-3" /> Rate
                  </button>
                )}
                <button onClick={() => { setReportText(""); setSheet({ kind: "report", order: o }); }} className="inline-flex h-8 items-center gap-1 rounded-full bg-secondary px-3 text-xs font-bold text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Report
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Sheet open={sheet?.kind === "invoice"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle>Invoice · #{sheet?.order.id.slice(-6)}</SheetTitle>
            <SheetDescription>{sheet?.order.restaurantName} · {sheet?.order.addressLine}</SheetDescription>
          </SheetHeader>
          {sheet?.order && (
            <div className="mt-4 space-y-2 text-sm">
              <ul className="divide-y divide-border/60 rounded-2xl bg-secondary/40">
                {sheet.order.items.map((it) => (
                  <li key={it.lineId} className="flex items-center justify-between px-3 py-2">
                    <span><span className="font-bold text-primary">{it.qty}×</span> {it.name}</span>
                    <span className="font-medium">{currency(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl border border-border/60 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{currency(sheet.order.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{currency(sheet.order.delivery)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Taxes</span><span>{currency(sheet.order.taxes)}</span></div>
                {sheet.order.discount > 0 && <div className="flex justify-between text-primary"><span>Discount</span><span>- {currency(sheet.order.discount)}</span></div>}
                <div className="my-1 h-px bg-border" />
                <div className="flex justify-between text-sm font-bold"><span>Total paid</span><span>{currency(sheet.order.total)}</span></div>
              </div>
              <Button onClick={() => { toast.success("Invoice downloaded (demo)"); setSheet(null); }} className="w-full rounded-full">Download PDF</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={sheet?.kind === "rate"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle>Rate your order</SheetTitle>
            <SheetDescription>{sheet?.order.restaurantName}</SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex justify-center gap-2">
            {[1,2,3,4,5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`Rate ${n}`}>
                <Star className={cn("h-9 w-9", n <= rating ? "fill-primary text-primary" : "text-muted-foreground")} />
              </button>
            ))}
          </div>
          <Button onClick={() => { toast.success(`Thanks for your ${rating}★ rating!`); setSheet(null); }} className="mt-5 w-full rounded-full">Submit rating</Button>
        </SheetContent>
      </Sheet>

      <Sheet open={sheet?.kind === "report"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle>Report an issue</SheetTitle>
            <SheetDescription>Tell us what went wrong with #{sheet?.order.id.slice(-6)}.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {["Missing items","Wrong item","Cold food","Late delivery","Damaged packaging"].map((r) => (
                <button key={r} onClick={() => setReportText((t) => t ? `${t}, ${r}` : r)} className="rounded-full bg-secondary px-3 py-1.5 font-semibold">{r}</button>
              ))}
            </div>
            <Textarea value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Add details (optional)" className="min-h-[100px] rounded-2xl" />
            <Button onClick={() => { toast.success("Report submitted · support will reach out"); setSheet(null); }} className="w-full rounded-full">Submit report</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </RoleGuard>
  );
}
