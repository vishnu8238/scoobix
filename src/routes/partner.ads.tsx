import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Megaphone, Plus, TrendingUp, MousePointerClick, Wallet, Pause, Play, Trash2 } from "lucide-react";
import { useAds, type RestaurantAd } from "@/lib/ads-store";
import { partnerRestaurant } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/partner/ads")({
  head: () => ({ meta: [{ title: "Cravio Partner · Ads" }] }),
  component: PartnerAdsPage,
});

const CATEGORIES = ["pizza", "burgers", "biryani", "sushi", "healthy", "desserts", "drinks", "tacos"];

function PartnerAdsPage() {
  const { ads, createAd, setStatus, deleteAd } = useAds();
  const mine = ads.filter((a) => a.restaurant_id === partnerRestaurant.id);
  const totals = mine.reduce(
    (acc, a) => ({ clicks: acc.clicks + a.clicks, spend: acc.spend + a.spend, budget: acc.budget + a.budget }),
    { clicks: 0, spend: 0, budget: 0 },
  );

  return (
    <div className="animate-fade-up space-y-7 px-5 pt-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Restaurant Partner</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Ads & Sponsored</h1>
          <p className="mt-1 text-sm text-muted-foreground">Boost visibility in the customer feed.</p>
        </div>
        <CreateCampaignDialog onCreate={createAd} restaurantId={partnerRestaurant.id} />
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={MousePointerClick} label="Total clicks" value={totals.clicks.toLocaleString()} tone="bg-primary text-primary-foreground" />
        <Stat icon={Wallet} label="Spend today" value={formatPrice(totals.spend)} tone="bg-amber-100 text-amber-700" />
        <Stat icon={TrendingUp} label="Daily budget" value={formatPrice(totals.budget)} tone="bg-emerald-100 text-emerald-700" />
        <Stat icon={Megaphone} label="Active" value={mine.filter((a) => a.status === "active").length} tone="bg-sky-100 text-sky-700" />
      </div>

      {/* Campaign list */}
      <section className="space-y-3">
        <h3 className="font-display text-lg font-extrabold tracking-tight">Your campaigns</h3>
        {mine.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">No campaigns yet. Create one to sponsor your restaurant.</p>
          </div>
        ) : (
          mine.map((a) => (
            <div key={a.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-extrabold tracking-tight">{a.campaign_name}</p>
                  <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">
                    {a.category} · {a.target_radius} km · {a.start_date} → {a.end_date}
                  </p>
                </div>
                <StatusPill status={a.status} />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Mini label="Budget" value={formatPrice(a.budget)} />
                <Mini label="Bid" value={`₹${a.cpc_bid}`} />
                <Mini label="Clicks" value={a.clicks.toString()} />
                <Mini label="Spend" value={formatPrice(a.spend)} />
              </div>
              <div className="mt-3 flex gap-2">
                {a.status === "active" ? (
                  <Button variant="outline" size="sm" onClick={() => setStatus(a.id, "paused")}>
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </Button>
                ) : a.status === "paused" ? (
                  <Button size="sm" onClick={() => setStatus(a.id, "active")}>
                    <Play className="h-3.5 w-3.5" /> Resume
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => { deleteAd(a.id); toast.success("Campaign deleted"); }}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-card ring-1 ring-border/60">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
        <Icon className="h-5 w-5" strokeWidth={2.4} />
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 px-2 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-sm font-extrabold">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: RestaurantAd["status"] }) {
  const tones: Record<string, string> = {
    active: "bg-primary/10 text-primary",
    paused: "bg-amber-100 text-amber-700",
    pending: "bg-sky-100 text-sky-700",
    rejected: "bg-red-100 text-red-700",
    ended: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${tones[status]}`}>
      {status}
    </span>
  );
}

function CreateCampaignDialog({
  onCreate, restaurantId,
}: { onCreate: ReturnType<typeof useAds>["createAd"]; restaurantId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState(1000);
  const [bid, setBid] = useState(10);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [radius, setRadius] = useState(5);
  const [areas, setAreas] = useState("Indiranagar, Koramangala");
  const [category, setCategory] = useState("pizza");

  const submit = () => {
    if (!name.trim()) { toast.error("Campaign name required"); return; }
    onCreate({
      restaurant_id: restaurantId,
      campaign_name: name.trim(),
      budget, cpc_bid: bid,
      start_date: start, end_date: end,
      target_radius: radius,
      target_areas: areas.split(",").map((s) => s.trim()).filter(Boolean),
      category,
      status: "pending",
    });
    toast.success("Campaign submitted for approval");
    setOpen(false);
    setName("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shrink-0">
          <Plus className="h-4 w-4" /> Create
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Campaign name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend Pizza Push" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily budget (₹)">
              <Input type="number" value={budget} onChange={(e) => setBudget(+e.target.value)} />
            </Field>
            <Field label="CPC bid (₹/click)">
              <Input type="number" value={bid} onChange={(e) => setBid(+e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <Field label="Delivery radius (km)">
            <Input type="number" value={radius} onChange={(e) => setRadius(+e.target.value)} />
          </Field>
          <Field label="Target areas (comma separated)">
            <Input value={areas} onChange={(e) => setAreas(e.target.value)} />
          </Field>
          <Field label="Target food category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
