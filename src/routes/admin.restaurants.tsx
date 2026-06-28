import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { adminRestaurants } from "@/lib/role-data";
import { formatPrice } from "@/lib/format";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Star, Plus, Percent, Pencil, Save, X, Check, Ban } from "lucide-react";
import { useCms } from "@/lib/cms-store";
import { toast } from "sonner";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { setRestaurantApprovalStatus, setRestaurantCommission, updateRestaurantStatus } from "@/lib/insforge";

export const Route = createFileRoute("/admin/restaurants")({
  head: () => ({ meta: [{ title: "Cravio Admin · Restaurants" }] }),
  component: AdminRestaurants,
});

type RowStatus = "Live" | "Pending" | "Suspended" | "Rejected" | string;

function AdminRestaurants() {
  // Local status overlay — replace with backend mutation later.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, RowStatus>>({});
  const updateStatus = (id: string, next: RowStatus, msg: string, backend: "approved" | "rejected" | "suspended") => {
    void setRestaurantApprovalStatus(id, backend);
    setStatusOverrides((p) => ({ ...p, [id]: next }));
    toast.success(msg);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Restaurants</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Partner restaurants</h1>
        </div>
        <button className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
          <Plus className="h-4 w-4" /> Onboard restaurant
        </button>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["Restaurant", "Cuisine", "Rating", "Orders", "Revenue", "Commission %", "Open", "Status", "Actions"]}
          rows={adminRestaurants.map((r) => {
            const status = statusOverrides[r.id] ?? r.status;
            return [
              <div className="flex items-center gap-3" key={r.id + "name"}>
                <img src={r.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
                <span className="font-bold">{r.name}</span>
              </div>,
              <span key={r.id + "cuisine"} className="text-muted-foreground">{r.cuisine}</span>,
              <span key={r.id + "rating"} className="flex items-center gap-1 font-bold"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {r.rating.toFixed(1)}</span>,
              <span key={r.id + "orders"}>{r.orders}</span>,
              <span key={r.id + "revenue"} className="font-display font-extrabold text-primary">{formatPrice(r.revenue)}</span>,
              <CommissionCell key={r.id + "comm"} id={r.id} />,
              <OpenToggle key={r.id + "open"} id={r.id} />,
              <StatusBadge key={r.id + "status"} label={status} />,
              <div key={r.id + "act"} className="flex items-center gap-1.5">
                <ActionButton tone="primary" icon={Check} label="Approve" onClick={() => updateStatus(r.id, "Live", `${r.name} approved`, "approved")} />
                <ActionButton tone="warn"    icon={Ban}   label="Suspend" onClick={() => updateStatus(r.id, "Suspended", `${r.name} suspended`, "suspended")} />
                <ActionButton tone="danger"  icon={X}     label="Reject"  onClick={() => updateStatus(r.id, "Rejected", `${r.name} rejected`, "rejected")} />

              </div>,
            ];
          })}
        />
      </section>
    </div>
  );
}

function OpenToggle({ id }: { id: string }) {
  const { closedRestaurants, toggleRestaurantClosed } = useCms();
  const closed = !!closedRestaurants[id];
  return (
    <button
      onClick={() => { toggleRestaurantClosed(id); toast.success(closed ? "Restaurant marked open" : "Restaurant marked closed"); }}
      className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider transition active:scale-95 ${closed ? "bg-zinc-200 text-zinc-700" : "bg-primary-soft text-primary"}`}
    >
      {closed ? "Closed" : "Open"}
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone }: { icon: typeof Check; label: string; onClick: () => void; tone: "primary" | "warn" | "danger" }) {
  const cls = tone === "primary" ? "bg-primary-soft text-primary"
    : tone === "warn" ? "bg-amber-100 text-amber-700"
    : "bg-rose-100 text-rose-700";
  return (
    <button onClick={onClick} title={label} className={`grid h-7 w-7 place-items-center rounded-full transition active:scale-90 ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function CommissionCell({ id }: { id: string }) {
  const { commissions, setCommission } = useCms();
  const [open, setOpen] = useState(false);
  const saved = commissions[id] ?? 15;
  const [value, setValue] = useState(String(saved));

  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const previewAmount = 1000;
  const earning = Math.round(previewAmount * (pct / 100));

  const handleSave = () => {
    setCommission(id, pct);
    setOpen(false);
    toast.success(`Commission updated to ${pct}%`);
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setValue(String(saved));
    setOpen(isOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 text-sm transition active:scale-95">
          <span className="font-display font-bold">{saved}%</span>
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 rounded-2xl border-border/60 bg-card p-4 shadow-soft ring-1 ring-border/60" align="center">
        <p className="font-display text-sm font-bold">Edit commission</p>
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 ring-1 ring-border/60 focus-within:bg-background focus-within:ring-primary/40">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-16 bg-transparent font-display text-lg font-extrabold outline-none tabular-nums"
          />
          <Percent className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Order amount</span>
            <span className="font-bold">{formatPrice(previewAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Commission ({pct}%)</span>
            <span className="font-bold">− {formatPrice(earning)}</span>
          </div>
          <div className="mt-2 border-t border-dashed border-border/60 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-primary">Platform earning</span>
              <span className="font-display font-extrabold text-primary">{formatPrice(earning)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-glow transition active:scale-95"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <button
            onClick={() => setOpen(false)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs font-bold text-muted-foreground transition active:scale-95"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
