import { createFileRoute } from "@tanstack/react-router";
import { useBulk } from "@/lib/scoobix-extras";
import { useAuth } from "@/lib/auth-store";
import { Building2, Check, X } from "lucide-react";
import { cn, currency } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/partner/bulk")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Bulk Orders" }] }),
  component: PartnerBulk,
});

function PartnerBulk() {
  const { user } = useAuth();
  const { requests, updateStatus } = useBulk();
  const restaurantId = ((user as unknown as { restaurantId?: string })?.restaurantId) ?? "";
  const list = requests.filter((r) => !r.restaurantId || r.restaurantId === restaurantId);

  return (
    <div className="animate-fade-up px-5 pt-7 pb-24">
      <header className="mb-5">
        <p className="eyebrow">Corporate & Bulk</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Catering requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">Accept or decline event and office orders.</p>
      </header>

      {list.length === 0 ? (
        <div className="rounded-3xl bg-card p-10 text-center shadow-soft ring-1 ring-border/60">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No bulk requests right now.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold">{r.customerName}</p>
                  <p className="text-[12px] text-muted-foreground">{r.eventDate} at {r.eventTime} · {r.guestCount} guests · budget {currency(r.budget)}</p>
                  {r.notes && <p className="mt-1.5 text-[12px]">{r.notes}</p>}
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold capitalize",
                  r.status === "accepted" ? "bg-primary-soft text-primary" :
                  r.status === "rejected" ? "bg-destructive/10 text-destructive" :
                  "bg-warning/15 text-[oklch(0.45_0.14_70)]")}>{r.status}</span>
              </div>
              {r.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { updateStatus(r.id, "rejected"); toast.success("Declined"); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-destructive/10 py-2.5 text-sm font-bold text-destructive"><X className="h-4 w-4" /> Decline</button>
                  <button onClick={() => { updateStatus(r.id, "accepted"); toast.success("Accepted · customer notified"); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-glow"><Check className="h-4 w-4" /> Accept</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
