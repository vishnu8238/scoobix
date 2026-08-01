import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-store";
import { useManager, updateManager, useManagerRestaurants, managerStats } from "@/lib/manager-api";
import { SecurityPanel } from "@/components/security/SecurityPanel";

export const Route = createFileRoute("/manager/profile")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · Profile" },
      { name: "description", content: "Your merchant manager profile, region and performance." },
    ],
  }),
  component: ManagerProfile,
});

function ManagerProfile() {
  const { user } = useAuth();
  const { manager, refresh } = useManager();
  const { list } = useManagerRestaurants(manager?.id);
  const stats = managerStats(list, manager?.monthly_target ?? 10);
  const [form, setForm] = useState({ name: "", phone: "", region: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!manager) return;
    setForm({
      name: manager.name ?? "",
      phone: manager.phone ?? "",
      region: manager.region ?? "",
    });
  }, [manager?.id, manager?.name, manager?.phone, manager?.region]);

  const save = async () => {
    if (!manager?.id) return;
    setBusy(true);
    await updateManager(manager.id, { name: form.name, phone: form.phone, region: form.region });
    await refresh();
    setBusy(false);
    toast.success("Profile updated");
  };

  return (
    <div className="mx-auto max-w-[520px] pb-6">
      <PageHeader title="My profile" />
      <div className="px-5 pt-4">
        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Signed in as</p>
          <p className="mt-1 font-display text-lg font-extrabold">{user?.email}</p>
          <p className="text-[12px] text-muted-foreground">Merchant Manager account</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Metric label="Onboarded" value={stats.onboarded} />
          <Metric label="Live" value={stats.live} />
          <Metric label="This month" value={`${stats.thisMonth}/${stats.target}`} />
        </div>

        <div className="mt-4 space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <Row label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Row label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Row label="Region" value={form.region} onChange={(v) => setForm({ ...form, region: v })} />
          <Button
            className="h-11 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow"
            disabled={busy}
            onClick={() => void save()}
          >
            Save changes
          </Button>
        </div>

        <SecurityPanel />
      </div>
    </div>
  );
}


function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl bg-card p-4 text-center shadow-soft ring-1 ring-border/60">
      <p className="font-display text-xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-2xl bg-secondary/50" />
    </div>
  );
}
