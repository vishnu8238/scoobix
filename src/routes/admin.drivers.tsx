import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Star, Plus, Check, X, Ban } from "lucide-react";
import { useLiveTable } from "@/lib/realtime-hooks";
import { kvGet, kvSet } from "@/lib/kv-store";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/drivers")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Drivers" }] }),
  component: AdminDrivers,
});

type DriverRow = {
  id: string;
  user_id?: string | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  rating?: number | null;
  total_deliveries?: number | null;
  online_status?: boolean | null;
};
type UserRow = { id: string; name?: string | null; email?: string | null };

const STATUS_KEY = "driver_status";

function AdminDrivers() {
  const { rows: drivers } = useLiveTable<DriverRow>("drivers", { params: { limit: 300 }, minMs: 10000, maxMs: 60000 });
  const { rows: users } = useLiveTable<UserRow>("users", { params: { limit: 500 }, minMs: 30000, maxMs: 120000 });
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    void kvGet<Record<string, string>>(STATUS_KEY).then((v) => { if (v) setOverrides(v); });
  }, []);

  const nameFor = (d: DriverRow) => {
    const u = users.find((x) => x.id === d.user_id);
    return u?.name ?? (u?.email ?? "").split("@")[0] ?? `Driver ${d.id.slice(0, 6)}`;
  };

  const set = (id: string, label: string, msg: string) => {
    setOverrides((p) => {
      const next = { ...p, [id]: label };
      void kvSet(STATUS_KEY, next);
      return next;
    });
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
          rows={drivers.map((d) => {
            const name = nameFor(d);
            const status = overrides[d.id] ?? (d.online_status ? "Online" : "Offline");
            return [
              <span key={d.id+"id"} className="font-bold text-primary">{d.id.slice(0, 8)}</span>,
              <span key={d.id+"n"} className="font-bold">{name}</span>,
              <span key={d.id+"v"} className="text-muted-foreground">{d.vehicle_type ?? "—"}{d.vehicle_number ? ` · ${d.vehicle_number}` : ""}</span>,
              <span key={d.id+"r"} className="flex items-center gap-1 font-bold"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {Number(d.rating ?? 0).toFixed(2)}</span>,
              d.total_deliveries ?? 0,
              <StatusBadge key={d.id+"s"} label={status} />,
              <div key={d.id+"a"} className="flex items-center gap-1.5">
                <Act tone="primary" icon={Check} label="Approve" onClick={() => set(d.id, "Active",    `${name} approved`)} />
                <Act tone="warn"    icon={Ban}   label="Suspend" onClick={() => set(d.id, "Suspended", `${name} suspended`)} />
                <Act tone="danger"  icon={X}     label="Reject"  onClick={() => set(d.id, "Rejected",  `${name} rejected`)} />
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
