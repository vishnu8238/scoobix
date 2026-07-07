import { createFileRoute } from "@tanstack/react-router";
import { useBulk } from "@/lib/scoobix-extras";
import { Building2 } from "lucide-react";
import { cn, currency } from "@/lib/format";

export const Route = createFileRoute("/admin/bulk")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Bulk Orders" }] }),
  component: AdminBulk,
});

function AdminBulk() {
  const { requests } = useBulk();
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Bulk & Corporate</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">All catering requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitor bulk orders across every Scoobix partner.</p>
      </header>

      {requests.length === 0 ? (
        <div className="rounded-3xl bg-card p-14 text-center shadow-card ring-1 ring-border/60">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No bulk requests yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Guests</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Restaurant</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-bold">{r.customerName}</td>
                  <td className="px-4 py-3">{r.eventDate} · {r.eventTime}</td>
                  <td className="px-4 py-3">{r.guestCount}</td>
                  <td className="px-4 py-3">{currency(r.budget)}</td>
                  <td className="px-4 py-3">{r.restaurantName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold capitalize",
                      r.status === "accepted" ? "bg-primary-soft text-primary" :
                      r.status === "rejected" ? "bg-destructive/10 text-destructive" :
                      "bg-warning/15 text-[oklch(0.45_0.14_70)]")}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
