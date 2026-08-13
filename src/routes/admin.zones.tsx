import { createFileRoute } from "@tanstack/react-router";
import { ZoneManager } from "@/components/admin/ZoneManager";

export const Route = createFileRoute("/admin/zones")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Delivery Zones" }] }),
  component: ZonesPage,
});

function ZonesPage() {
  return (
    <div className="space-y-6">
      <ZoneManager />
    </div>
  );
}


function ZoneDetailView({ zone, subzones, onBack }: { zone: DeliveryZone; subzones: Subzone[]; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "riders" | "restaurants" | "orders" | "subzones" | "settings" | "audit">("overview");

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft ring-1 ring-border/60 transition active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold">{zone.name}</h1>
            <StatusBadge label={zone.status} />
          </div>
          <p className="text-sm text-muted-foreground">{zone.city} · {subzones.length} Subzones</p>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-border/60 overflow-x-auto no-scrollbar">
        {[
          { id: "overview", label: "Overview", icon: Layers },
          { id: "subzones", label: "Subzones", icon: MapIcon },
          { id: "riders", label: "Riders", icon: Bike },
          { id: "restaurants", label: "Restaurants", icon: Store },
          { id: "orders", label: "Live Orders", icon: ClipboardList },
          { id: "settings", label: "Settings", icon: Settings },
          { id: "audit", label: "Audit Log", icon: History },
        ].map(t => (
          <button 
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
           {activeTab === "overview" && (
             <div className="space-y-6">
                <section className="h-[400px] rounded-3xl overflow-hidden shadow-card ring-1 ring-border/60 bg-muted">
                  <GoogleMap 
                    className="h-full w-full"
                    polygons={[
                      {
                        id: zone.id,
                        points: zone.boundary?.coordinates?.[0]?.map((c: any) => ({ lat: c[1], lng: c[0] })) || [],
                        label: zone.name,
                        color: "var(--color-primary)"
                      },
                      ...subzones.map(s => ({
                        id: s.id,
                        points: s.boundary?.coordinates?.[0]?.map((c: any) => ({ lat: c[1], lng: c[0] })) || [],
                        label: s.name,
                        color: "rgba(0,0,0,0.1)"
                      }))
                    ]}
                  />
                </section>
                
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KPI label="Total Riders" value={0} icon={Users} />
                  <KPI label="Active Orders" value={0} icon={ClipboardList} tone="primary" />
                  <KPI label="Restaurants" value={0} icon={Store} tone="emerald" />
                  <KPI label="Pending" value={0} icon={Loader2} tone="amber" />
                </div>
             </div>
           )}

           {activeTab === "subzones" && (
             <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
               <div className="mb-6 flex items-center justify-between">
                 <h3 className="font-display text-lg font-extrabold">Subzones in {zone.name}</h3>
                 <button className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                   <Plus className="h-3.5 w-3.5" /> Add Subzone
                 </button>
               </div>
               <DataTable 
                 columns={["Subzone", "Status", "Actions"]}
                 rows={subzones.map(s => [
                   <span key={s.id} className="font-bold">{s.name}</span>,
                   <StatusBadge key={s.id + "-status"} label={s.status} />,
                   <div key={s.id + "-actions"} className="flex gap-2">
                     <Edit2 className="h-3.5 w-3.5 cursor-pointer" />
                     <Trash2 className="h-3.5 w-3.5 text-rose-500 cursor-pointer" />
                   </div>
                 ])}
               />
             </section>
           )}
        </div>
        
        <aside className="space-y-6">
          <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <h3 className="font-display text-lg font-extrabold">Zone Activity</h3>
            <div className="mt-4 flex flex-col items-center justify-center p-8 text-center bg-muted/30 rounded-2xl">
              <History className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-xs font-medium text-muted-foreground">No recent activity logged for this zone.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function KPI({ label, value, icon: Icon, tone = "muted" }: { label: string; value: number | string; icon: any; tone?: string }) {
  const tones: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    zinc: "bg-zinc-100 text-zinc-700",
    muted: "bg-muted text-muted-foreground"
  };
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="font-display text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
