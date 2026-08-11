import { createFileRoute } from "@tanstack/react-router";
import { Settings, Shield, Bell, User, Map, Save } from "lucide-react";

export const Route = createFileRoute("/logistics/settings")({
  component: LogisticsSettings,
});

function LogisticsSettings() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">Operational Settings</h1>
        <p className="text-sm text-muted-foreground">Configure global logistics parameters and staff permissions.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center ring-1 ring-sky-100">
                <Map className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-extrabold">Dispatch Parameters</h3>
            </div>
            
            <div className="space-y-4">
              <SettingItem 
                label="Auto-Assignment Timeout" 
                description="Time before an order escalates to manual dispatch."
                value="300s"
              />
              <SettingItem 
                label="Max Orders Per Rider" 
                description="Upper limit for simultaneous batching."
                value="3"
              />
              <SettingItem 
                label="Pickup Radius Limit" 
                description="Default search radius for available riders."
                value="5.0 km"
              />
            </div>
            
            <button className="mt-8 flex items-center gap-2 rounded-2xl bg-primary px-8 py-3 text-sm font-bold text-white shadow-glow">
              <Save className="h-4 w-4" /> Save Configuration
            </button>
          </section>

          <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center ring-1 ring-amber-100">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-extrabold">Staff Roles & Permissions</h3>
            </div>
            <p className="text-sm text-muted-foreground italic">Coming soon: Granular RBAC for Dispatchers and Zone Managers.</p>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <h3 className="font-bold text-sm mb-4">Quick Links</h3>
            <div className="space-y-2">
              <QuickLink icon={User} label="Profile Settings" />
              <QuickLink icon={Bell} label="Notification Hub" />
              <QuickLink icon={Shield} label="Security Logs" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SettingItem({ label, description, value }: any) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border/40 last:border-0">
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <input 
        defaultValue={value} 
        className="w-24 text-right bg-muted/50 rounded-xl px-3 py-2 text-sm font-bold outline-none ring-1 ring-border/60" 
      />
    </div>
  );
}

function QuickLink({ icon: Icon, label }: any) {
  return (
    <button className="flex w-full items-center gap-3 rounded-2xl p-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition">
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
