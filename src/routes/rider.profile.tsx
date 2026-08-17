import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-store";
import { useDriver } from "@/lib/driver-store";
import { getDisplayName } from "@/lib/identity-utils";
import { User, Shield, Globe, Clock, Volume2, Moon, ChevronRight, LogOut, PlayCircle, Star, Settings, ExternalLink, X, Check } from "lucide-react";
import { cn } from "@/lib/format";
import { useState, useEffect } from "react";
import { getRiderPreferences, updateRiderPreferences } from "@/lib/rider-api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/rider/profile")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Profile" }] }),
  component: RiderProfile,
});

function RiderProfile() {
  const { user, logout } = useAuth();
  const { driver, driverId } = useDriver();
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showAlertPicker, setShowAlertPicker] = useState(false);

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
    <div className="w-full pb-8 px-4 pt-7">
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
            {driver?.is_online ? "Online" : "Offline"}
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
              onClick={() => setShowLanguagePicker(true)}
            />
            <SettingSelect 
              icon={Volume2} 
              label="Alert Sound" 
              value={prefs?.alert_sound} 
              onClick={() => setShowAlertPicker(true)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="px-2 font-display text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Support</h2>
          <div className="rounded-[2rem] bg-card p-2 shadow-soft ring-1 ring-border/60">
            <Link to="/rider/support" className="flex items-center justify-between p-4 hover:bg-muted/30 rounded-2xl transition">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-primary" />
                <span className="text-sm font-bold">Help Center</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <a href="https://scoobix.app/terms" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-muted/30 rounded-2xl transition">
              <div className="flex items-center gap-3">
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-bold">Terms & Conditions</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </a>
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

      {/* Preference Pickers */}
      <AnimatePresence>
        {showLanguagePicker && (
          <SelectionSheet 
            title="App Language"
            onClose={() => setShowLanguagePicker(false)}
            options={[
              { label: 'English', value: 'English' },
              { label: 'Hindi', value: 'Hindi' },
              { label: 'Arabic', value: 'Arabic' },
              { label: 'Spanish', value: 'Spanish' },
            ]}
            currentValue={prefs?.app_language}
            onSelect={(val: string) => {
              updatePref('app_language', val);
              setShowLanguagePicker(false);
            }}
          />
        )}
        {showAlertPicker && (
          <SelectionSheet 
            title="Alert Sound"
            onClose={() => setShowAlertPicker(false)}
            options={[
              { label: 'Standard', value: 'Standard' },
              { label: 'Loud & Persistent', value: 'Loud' },
              { label: 'Subtle', value: 'Subtle' },
              { label: 'None (Visual Only)', value: 'None' },
            ]}
            currentValue={prefs?.alert_sound}
            onSelect={(val: string) => {
              updatePref('alert_sound', val);
              setShowAlertPicker(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SelectionSheet({ title, onClose, options, currentValue, onSelect }: any) {
  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[520px] rounded-t-[2.5rem] bg-card p-8 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-float"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-display text-xl font-black italic tracking-tight">{title}</h3>
          <button onClick={onClose} className="rounded-full bg-muted p-2 text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-2">
          {options.map((opt: any) => (
            <button 
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl p-4 transition active:scale-[0.98]",
                currentValue === opt.value ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/50"
              )}
            >
              <span className={cn("text-sm font-bold", currentValue === opt.value ? "text-primary" : "text-foreground")}>
                {opt.label}
              </span>
              {currentValue === opt.value && <Check className="h-5 w-5 text-primary" />}
            </button>
          ))}
        </div>
      </motion.div>
    </>
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