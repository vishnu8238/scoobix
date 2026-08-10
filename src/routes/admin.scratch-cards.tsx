import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { listTable, createRecord, patchRecord } from "@/lib/insforge-crud";
import { DataTable } from "@/components/cravio/AdminTable";
import { Plus, Edit2, Trash2, Gift, Loader2, Save, X, Calendar, DollarSign, Target, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import type { RewardCampaignRow } from "@/lib/loyalty-engine";

export const Route = createFileRoute("/admin/scratch-cards")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Scratch Cards" }] }),
  component: ScratchCardsPage,
});

function ScratchCardsPage() {
  const [campaigns, setCampaigns] = useState<RewardCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<RewardCampaignRow | null>(null);

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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Scratch Card Campaigns</h1>
          <p className="text-muted-foreground text-sm">Manage loyalty scratch-card distribution and rewards.</p>
        </div>
        <button 
          onClick={() => { setEditingCampaign(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
        >
          <Plus className="h-4 w-4" /> Create Campaign
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Total Campaigns" value={campaigns.length} icon={BarChart3} />
        <KPI label="Active" value={campaigns.filter(c => c.active).length} icon={Target} tone="primary" />
        <KPI label="Total Budget" value={`₹${campaigns.reduce((acc, c) => acc + (c.budget || 0), 0)}`} icon={DollarSign} tone="emerald" />
        <KPI label="Total Issued" value={campaigns.reduce((acc, c) => acc + (c.issued_count || 0), 0)} icon={Gift} tone="amber" />
      </section>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["Name", "Reward", "Budget", "Spent", "Issued", "Status", "Actions"]}
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
            </button>,
            <div key={c.id + "a"} className="flex items-center gap-2">
              <button 
                onClick={() => { setEditingCampaign(c); setIsModalOpen(true); }}
                className="p-1.5 hover:bg-muted rounded-lg"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ])}
        />
      </section>

      {isModalOpen && (
        <CampaignModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={refresh} 
          initialData={editingCampaign}
        />
      )}
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

function CampaignModal({ isOpen, onClose, onSuccess, initialData }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  initialData: RewardCampaignRow | null;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<RewardCampaignRow>>(initialData || {
    name: "",
    type: "scratch",
    active: true,
    reward_kind: "wallet",
    reward_min: 5,
    reward_max: 50,
    budget: 1000,
    usage_limit: 100,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (initialData?.id) {
        await patchRecord("reward_campaigns", initialData.id, formData);
        toast.success("Campaign updated");
      } else {
        await createRecord("reward_campaigns", { ...formData, spent: 0, issued_count: 0 });
        toast.success("Campaign created");
      }
      onSuccess();
      onClose();
    } catch {
      toast.error("Failed to save campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-card shadow-card ring-1 ring-border/60 overflow-hidden">
        <header className="flex items-center justify-between p-6 border-b border-border/60">
          <h2 className="font-display text-xl font-extrabold">{initialData ? "Edit Campaign" : "Create Campaign"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition">
            <X className="h-5 w-5" />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-left">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Campaign Name</label>
              <input 
                required
                value={formData.name || ""}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Campaign Type</label>
              <select 
                value={formData.type || "scratch"}
                onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none appearance-none"
              >
                <option value="scratch">Scratch Card</option>
                <option value="cashback">Order Cashback</option>
                <option value="bonus_points">Bonus Points</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Reward Kind</label>
               <select 
                 value={formData.reward_kind || "wallet"}
                 onChange={e => setFormData(prev => ({ ...prev, reward_kind: e.target.value as any }))}
                 className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none appearance-none"
               >
                 <option value="wallet">Wallet Credits</option>
                 <option value="points">Loyalty Points</option>
                 <option value="coupon">Coupon Code</option>
               </select>
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Min Reward (₹)</label>
               <input 
                 type="number" required
                 value={formData.reward_min || 0}
                 onChange={e => setFormData(prev => ({ ...prev, reward_min: parseInt(e.target.value) }))}
                 className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none"
               />
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Max Reward (₹)</label>
               <input 
                 type="number" required
                 value={formData.reward_max || 0}
                 onChange={e => setFormData(prev => ({ ...prev, reward_max: parseInt(e.target.value) }))}
                 className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none"
               />
             </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Total Budget (₹)</label>
              <input 
                type="number" required
                value={formData.budget || 0}
                onChange={e => setFormData(prev => ({ ...prev, budget: parseInt(e.target.value) }))}
                className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Usage Limit</label>
              <input 
                type="number" required
                value={formData.usage_limit || 0}
                onChange={e => setFormData(prev => ({ ...prev, usage_limit: parseInt(e.target.value) }))}
                className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Starts At</label>
              <input 
                type="datetime-local" required
                value={formData.starts_at ? format(new Date(formData.starts_at), "yyyy-MM-dd'T'HH:mm") : ""}
                onChange={e => setFormData(prev => ({ ...prev, starts_at: new Date(e.target.value).toISOString() }))}
                className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Ends At</label>
              <input 
                type="datetime-local" required
                value={formData.ends_at ? format(new Date(formData.ends_at), "yyyy-MM-dd'T'HH:mm") : ""}
                onChange={e => setFormData(prev => ({ ...prev, ends_at: new Date(e.target.value).toISOString() }))}
                className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none"
              />
            </div>
          </div>
        </form>
        <footer className="p-6 border-t border-border/60 flex justify-end gap-3 bg-muted/20">
          <button onClick={onClose} className="rounded-2xl px-6 py-2.5 text-sm font-bold text-muted-foreground transition hover:bg-muted">Cancel</button>
          <button 
            onClick={handleSubmit} 
            disabled={loading}
            className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {initialData ? "Save Changes" : "Create Campaign"}
          </button>
        </footer>
      </div>
    </div>
  );
}
