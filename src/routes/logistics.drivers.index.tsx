import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { 
  Star, 
  Plus, 
  Check, 
  X, 
  Ban, 
  ExternalLink, 
  Loader2, 
  ShieldCheck, 
  Mail, 
  Phone, 
  Car, 
  Search, 
  Filter,
  Users,
  UserCheck,
  UserX,
  Clock,
  MapPin,
  ChevronDown
} from "lucide-react";
import { useLiveTable } from "@/lib/realtime-hooks";
import { patchRecord } from "@/lib/insforge-crud";
import { syncSubjectStatus } from "@/lib/verification-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AddPartnerModal } from "@/components/admin/AddPartnerModal";

export const Route = createFileRoute("/logistics/drivers/")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Delivery Partners" }] }),
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ city: "all", status: "all", carrier: "all" });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const nameFor = (d: DriverRow) => {
    const u = users.find((x) => x.id === d.user_id);
    return u?.name ?? (u?.email ?? "").split("@")[0] ?? `Driver ${d.id.slice(0, 6)}`;
  };

  const filteredDrivers = useMemo(() => {
    return drivers.filter(d => {
      const name = nameFor(d).toLowerCase();
      const user = users.find(u => u.id === d.user_id);
      const email = (user?.email || "").toLowerCase();
      const phone = (d.phone || "").toLowerCase();
      const matchSearch = name.includes(searchQuery.toLowerCase()) || 
                          email.includes(searchQuery.toLowerCase()) || 
                          phone.includes(searchQuery.toLowerCase()) ||
                          d.id.includes(searchQuery);
      
      return matchSearch;
    });
  }, [drivers, users, searchQuery]);

  const stats = {
    total: drivers.length,
    login: drivers.filter(d => d.online_status).length,
    logout: drivers.filter(d => !d.online_status).length,
    idle: drivers.filter(d => d.online_status && (d.total_deliveries || 0) < 1).length, // Simplified
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Logistics Management</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Delivery Partners</h1>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          <Plus className="h-4 w-4" /> Add Partner
        </button>
      </header>

      {/* Status Summary Chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusChip label="LOGIN" value={stats.login} color="bg-emerald-100 text-emerald-700" icon={UserCheck} />
        <StatusChip label="LOGOUT" value={stats.logout} color="bg-slate-100 text-slate-700" icon={UserX} />
        <StatusChip label="IDLE" value={stats.idle} color="bg-amber-100 text-amber-700" icon={Clock} />
        <StatusChip label="TOTAL" value={stats.total} color="bg-primary/10 text-primary" icon={Users} />
      </div>

      <section className="rounded-[2.5rem] bg-card p-6 shadow-card ring-1 ring-border/60">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, Name, Phone, License..."
              className="w-full h-11 rounded-xl bg-muted/40 pl-10 pr-4 text-xs font-bold outline-none ring-1 ring-border/40 focus:ring-primary/40"
            />
          </div>
          <div className="flex gap-2">
            <FilterButton label="City" />
            <FilterButton label="Carrier" />
            <FilterButton label="Locality" />
            <div className="bg-primary/10 text-primary px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-1">
              <Users className="h-3 w-3" /> {filteredDrivers.length}
            </div>
          </div>
        </div>

        <DataTable
          columns={["Partner Details", "Status & Mode", "Identity", "Rating", "Performance", "Actions"]}
          rows={filteredDrivers.map((d) => {
            const name = nameFor(d);
            const user = users.find(u => u.id === d.user_id);
            return [
              <div key={d.id+"d"} className="flex items-center gap-3 py-1">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-black text-xs">
                  {name[0]}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">ID: {d.id.slice(0, 8)}</span>
                </div>
              </div>,
              <div key={d.id+"s"} className="flex flex-col gap-1">
                <StatusBadge label={d.verification_status || (d.online_status ? "LOGIN" : "LOGOUT")} />
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" /> Locality: Default
                </span>
              </div>,
              <div key={d.id+"i"} className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1 font-bold text-foreground">
                  <Phone className="h-2.5 w-2.5 text-primary" /> {d.phone || "—"}
                </div>
                <div className="flex items-center gap-1 truncate max-w-[120px]">
                  <Mail className="h-2.5 w-2.5" /> {user?.email || "—"}
                </div>
              </div>,
              <div key={d.id+"r"} className="flex flex-col items-center">
                <span className="flex items-center gap-1 font-black text-sm">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {Number(d.rating ?? 0).toFixed(1)}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">Rating</span>
              </div>,
              <div key={d.id+"p"} className="flex flex-col">
                <span className="text-xs font-black">{d.total_deliveries ?? 0}</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Deliveries</span>
              </div>,
              <div key={d.id+"a"} className="flex items-center gap-1.5">
                <Link 
                  to="/logistics/drivers/$driverId" 
                  params={{ driverId: d.id }} 
                  className="flex h-8 px-3 items-center gap-1.5 rounded-xl bg-primary text-white text-[10px] font-black transition active:scale-95 shadow-glow"
                >
                  <ExternalLink className="h-3 w-3" /> View Profile
                </Link>
              </div>,
            ];
          })}
        />
      </section>

      <AddPartnerModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          // LiveTable will pick it up automatically, but we can toast for confirmation
          toast.success("Partner list refreshed");
        }}
      />
    </div>
  );
}

function StatusChip({ label, value, color, icon: Icon }: any) {
  return (
    <div className={cn("flex items-center justify-between p-4 rounded-3xl shadow-soft ring-1 ring-border/40 bg-card", "")}>
      <div className="flex flex-col">
        <span className="text-[10px] font-black tracking-widest text-muted-foreground">{label}</span>
        <span className="text-xl font-black">{value}</span>
      </div>
      <div className={cn("p-2 rounded-xl", color)}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

function FilterButton({ label }: { label: string }) {
  return (
    <button className="h-10 px-4 rounded-xl bg-muted/50 ring-1 ring-border/60 flex items-center gap-2 text-[10px] font-black hover:bg-muted transition">
      {label} <ChevronDown className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}
