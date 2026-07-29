import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { UserPlus, Power, Target, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-store";
import {
  listManagers,
  createManagerAccount,
  updateManager,
  assignRestaurant,
  listUnassignedRestaurants,
  listManagerRestaurants,
  managerStats,
  type MerchantManager,
  type ManagedRestaurant,
} from "@/lib/manager-api";

export const Route = createFileRoute("/admin/managers")({
  head: () => ({
    meta: [
      { title: "Scoobix Admin · Merchant Managers" },
      { name: "description", content: "Create merchant managers, assign restaurants, set targets and review performance." },
    ],
  }),
  component: AdminManagers,
});

function AdminManagers() {
  const { user } = useAuth();
  const [managers, setManagers] = useState<MerchantManager[]>([]);
  const [unassigned, setUnassigned] = useState<ManagedRestaurant[]>([]);
  const [perf, setPerf] = useState<Record<string, ManagedRestaurant[]>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", region: "", target: "10" });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [rows, free] = await Promise.all([listManagers(), listUnassignedRestaurants()]);
    setManagers(rows);
    setUnassigned(free);
    const entries = await Promise.all(
      rows.map(async (m) => [m.id, await listManagerRestaurants(m.id)] as const),
    );
    setPerf(Object.fromEntries(entries));
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setCreating(true);
    const res = await createManagerAccount({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      region: form.region.trim() || undefined,
      monthlyTarget: Number(form.target) || 10,
      createdBy: user?.id,
    });
    setCreating(false);
    if (!res.ok) { toast.error(res.message ?? "Could not create manager"); return; }
    toast.success("Merchant manager created", {
      description: `Login ${form.email} · temporary password ${res.password}`,
      duration: 15000,
    });
    setForm({ name: "", email: "", phone: "", region: "", target: "10" });
    void refresh();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Merchant Managers</h1>
        <p className="text-sm text-muted-foreground">
          Create manager accounts, assign restaurants and track onboarding performance. Managers
          never have access to this admin panel.
        </p>
      </header>

      <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" strokeWidth={2.6} />
          <h2 className="text-sm font-bold">New merchant manager</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Region" value={form.region} onChange={(v) => setForm({ ...form, region: v })} />
          <Field label="Monthly target" value={form.target} onChange={(v) => setForm({ ...form, target: v })} />
        </div>
        <Button
          className="mt-4 h-11 rounded-full gradient-primary px-6 text-sm font-bold text-primary-foreground shadow-glow"
          disabled={creating}
          onClick={() => void create()}
        >
          Create account
        </Button>
      </section>

      {loading && <div className="h-32 animate-pulse rounded-3xl bg-muted/60" />}

      <div className="space-y-4">
        {managers.map((m) => {
          const list = perf[m.id] ?? [];
          const stats = managerStats(list, m.monthly_target ?? 10);
          const active = m.status === "active";
          return (
            <section key={m.id} className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-extrabold">{m.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {m.email}{m.region ? ` · ${m.region}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`}
                >
                  {active ? "Active" : "Deactivated"}
                </span>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={async () => {
                    await updateManager(m.id, { status: active ? "inactive" : "active" });
                    toast.success(active ? "Manager deactivated" : "Manager activated");
                    void refresh();
                  }}
                >
                  <Power className="mr-1.5 h-4 w-4" /> {active ? "Deactivate" : "Activate"}
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                <Metric label="Onboarded" value={stats.onboarded} />
                <Metric label="Live" value={stats.live} />
                <Metric label="Pending" value={stats.pending} />
                <Metric label="Drafts" value={stats.drafts} />
                <Metric label="This month" value={`${stats.thisMonth}/${stats.target}`} />
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Target className="mr-1 inline h-3.5 w-3.5" /> Monthly target
                  </Label>
                  <Input
                    type="number"
                    defaultValue={m.monthly_target ?? 10}
                    className="mt-1.5 h-11 rounded-2xl bg-secondary/50"
                    onBlur={async (e) => {
                      const value = Number(e.target.value) || 0;
                      if (value === (m.monthly_target ?? 10)) return;
                      await updateManager(m.id, { monthly_target: value });
                      toast.success("Target updated");
                      void refresh();
                    }}
                  />
                </div>
                <div className="min-w-[220px] flex-1">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Store className="mr-1 inline h-3.5 w-3.5" /> Assign a restaurant
                  </Label>
                  <select
                    className="mt-1.5 h-11 w-full rounded-2xl bg-secondary/50 px-3 text-sm outline-none ring-1 ring-border/60"
                    value=""
                    onChange={async (e) => {
                      if (!e.target.value) return;
                      await assignRestaurant(e.target.value, m.id);
                      toast.success("Restaurant assigned");
                      void refresh();
                    }}
                  >
                    <option value="">Select an unassigned restaurant…</option>
                    {unassigned.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name ?? "Untitled"} {r.rst_code ? `· ${r.rst_code}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {list.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {list.map((r) => (
                    <button
                      key={r.id}
                      onClick={async () => {
                        await assignRestaurant(r.id, null);
                        toast.success("Restaurant unassigned");
                        void refresh();
                      }}
                      className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold text-muted-foreground"
                      title="Click to unassign"
                    >
                      {r.name ?? "Untitled"} ✕
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-11 rounded-2xl bg-secondary/50" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-secondary/40 p-3 text-center">
      <p className="font-display text-xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
