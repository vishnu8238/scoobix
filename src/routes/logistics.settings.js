import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, Bell, Globe, CreditCard, Users, LifeBuoy, Save } from "lucide-react";
import { useCms } from "@/lib/cms-store";
import { toast } from "sonner";
export const Route = createFileRoute("/logistics/settings")({
    head: () => ({ meta: [{ title: "Scoobix Logistics · Settings" }] }),
    component: LogisticsSettings,
});
function LogisticsSettings() {
    const { settings, updateSettings } = useCms();
    const [maintenance, setMaintenance] = useState(false);
    const [notifs, setNotifs] = useState(true);
    const [auto, setAuto] = useState(true);
    const [draft, setDraft] = useState(settings);
    const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
    const save = () => {
        updateSettings(draft);
        toast.success("Platform settings saved");
    };
    return (<div className="space-y-6">
      <header>
        <p className="eyebrow">Settings</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Platform settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operating preferences for the Scoobix network.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card icon={CreditCard} title="Order economics">
          <NumberField label="Delivery fee (₹)" value={draft.deliveryFee} onChange={(v) => setDraft({ ...draft, deliveryFee: v })}/>
          <NumberField label="Tax %" value={draft.taxPct} step={0.5} onChange={(v) => setDraft({ ...draft, taxPct: v })}/>
          <NumberField label="Minimum order value (₹)" value={draft.minOrder} onChange={(v) => setDraft({ ...draft, minOrder: v })}/>
          <NumberField label="Free delivery above (₹)" value={draft.freeDeliveryMin} onChange={(v) => setDraft({ ...draft, freeDeliveryMin: v })}/>
          <NumberField label="Driver commission %" value={draft.driverCommissionPct} step={0.5} onChange={(v) => setDraft({ ...draft, driverCommissionPct: v })}/>
          <Toggle label="Petpooja POS sync" desc="Mirror menu & order events to Petpooja (stub)" value={draft.posEnabled} onChange={(v) => setDraft({ ...draft, posEnabled: v })}/>
          <div className="rounded-2xl bg-muted/40 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Delivery slabs (₹ by km)</p>
            <div className="space-y-2">
              {draft.deliverySlabs.map((slab, i) => (<div key={i} className="flex items-center gap-2">
                  <input type="number" value={slab.uptoKm} onChange={(e) => {
                const next = [...draft.deliverySlabs];
                next[i] = { ...slab, uptoKm: Number(e.target.value) };
                setDraft({ ...draft, deliverySlabs: next });
            }} className="w-20 rounded-xl bg-background px-2 py-1.5 text-right text-xs font-bold outline-none ring-1 ring-border/60"/>
                  <span className="text-[11px] text-muted-foreground">km →</span>
                  <input type="number" value={slab.fee} onChange={(e) => {
                const next = [...draft.deliverySlabs];
                next[i] = { ...slab, fee: Number(e.target.value) };
                setDraft({ ...draft, deliverySlabs: next });
            }} className="w-20 rounded-xl bg-background px-2 py-1.5 text-right text-xs font-bold outline-none ring-1 ring-border/60"/>
                  <span className="text-[11px] text-muted-foreground">₹</span>
                  <button onClick={() => setDraft({ ...draft, deliverySlabs: draft.deliverySlabs.filter((_, j) => j !== i) })} className="ml-auto text-[11px] font-bold text-destructive">Remove</button>
                </div>))}
              <button onClick={() => setDraft({ ...draft, deliverySlabs: [...draft.deliverySlabs, { uptoKm: 15, fee: 100 }] })} className="w-full rounded-xl border border-dashed border-border py-2 text-[11px] font-bold text-muted-foreground">+ Add slab</button>
            </div>
          </div>
        </Card>

        <Card icon={LifeBuoy} title="Support contact">
          <TextField label="Support phone" value={draft.supportPhone} onChange={(v) => setDraft({ ...draft, supportPhone: v })}/>

          <TextField label="Support email" value={draft.supportEmail} onChange={(v) => setDraft({ ...draft, supportEmail: v })}/>
          <button disabled={!dirty} onClick={save} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-40">
            <Save className="h-4 w-4"/> Save platform settings
          </button>
        </Card>

        <Card icon={Globe} title="General">
          <Row label="Platform name" value="Scoobix"/>
          <Row label="Default region" value="India"/>
          <Row label="Currency" value="INR"/>
          <Toggle label="Maintenance mode" desc="Disable new orders across all apps" value={maintenance} onChange={setMaintenance}/>
        </Card>

        <Card icon={Bell} title="Notifications">
          <Toggle label="Daily ops digest" desc="Sent to operators each morning" value={notifs} onChange={setNotifs}/>
          <Toggle label="Auto-approve restaurants" desc="Skip manual review for high-trust accounts" value={auto} onChange={setAuto}/>
          <Row label="Escalation channel" value="#ops-incidents"/>
        </Card>

        <Card icon={Shield} title="Security">
          <Row label="2FA for operators" value="Required"/>
          <Row label="Session timeout" value="30 minutes"/>
          <Row label="Audit log retention" value="365 days"/>
        </Card>

        <Card icon={Users} title="Team">
          <ul className="space-y-3">
            {[
            { name: "Anika Devi", role: "Owner" },
            { name: "Marcus Hall", role: "Operations Lead" },
            { name: "Priya Shah", role: "Support Manager" },
        ].map((m) => (<li key={m.name} className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
                <div>
                  <p className="text-sm font-bold">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">{m.role}</p>
                </div>
                <button className="text-[11px] font-bold text-primary">Manage</button>
              </li>))}
          </ul>
        </Card>
      </div>
    </div>);
}
function Card({ icon: Icon, title, children }) {
    return (<section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5"/>
        </div>
        <h2 className="font-display text-lg font-extrabold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>);
}
function Row({ label, value }) {
    return (<div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>);
}
function NumberField({ label, value, step = 1, onChange }) {
    return (<label className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-28 rounded-xl bg-background px-3 py-1.5 text-right text-sm font-bold outline-none ring-1 ring-border/60 focus:ring-2 focus:ring-primary/40 tabular-nums"/>
    </label>);
}
function TextField({ label, value, onChange }) {
    return (<label className="block rounded-2xl bg-muted/40 px-4 py-3">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-transparent text-sm font-bold outline-none"/>
    </label>);
}
function Toggle({ label, desc, value, onChange }) {
    return (<div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <button onClick={() => onChange(!value)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? "bg-primary" : "bg-zinc-300"}`}>
        <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : ""}`}/>
      </button>
    </div>);
}
