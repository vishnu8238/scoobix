import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { adminDrivers } from "@/lib/role-data";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Star, Plus, Check, X, Ban } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/drivers")({
  head: () => ({ meta: [{ title: "Cravio Admin · Drivers" }] }),
  component: AdminDrivers,
});

function AdminDrivers() {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const set = (id: string, label: string, msg: string) => {
    setOverrides((p) => ({ ...p, [id]: label }));
    toast.success(msg);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Drivers</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Delivery partners</h1>
        </div>
        <button className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
          <Plus className="h-4 w-4" /> Add driver
        </button>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["ID", "Name", "Vehicle", "Rating", "Deliveries", "Status", "Actions"]}
          rows={adminDrivers.map((d) => {
            const status = overrides[d.id] ?? d.status;
            return [
              <span key={d.id+"id"} className="font-bold text-primary">{d.id}</span>,
              <span key={d.id+"n"} className="font-bold">{d.name}</span>,
              <span key={d.id+"v"} className="text-muted-foreground">{d.vehicle}</span>,
              <span key={d.id+"r"} className="flex items-center gap-1 font-bold"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {d.rating.toFixed(2)}</span>,
              d.deliveries,
              <StatusBadge key={d.id+"s"} label={status} />,
              <div key={d.id+"a"} className="flex items-center gap-1.5">
                <Act tone="primary" icon={Check} label="Approve" onClick={() => set(d.id, "Active",    `${d.name} approved`)} />
                <Act tone="warn"    icon={Ban}   label="Suspend" onClick={() => set(d.id, "Suspended", `${d.name} suspended`)} />
                <Act tone="danger"  icon={X}     label="Reject"  onClick={() => set(d.id, "Rejected",  `${d.name} rejected`)} />
              </div>,
            ];
          })}
        />
      </section>
    </div>
  );
}

function Act({ icon: Icon, label, onClick, tone }: { icon: typeof Check; label: string; onClick: () => void; tone: "primary" | "warn" | "danger" }) {
  const cls = tone === "primary" ? "bg-primary-soft text-primary"
    : tone === "warn" ? "bg-amber-100 text-amber-700"
    : "bg-rose-100 text-rose-700";
  return (
    <button onClick={onClick} title={label} className={`grid h-7 w-7 place-items-center rounded-full transition active:scale-90 ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
