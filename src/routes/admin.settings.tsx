import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, Bell, Globe, CreditCard, Users } from "lucide-react";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Cravio Admin · Settings" }] }),
  component: AdminSettings,
});

function AdminSettings() {
  const [maintenance, setMaintenance] = useState(false);
  const [notifs, setNotifs] = useState(true);
  const [auto, setAuto] = useState(true);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Settings</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Platform settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operating preferences for the Cravio network.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card icon={Globe} title="General">
          <Row label="Platform name" value="Cravio" />
          <Row label="Default region" value="India" />
          <Row label="Currency" value="INR" />
          <Toggle label="Maintenance mode" desc="Disable new orders across all apps" value={maintenance} onChange={setMaintenance} />
        </Card>

        <Card icon={Bell} title="Notifications">
          <Toggle label="Daily ops digest" desc="Sent to operators each morning" value={notifs} onChange={setNotifs} />
          <Toggle label="Auto-approve restaurants" desc="Skip manual review for high-trust accounts" value={auto} onChange={setAuto} />
          <Row label="Escalation channel" value="#ops-incidents" />
        </Card>

        <Card icon={CreditCard} title="Payouts">
          <Row label="Payout cadence" value="Weekly · Monday 9 AM" />
          <Row label="Commission" value="18% per order" />
          <Row label="Driver bonus pool" value="₹10,24,000 / week" />
        </Card>

        <Card icon={Shield} title="Security">
          <Row label="2FA for operators" value="Required" />
          <Row label="Session timeout" value="30 minutes" />
          <Row label="Audit log retention" value="365 days" />
        </Card>

        <Card icon={Users} title="Team">
          <ul className="space-y-3">
            {[
              { name: "Anika Devi", role: "Owner" },
              { name: "Marcus Hall", role: "Operations Lead" },
              { name: "Priya Shah", role: "Support Manager" },
            ].map((m) => (
              <li key={m.name} className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
                <div>
                  <p className="text-sm font-bold">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">{m.role}</p>
                </div>
                <button className="text-[11px] font-bold text-primary">Manage</button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-extrabold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <button onClick={() => onChange(!value)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? "bg-primary" : "bg-zinc-300"}`}>
        <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
