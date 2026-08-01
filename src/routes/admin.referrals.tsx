import { createFileRoute } from "@tanstack/react-router";
import { Gift, Users } from "lucide-react";
import { useReferral } from "@/lib/scoobix-loyalty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/cravio/EmptyState";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/referrals")({
  head: () => ({ meta: [
    { title: "Scoobix Admin · Referrals" },
    { name: "description", content: "Configure the Scoobix referral campaign and view referral statistics." },
  ] }),
  component: AdminReferrals,
});

function AdminReferrals() {
  const { config, updateConfig, records } = useReferral();
  const [form, setForm] = useState(config);
  useEffect(() => setForm(config), [config]);

  const save = () => { updateConfig(form); toast.success("Referral campaign saved"); };

  const rewarded = records.filter((r) => r.status === "rewarded").length;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-primary" />
        <h1 className="font-display text-lg font-extrabold">Referral program</h1>
      </header>

      <section className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/60">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Campaign enabled</p>
            <p className="text-xs text-muted-foreground">Turn the entire referral program on or off.</p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Referrer reward (₹)" value={form.referrerReward} onChange={(v) => setForm({ ...form, referrerReward: v })} />
          <Field label="Referee reward (₹)"  value={form.refereeReward}  onChange={(v) => setForm({ ...form, refereeReward: v })} />
          <Field label="Minimum order (₹)"   value={form.minOrder}       onChange={(v) => setForm({ ...form, minOrder: v })} />
          <Field label="Reward expiry (days)" value={form.expiryDays}    onChange={(v) => setForm({ ...form, expiryDays: v })} />
        </div>
        <Button onClick={save} className="mt-3 rounded-full">Save campaign</Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total referrals" value={records.length} />
        <Stat label="Rewarded" value={rewarded} />
        <Stat label="Pending" value={records.filter((r) => r.status === "pending").length} />
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/60">
        <h2 className="eyebrow mb-2 flex items-center gap-1"><Users className="h-3 w-3" /> Recent referrals</h2>
        {records.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="No referrals yet" description="Once customers share their code, referrals show up here." />
        ) : (
          <ul className="divide-y divide-border/60">
            {records.slice(0, 40).map((r) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-2 text-xs">
                <span className="truncate">
                  <span className="font-bold">{r.referee_name ?? "Invited user"}</span>
                  <span className="block text-[10px] text-muted-foreground">code {r.referral_code ?? "—"} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  r.status === "rewarded" ? "bg-emerald-100 text-emerald-700"
                  : r.status === "pending" ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
                }`}>{r.status}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{(r.referred_id ?? "").slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs font-semibold">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <Input inputMode="numeric" value={String(value)} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card p-4 text-center shadow-card ring-1 ring-border/60">
      <p className="font-display text-2xl font-extrabold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
