import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Star, Plus, Check, X, Ban, ExternalLink, Loader2, AlertCircle, ShieldCheck, Mail, Phone, Car } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useLiveTable } from "@/lib/realtime-hooks";
import { patchRecord } from "@/lib/insforge-crud";
import { syncSubjectStatus } from "@/lib/verification-api";
import { toast } from "sonner";

export const Route = createFileRoute("/logistics/drivers")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Drivers" }] }),
  component: LogisticsDrivers,
});

type DriverRow = {
  id: string;
  user_id?: string | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  rating?: number | null;
  total_deliveries?: number | null;
  online_status?: boolean | null;
  verification_status?: string | null;
  docs_verified?: boolean | null;
  phone?: string | null;
};
type UserRow = { id: string; name?: string | null; email?: string | null };

function LogisticsDrivers() {
  const { rows: drivers } = useLiveTable<DriverRow>("drivers", { params: { limit: 300 }, minMs: 10000, maxMs: 60000 });
  const { rows: users } = useLiveTable<UserRow>("users", { params: { limit: 500 }, minMs: 30000, maxMs: 120000 });
  const [busy, setBusy] = useState<string | null>(null);

  const nameFor = (d: DriverRow) => {
    const u = users.find((x) => x.id === d.user_id);
    return u?.name ?? (u?.email ?? "").split("@")[0] ?? `Driver ${d.id.slice(0, 6)}`;
  };

  const set = async (id: string, label: string, msg: string) => {
    setBusy(id);
    const ok = await patchRecord("drivers", id, { 
      verification_status: label.toLowerCase(),
      docs_verified: label.toLowerCase() === "active"
    });
    if (ok) {
      await syncSubjectStatus("rider", id).catch(() => null);
      toast.success(msg);
    }
    setBusy(null);
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
          columns={["ID", "Name", "Contact", "Vehicle", "Rating", "Deliveries", "Status", "Actions"]}
          rows={drivers.map((d) => {
            const name = nameFor(d);
            const user = users.find(u => u.id === d.user_id);
            const status = d.verification_status || (d.online_status ? "Online" : "Offline");
            return [
              <div key={d.id+"id"} className="flex items-center gap-2">
                <span className="font-bold text-primary">{d.id.slice(0, 8)}</span>
                {d.docs_verified && <ShieldCheck className="h-3 w-3 text-emerald-500" />}
              </div>,
              <span key={d.id+"n"} className="font-bold">{name}</span>,
              <div key={d.id+"c"} className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {user?.email || "—"}</div>
                <div className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {d.phone || "—"}</div>
              </div>,
              <div key={d.id+"v"} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                  <Car className="h-3 w-3 text-primary" /> {d.vehicle_type || "No vehicle"}
                </div>
                {d.vehicle_number && <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{d.vehicle_number}</div>}
              </div>,
              <span key={d.id+"r"} className="flex items-center gap-1 font-bold"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {Number(d.rating ?? 0).toFixed(2)}</span>,
              d.total_deliveries ?? 0,
              <StatusBadge key={d.id+"s"} label={status} />,
              <div key={d.id+"a"} className="flex items-center gap-1.5">
                {busy === d.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Act tone="primary" icon={Check} label="Approve" onClick={() => set(d.id, "Active",    `${name} approved`)} />
                    <Act tone="warn"    icon={Ban}   label="Suspend" onClick={() => set(d.id, "Suspended", `${name} suspended`)} />
                    <Act tone="danger"  icon={X}     label="Reject"  onClick={() => set(d.id, "Rejected",  `${name} rejected`)} />
                  </>
                )}
                <Link to="/logistics/drivers/$driverId" params={{ driverId: d.id }} className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 text-indigo-700 transition active:scale-90" title="Manage Profile">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
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
