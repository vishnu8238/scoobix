import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
;
import { Check, X, ChevronRight, Phone } from "lucide-react";
import { cn, formatPrice } from "@/lib/format";
import { toast } from "sonner";
import { updateOrderStatus } from "@/lib/insforge";
import { nudgeTable } from "@/lib/realtime";
import { useLiveOrders } from "@/lib/realtime-hooks";
import { useDispatchDaemon } from "@/lib/dispatch-engine";
import { useOrderFinalizationDaemon } from "@/lib/order-completion";

export const Route = createFileRoute("/partner/orders")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Orders" }] }),
  component: PartnerOrders,
});

const TABS: { id: "new" | "active" | "completed"; label: string; match: (s: PartnerOrderStatus) => boolean }[] = [
  { id: "new", label: "New", match: (s) => s === "PLACED" },
  { id: "active", label: "Active", match: (s) => ["ACCEPTED", "PREPARING", "READY"].includes(s) },
  { id: "completed", label: "Completed", match: (s) => s === "COMPLETED" || s === "REJECTED" },
];

// Backend statuses → partner UI statuses.
const BACKEND_TO_PARTNER: Record<string, PartnerOrderStatus> = {
  PLACED: "PLACED",
  ACCEPTED: "ACCEPTED",
  ASSIGNING: "ACCEPTED",
  PREPARING: "PREPARING",
  READY: "READY",
  PICKED_UP: "READY",
  ON_THE_WAY: "READY",
  DELIVERED: "COMPLETED",
  COMPLETED: "COMPLETED",
  CANCELLED: "REJECTED",
  REJECTED: "REJECTED",
  NO_DRIVERS: "READY",
};

type OrderRow = { id: string; customer_id?: string; total_price?: number; status?: string; created_at?: string; driver_id?: string | null };

function mapRow(r: OrderRow): PartnerOrder {
  const status = BACKEND_TO_PARTNER[String(r.status ?? "")] ?? "PLACED";
  const ageMin = r.created_at ? Math.max(0, Math.round((Date.now() - Date.parse(r.created_at)) / 60000)) : 0;
  return {
    id: String(r.id),
    customer: r.customer_id ? `Customer ${String(r.customer_id).slice(0, 6)}` : "Customer",
    items: [],
    total: Number(r.total_price ?? 0),
    placedAgo: ageMin < 1 ? "just now" : `${ageMin} min`,
    paymentMethod: "Card",
    status,
    address: "—",
    rider: r.driver_id ? String(r.driver_id).slice(0, 8) : undefined,
  } as PartnerOrder;
}

function PartnerOrders() {
  useDispatchDaemon();
  useOrderFinalizationDaemon();
  const { rows } = useLiveOrders();
  const [tab, setTab] = useState<"new" | "active" | "completed">("new");
  const [openId, setOpenId] = useState<string | null>(null);
  const [prepMins, setPrepMins] = useState<Record<string, number>>({});

  const orders = useMemo<PartnerOrder[]>(() => {
    if (!rows.length) return fallbackOrders;
    return rows.map((r) => mapRow(r as OrderRow));
  }, [rows]);

  const filtered = orders.filter((o) => TABS.find((t) => t.id === tab)!.match(o.status));

  const update = (id: string, status: PartnerOrderStatus) => {
    // Map partner status back to canonical backend status.
    const backend =
      status === "COMPLETED" ? "DELIVERED" :
      status === "READY" ? "READY" :
      status === "PREPARING" ? "PREPARING" :
      status === "ACCEPTED" ? "ACCEPTED" :
      status === "REJECTED" ? "CANCELLED" : "PLACED";
    void updateOrderStatus(id, { status: backend });
    nudgeTable("orders");
    toast.success(`Order ${id} → ${status}`);
  };

  const reject = (o: PartnerOrder) => {
    const reason = typeof window !== "undefined" ? window.prompt(`Reject ${o.id} — reason?`, "Out of stock") : null;
    if (reason === null) return;
    void updateOrderStatus(o.id, { status: "CANCELLED", reject_reason: reason || undefined });
    nudgeTable("orders");
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
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(o as unknown as { scheduled_for?: string }).scheduled_for && (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-[oklch(0.45_0.14_70)]">Scheduled</span>
                    )}
                    {(o as unknown as { batch_id?: string }).batch_id && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">Batched</span>
                    )}
                  </div>
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

                  {o.status !== "COMPLETED" && o.status !== "REJECTED" && (
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Prep time</span>
                      <div className="flex gap-1">
                        {[10, 15, 20, 30].map((m) => {
                          const sel = (prepMins[o.id] ?? 15) === m;
                          return (
                            <button
                              key={m}
                              onClick={() => { void updateOrderStatus(o.id, { prep_minutes: m }); setPrepMins((p) => ({ ...p, [o.id]: m })); toast.success(`${o.id} · prep ${m} min`); }}
                              className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold transition", sel ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")}
                            >{m}m</button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
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
