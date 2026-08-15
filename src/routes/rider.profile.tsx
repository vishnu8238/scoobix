import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-store";
import { useDriver } from "@/lib/driver-store";
import { getDisplayName } from "@/lib/identity-utils";
import { PageHeader } from "@/components/cravio/PageHeader";
import { User, Shield, Globe, Clock, Volume2, Moon, ChevronRight, LogOut, PlayCircle, Star, Settings, ExternalLink } from "lucide-react";
import { cn } from "@/lib/format";
import { useState, useEffect } from "react";
import { getRiderPreferences, updateRiderPreferences } from "@/lib/rider-api";
import { toast } from "sonner";

export const Route = createFileRoute("/rider/profile")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Profile" }] }),
  component: RiderProfile,
});

function RiderProfile() {
  const { user, logout } = useAuth();
  const { driver, driverId } = useDriver();
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const displayName = getDisplayName(user) || "Rider";

  useEffect(() => {
    if (driverId) {
      getRiderPreferences(driverId).then(data => {
        setPrefs(data || {
          dark_mode: false,
          app_language: 'English',
          audio_language: 'English',
          alert_sound: 'Standard'
        });
        setLoading(false);
      });
    }
  }, [driverId]);

  const updatePref = async (key: string, value: any) => {
    if (!driverId) return;
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    try {
      await updateRiderPreferences(driverId, newPrefs);
      toast.success("Preference saved");
    } catch (err) {
      toast.error("Failed to save preference");
    }
  };

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24 px-5 pt-7">
      <header className="flex flex-col items-center text-center mb-8">
        <div className="relative mb-4">
          <div className="h-24 w-24 rounded-[2.5rem] bg-muted/50 ring-4 ring-primary/10 overflow-hidden shadow-pop flex items-center justify-center">
            {user?.avatar ? (
              <img src={user.avatar} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <User className="h-10 w-10 text-muted-foreground/40" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-glow border-2 border-background">
            <Star className="h-4 w-4 fill-white" />
          </div>
        </div>
        
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{displayName}</h1>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">
          Rider ID: {driverId?.slice(-8).toUpperCase() || "PENDING"}
        </p>
        
        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
            {driver?.online_status ? "Online" : "Offline"}
          </span>
          <span className="rounded-full bg-card px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground ring-1 ring-border/60">
            Gold Member
          </span>
        </div>
      </header>

      {/* Quick Stats / History Links */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <Link to="/rider/history" className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 transition active:scale-95">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest">History</p>
            <p className="text-[10px] text-muted-foreground">Gig & Trip logs</p>
          </div>
        </Link>
        <Link to="/rider/earnings" className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60 transition active:scale-95">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest">Pocket</p>
            <p className="text-[10px] text-muted-foreground">Payout methods</p>
          </div>
        </Link>
      </div>

      {/* Resource Cards */}
      <section className="space-y-3 mb-8">
        <h2 className="px-2 font-display text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Learning & Perks</h2>
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
          <ResourceItem 
            title="Videos for you" 
            icon={PlayCircle} 
            color="bg-indigo-600" 
            count="12 new" 
          />
          <ResourceItem 
            title="Emergency Heroes" 
            icon={Shield} 
            color="bg-rose-500" 
            count="Join now" 
          />
        </div>
      </section>

      {/* Settings Sections */}
      <section className="space-y-6">
        <div className="space-y-3">
          <h2 className="px-2 font-display text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Preferences</h2>
          <div className="rounded-[2rem] bg-card p-2 shadow-soft ring-1 ring-border/60">
            <SettingToggle 
              icon={Moon} 
              label="Dark Theme" 
              active={prefs?.dark_mode} 
              onToggle={() => updatePref('dark_mode', !prefs?.dark_mode)} 
            />
            <SettingSelect 
              icon={Globe} 
              label="App Language" 
              value={prefs?.app_language} 
              onClick={() => updatePref('app_language', prefs?.app_language === 'English' ? 'Hindi' : 'English')}
            />
            <SettingSelect 
              icon={Volume2} 
              label="Alert Sound" 
              value={prefs?.alert_sound} 
              onClick={() => updatePref('alert_sound', prefs?.alert_sound === 'Standard' ? 'Loud' : 'Standard')}
            />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="px-2 font-display text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Support</h2>
          <div className="rounded-[2rem] bg-card p-2 shadow-soft ring-1 ring-border/60">
            <Link to="/rider/support" className="flex items-center justify-between p-4 hover:bg-muted/30 rounded-2xl transition">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-primary" />
                <span className="text-sm font-bold">Help Center</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <a href="https://scoobix.app/terms" target="_blank" className="flex items-center justify-between p-4 hover:bg-muted/30 rounded-2xl transition">
              <div className="flex items-center gap-3">
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-bold">Terms & Conditions</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        <button 
          onClick={() => logout()}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-500/5 py-4 text-sm font-black uppercase tracking-widest text-rose-500 transition active:scale-[0.98] ring-1 ring-rose-500/10"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </section>
    </div>
  );
}

function ResourceItem({ title, icon: Icon, color, count }: any) {
  return (
    <div className={cn("flex min-w-[200px] items-center gap-4 rounded-3xl p-4 text-white shadow-soft", color)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="font-display text-sm font-extrabold tracking-tight">{title}</p>
        <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{count}</span>
      </div>
    </div>
  );
}

function SettingToggle({ icon: Icon, label, active, onToggle }: any) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
        <span className="text-sm font-bold">{label}</span>
      </div>
      <button 
        onClick={onToggle}
        className={cn(
          "h-6 w-11 rounded-full p-1 transition-colors duration-200",
          active ? "bg-primary" : "bg-muted ring-1 ring-border/60"
        )}
      >
        <div className={cn(
          "h-4 w-4 rounded-full bg-white shadow-pop transition-transform duration-200",
          active && "translate-x-5"
        )} />
      </button>
    </div>
  );
}

function SettingSelect({ icon: Icon, label, value, onClick }: any) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between p-4 hover:bg-muted/30 rounded-2xl transition text-left">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
        <span className="text-sm font-bold">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{value}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}
