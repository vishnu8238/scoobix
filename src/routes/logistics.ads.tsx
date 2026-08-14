import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Megaphone, Plus, Loader2, Trash2, Edit2, Play, Pause, ExternalLink } from "lucide-react";
import { fetchAds, createAd, updateAd, deleteAd, type Ad } from "@/lib/ads-api";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { toast } from "sonner";
import { useTableVersion } from "@/lib/realtime-hooks";

export const Route = createFileRoute("/logistics/ads")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Ad Management" }] }),
  component: LogisticsAds,
});

function LogisticsAds() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const version = useTableVersion(["cms_ads"]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAds();
    setAds(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, version]);

  const toggleStatus = async (ad: Ad) => {
    const ok = await updateAd(ad.id, { active: !ad.active });
    if (ok) {
      toast.success(`Ad ${!ad.active ? "activated" : "paused"}`);
      void load();
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Are you sure you want to delete this ad?")) return;
    await deleteAd(id);
    toast.success("Ad deleted");
    void load();
  };

  return (
    <div className="space-y-6 text-left">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <Megaphone className="h-6 w-6 text-primary" /> Ad Management
          </h1>
          <p className="text-sm text-muted-foreground">Manage promotional banners and placements.</p>
        </div>
        <button className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
          <Plus className="h-4 w-4" /> New Ad
        </button>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : ads.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No ads configured.</p>
        ) : (
          <DataTable 
            columns={["Banner", "Title", "Placement", "Audience", "Priority", "Status", "Actions"]}
            rows={ads.map(ad => [
              <div key={ad.id+"img"} className="h-10 w-20 overflow-hidden rounded-lg bg-muted">
                {ad.image_url ? <img src={ad.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Megaphone className="h-4 w-4 opacity-20" /></div>}
              </div>,
              <div key={ad.id+"t"} className="flex flex-col">
                <span className="font-bold">{ad.title}</span>
                {ad.link_url && <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{ad.link_url}</span>}
              </div>,
              <span key={ad.id+"p"} className="text-[10px] font-bold uppercase text-muted-foreground">{ad.placement.replace("_", " ")}</span>,
              <span key={ad.id+"a"} className="text-[10px] font-bold uppercase text-muted-foreground">{ad.target_audience}</span>,
              <span key={ad.id+"pr"} className="font-mono font-bold">{ad.priority}</span>,
              <StatusBadge key={ad.id+"s"} label={ad.active ? "active" : "paused"} />,
              <div key={ad.id+"act"} className="flex gap-1.5">
                <button onClick={() => toggleStatus(ad)} className={`p-1.5 rounded-full transition active:scale-90 ${ad.active ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`} title={ad.active ? "Pause" : "Activate"}>
                  {ad.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => handleRemove(ad.id)} className="p-1.5 rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition active:scale-90">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ])}
          />
        )}
      </section>
    </div>
  );
}
