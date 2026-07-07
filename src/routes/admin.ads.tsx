import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Check, X, Pause, Play, Eye } from "lucide-react";
import { useAds, type RestaurantAd } from "@/lib/ads-store";
import { restaurants } from "@/lib/mock-data";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/ads")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Ads" }] }),
  component: AdminAdsPage,
});

function AdminAdsPage() {
  const { ads, setStatus } = useAds();
  const restName = (id: string) => restaurants.find((r) => r.id === id)?.name ?? id;
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
  const pending = ads.filter((a) => a.status === "pending");
  const active = ads.filter((a) => a.status === "active");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">Ads Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Approve campaigns and monitor sponsored placements.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Total campaigns" value={ads.length} />
        <Kpi label="Pending approval" value={pending.length} accent />
        <Kpi label="Active" value={active.length} />
        <Kpi label="Total spend" value={formatPrice(totalSpend)} />
      </div>

      <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <h2 className="mb-3 font-display text-lg font-extrabold tracking-tight">All campaigns</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Restaurant</TableHead>
              <TableHead>Budget / Bid</TableHead>
              <TableHead>Clicks</TableHead>
              <TableHead>Spend</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ads.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.campaign_name}</TableCell>
                <TableCell>{restName(a.restaurant_id)}</TableCell>
                <TableCell>{formatPrice(a.budget)} / ₹{a.cpc_bid}</TableCell>
                <TableCell>{a.clicks}</TableCell>
                <TableCell>{formatPrice(a.spend)}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {a.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => { setStatus(a.id, "active"); toast.success("Campaign approved"); }}>
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setStatus(a.id, "rejected"); toast.error("Campaign rejected"); }}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </>
                    )}
                    {a.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => { setStatus(a.id, "paused"); toast("Paused"); }}>
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </Button>
                    )}
                    {a.status === "paused" && (
                      <Button size="sm" onClick={() => setStatus(a.id, "active")}>
                        <Play className="h-3.5 w-3.5" /> Resume
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
          <Eye className="h-4 w-4" /> Sponsored restaurants (currently live)
        </h2>
        <div className="grid gap-2">
          {active.length === 0 && <p className="text-sm text-muted-foreground">No live sponsored placements.</p>}
          {active.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-2">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                <span className="font-medium">{restName(a.restaurant_id)}</span>
                <span className="text-xs text-muted-foreground">· {a.campaign_name}</span>
              </div>
              <span className="text-xs font-bold">{formatPrice(a.spend)} / {formatPrice(a.budget)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`rounded-3xl p-5 shadow-card ring-1 ring-border/60 ${accent ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <p className="font-display text-2xl font-extrabold tracking-tight">{value}</p>
      <p className={`text-[12px] font-medium ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: RestaurantAd["status"] }) {
  const variant = status === "active" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant as any}>{status}</Badge>;
}
