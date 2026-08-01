import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { useNotifications } from "@/lib/notifications-store";
import { NotificationItem } from "./app.notifications";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/partner/notifications")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Notifications" }] }),
  component: PartnerNotifs,
});

const REJECT_REASONS = [
  "Kitchen too busy",
  "Item out of stock",
  "Closing soon",
  "Delivery unavailable to area",
  "Other reason",
];

function PartnerNotifs() {
  const navigate = useNavigate();
  const { list } = useNotifications("partner");
  const [incoming, setIncoming] = useState<{ id: string; customer: string; total: number; items: number } | null>({
    id: "CRV-8830", customer: "Maya Iyer", total: 4040, items: 4,
  });
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Notifications" subtitle="Live alerts · new orders" right={<button onClick={() => navigate({ to: "/partner/orders" })} className="text-[11px] font-bold uppercase tracking-wider text-primary">All orders</button>} />

      {incoming && (
        <section className="mx-4 mt-4 overflow-hidden rounded-3xl bg-card shadow-pop ring-2 ring-primary/40 animate-fade-up">
          <div className="flex items-center gap-3 bg-primary/10 px-4 py-3 text-primary">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow"><Bell className="h-4 w-4" /></span>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em]">New order</div>
              <div className="text-sm font-bold text-foreground">{incoming.id} · {incoming.customer}</div>
            </div>
            <span className="ml-auto rounded-full bg-primary text-primary-foreground px-3 py-1 text-[11px] font-bold animate-pulse">Just now</span>
          </div>
          <div className="px-4 py-4">
            <p className="text-sm text-muted-foreground">{incoming.items} items · ₹{incoming.total.toLocaleString("en-IN")}</p>

            {!rejecting ? (
              <div className="mt-4 flex items-center gap-2">
                <Button onClick={() => setRejecting(true)} variant="outline" className="flex-1 rounded-full"><X className="mr-1 h-4 w-4" /> Reject</Button>
                <Button onClick={() => { toast.success("Order accepted · preparing"); setIncoming(null); }} className="flex-1 rounded-full gradient-primary text-primary-foreground shadow-glow"><Check className="mr-1 h-4 w-4" /> Accept</Button>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Reason for rejection</h4>
                {REJECT_REASONS.map((r) => (
                  <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-sm transition ${reason === r ? "border-primary bg-primary-soft text-primary font-bold" : "border-border bg-secondary/40"}`}>
                    <input type="radio" name="reason" className="sr-only" onChange={() => setReason(r)} />
                    <span className={`h-4 w-4 rounded-full border-2 ${reason === r ? "border-primary bg-primary" : "border-border"}`} />
                    {r}
                  </label>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" onClick={() => { setRejecting(false); setReason(null); }} className="flex-1 rounded-full">Cancel</Button>
                  <Button onClick={() => { if (!reason) return toast.error("Pick a reason"); toast.success(`Order rejected · ${reason}`); setIncoming(null); setRejecting(false); }} className="flex-1 rounded-full bg-destructive text-destructive-foreground">Confirm reject</Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <ul className="mt-4 space-y-2 px-4">
        {list.map((n) => (
          <li key={n.id} onClick={() => n.unread && markRead(n.id)}><NotificationItem n={n} /></li>
        ))}
      </ul>
    </div>
  );
}
