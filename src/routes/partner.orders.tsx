import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { partnerOrders, PARTNER_STATUS_FLOW, type PartnerOrder, type PartnerOrderStatus } from "@/lib/role-data";
import { Check, X, ChevronRight, Phone } from "lucide-react";
import { cn, formatPrice } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/partner/orders")({
  head: () => ({ meta: [{ title: "Cravio Partner · Orders" }] }),
  component: PartnerOrders,
});

const TABS: { id: "new" | "active" | "completed"; label: string; match: (s: PartnerOrderStatus) => boolean }[] = [
  { id: "new", label: "New", match: (s) => s === "PLACED" },
  { id: "active", label: "Active", match: (s) => ["ACCEPTED", "PREPARING", "READY"].includes(s) },
  { id: "completed", label: "Completed", match: (s) => s === "COMPLETED" || s === "REJECTED" },
];

function PartnerOrders() {
  const [tab, setTab] = useState<"new" | "active" | "completed">("new");
  const [orders, setOrders] = useState(partnerOrders);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = orders.filter((o) => TABS.find((t) => t.id === tab)!.match(o.status));

  const update = (id: string, status: PartnerOrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    toast.success(`Order ${id} → ${status}`);
  };

  const reject = (o: PartnerOrder) => {
    const reason = typeof window !== "undefined" ? window.prompt(`Reject ${o.id} — reason?`, "Out of stock") : null;
    if (reason === null) return; // cancelled
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: "REJECTED" } : x)));
    toast.success(`${o.id} rejected · ${reason || "no reason given"}`);
  };

  const next = (o: PartnerOrder) => {
    const idx = PARTNER_STATUS_FLOW.indexOf(o.status);
    if (idx >= 0 && idx < PARTNER_STATUS_FLOW.length - 1) update(o.id, PARTNER_STATUS_FLOW[idx + 1]);
  };

  return (
    <div className="animate-fade-up px-5 pt-7">
      <header className="mb-5">
        <p className="eyebrow">Orders</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Manage orders</h1>
      </header>

      <div className="flex gap-2 rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-full px-3 py-2 text-[12px] font-bold transition",
              tab === t.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
            )}
          >
            {t.label}
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              {orders.filter((o) => TABS.find((tt) => tt.id === t.id)!.match(o.status)).length}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-3xl bg-card p-10 text-center shadow-soft ring-1 ring-border/60">
            <p className="text-sm text-muted-foreground">No {tab} orders right now</p>
          </div>
        )}

        {filtered.map((o) => {
          const isOpen = openId === o.id;
          return (
            <div key={o.id} className="overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-border/60">
              <button onClick={() => setOpenId(isOpen ? null : o.id)} className="flex w-full items-center gap-3 p-4 text-left transition active:scale-[0.99]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 font-display text-[13px] font-extrabold text-primary">
                  #{o.id.slice(-3)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold">{o.customer}</p>
                  <p className="text-[12px] text-muted-foreground">{o.items.length} items · {o.placedAgo} ago · {o.paymentMethod}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-base font-extrabold">{formatPrice(o.total)}</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{o.status}</span>
                </div>
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition", isOpen && "rotate-90")} />
              </button>

              {isOpen && (
                <div className="border-t border-border/60 bg-muted/30 p-4 animate-fade-up">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Items</div>
                  <ul className="space-y-1.5">
                    {o.items.map((it, i) => (
                      <li key={i} className="flex justify-between text-sm">
                        <span><span className="font-bold text-primary">{it.qty}×</span> {it.name}</span>
                        <span className="font-medium">{formatPrice(it.price * it.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="my-4 h-px bg-border" />
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Deliver to:</span> {o.address}</p>
                    {o.rider && <p><span className="text-muted-foreground">Rider:</span> {o.rider}</p>}
                  </div>

                  <div className="mt-4 flex gap-2">
                    {o.status === "PLACED" ? (
                      <>
                        <button onClick={() => reject(o)} className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive transition active:scale-95">
                          <X className="h-4 w-4" /> Reject
                        </button>
                        <button onClick={() => update(o.id, "ACCEPTED")} className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
                          <Check className="h-4 w-4" /> Accept order
                        </button>
                      </>
                    ) : o.status !== "COMPLETED" && o.status !== "REJECTED" ? (
                      <>
                        <a href="tel:0" className="flex items-center justify-center gap-1.5 rounded-2xl bg-card px-4 py-3 text-sm font-bold ring-1 ring-border transition active:scale-95">
                          <Phone className="h-4 w-4" /> Call
                        </a>
                        <button onClick={() => next(o)} className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
                          Move to {PARTNER_STATUS_FLOW[PARTNER_STATUS_FLOW.indexOf(o.status) + 1] ?? "COMPLETED"}
                        </button>
                      </>
                    ) : (
                      <p className="flex-1 text-center text-[12px] font-medium text-muted-foreground">Order closed</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
