import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { listTable, patchRecord } from "@/lib/insforge-crud";
import { DataTable } from "@/components/cravio/AdminTable";
import { Gift, Target, DollarSign, BarChart3 } from "lucide-react";
import type { RewardCampaignRow } from "@/lib/loyalty-engine";

export const Route = createFileRoute("/logistics/scratch-cards")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Scratch Cards" }] }),
  component: LogisticsScratchCards,
});

function LogisticsScratchCards() {
  const [campaigns, setCampaigns] = useState<RewardCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTable<RewardCampaignRow>("reward_campaigns", { order: "-created_at" });
      setCampaigns(data);
    } catch {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggleCampaign = async (campaign: RewardCampaignRow) => {
    try {
      await patchRecord("reward_campaigns", campaign.id, { active: !campaign.active });
      toast.success(`Campaign ${!campaign.active ? "enabled" : "disabled"}`);
      void refresh();
    } catch {
      toast.error("Failed to update campaign status");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Scratch Card Campaigns</h1>
        <p className="text-muted-foreground text-sm">Monitor loyalty scratch-card distribution.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Total Campaigns" value={campaigns.length} icon={BarChart3} />
        <KPI label="Active" value={campaigns.filter(c => c.active).length} icon={Target} tone="primary" />
        <KPI label="Total Budget" value={`₹${campaigns.reduce((acc, c) => acc + (c.budget || 0), 0)}`} icon={DollarSign} tone="emerald" />
        <KPI label="Total Issued" value={campaigns.reduce((acc, c) => acc + (c.issued_count || 0), 0)} icon={Gift} tone="amber" />
      </section>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["Name", "Reward", "Budget", "Spent", "Issued", "Status"]}
          rows={campaigns.map(c => [
            <div key={c.id} className="flex flex-col text-left">
              <span className="font-bold">{c.name}</span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{c.type}</span>
            </div>,
            <div key={c.id + "r"} className="flex flex-col text-left">
              <span className="text-sm font-medium">{c.reward_kind}</span>
              <span className="text-[10px] text-muted-foreground">Range: ₹{c.reward_min} - ₹{c.reward_max}</span>
            </div>,
            `₹${c.budget}`,
            `₹${c.spent || 0}`,
            c.issued_count || 0,
            <button 
              key={c.id + "s"}
              onClick={() => toggleCampaign(c)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider transition ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
            >
              {c.active ? "Active" : "Disabled"}
            </button>
          ])}
        />
      </section>
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
