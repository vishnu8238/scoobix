import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, Inbox, Bike, Wallet, Settings, Bell, HelpCircle, PhoneCall, AlertTriangle, X, ChevronRight, Menu, User, LogOut, Shield, Info, Calendar, ShoppingBag, History } from "lucide-react";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { APPS, appHead } from "@/lib/apps";
import { cn } from "@/lib/format";
import { useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { useDriver } from "@/lib/driver-store";
import { getDisplayName } from "@/lib/identity-utils";
import { toast } from "sonner";
import { logEmergencyEvent } from "@/lib/rider-api";

export const Route = createFileRoute("/rider")({
  head: () => appHead(APPS.rider),
  component: RiderLayout,
});

const NAV = [
  { to: "/rider", label: "Home", icon: Home, exact: true },
  { to: "/rider/history", label: "History", icon: History },
  { to: "/rider/earnings", label: "Pocket", icon: Wallet },
  { to: "/rider/requests", label: "Gigs", icon: Calendar },
  { to: "/rider/bazaar", label: "Bazaar", icon: ShoppingBag },
];

function RiderLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { driver } = useDriver();
  const [showSOS, setShowSOS] = useState(false);
  const [showUpdate, setShowUpdate] = useState(true); // Example banner

  const displayName = getDisplayName(user) || "Rider";

  const handleSOS = async (type: string) => {
    if (!driver?.id) return;
    
    const confirmed = window.confirm(`Confirm emergency call to ${type}?`);
    if (!confirmed) return;

    try {
      // Get current location if possible
      let lat, lng;
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        ).catch(() => null);
        if (pos) {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      }

      await logEmergencyEvent(driver.id, type, { lat, lng });
      toast.success(`${type} reported. Help is on the way.`);
      setShowSOS(false);
      
      // Initiate call
      if (type === "Ambulance") window.location.href = "tel:108";
      if (type === "Police") window.location.href = "tel:100";
    } catch (err) {
      toast.error("Failed to log emergency event, but you can still call.");
    }
  };

  return (
    <RoleGuard allow="rider" transitionLabel="Accessing Rider Portal...">
      <div className="relative min-h-svh bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-64">
        
        {/* Desktop Sidebar */}
        <aside className="fixed left-0 top-0 hidden h-full w-64 border-r border-border/60 bg-card p-6 md:block">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
              <Bike className="h-6 w-6" />
            </div>
            <span className="font-display text-xl font-black italic tracking-tight text-primary">SCOOBIX</span>
          </div>

          <nav className="mt-10 space-y-1">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition",
                    active ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <n.icon className="h-5 w-5" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-6 left-6 right-6">
            <button 
              onClick={() => logout()}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-rose-500 transition hover:bg-rose-50"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Header (Mobile & Desktop) */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/40 bg-background/80 px-5 backdrop-blur-md">
          <div className="flex items-center gap-3 md:hidden">
             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bike className="h-5 w-5" />
             </div>
             <span className="font-display font-black italic tracking-tight text-primary">SCOOBIX</span>
          </div>
          
          <div className="hidden md:block">
            <h2 className="font-display font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Rider Portal</h2>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSOS(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 transition active:scale-95"
            >
              <AlertTriangle className="h-5 w-5" />
            </button>
            <Link to="/rider/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 transition active:scale-95">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary border-2 border-background" />
            </Link>
            <Link to="/rider/profile" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 transition active:scale-95 overflow-hidden">
               {user?.avatar ? (
                 <img src={user.avatar} alt={displayName} className="h-full w-full object-cover" />
               ) : (
                 <User className="h-5 w-5" />
               )}
            </Link>
          </div>
        </header>

        {/* Update Banner */}
        {showUpdate && (
          <div className="flex items-center justify-between bg-primary/10 px-5 py-2.5 text-[11px] font-bold text-primary">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5" />
              <span>App update required for best performance</span>
            </div>
            <button onClick={() => setShowUpdate(false)}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        {/* Main Content */}
        <main className="relative mx-auto w-full max-w-5xl">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="glass fixed bottom-3 left-1/2 z-40 flex w-[min(460px,calc(100%-1.5rem))] -translate-x-1/2 items-center justify-between rounded-[2rem] px-2 py-2 shadow-glow md:hidden">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <n.icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2} />
                <span className="scale-90">{n.label}</span>
                {active && <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>

        {/* SOS Modal */}
        {showSOS && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-5 animate-in fade-in duration-300">
            <div className="w-full max-w-sm rounded-[2.5rem] bg-card p-6 shadow-glow ring-1 ring-border/60">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-xl font-extrabold text-rose-500 italic uppercase tracking-tight">Emergency SOS</h3>
                <button onClick={() => setShowSOS(false)} className="rounded-full bg-muted p-2"><X className="h-4 w-4" /></button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <SOSAction icon={PhoneCall} label="Ambulance" onClick={() => handleSOS("Ambulance")} />
                <SOSAction icon={Shield} label="Police" onClick={() => handleSOS("Police")} />
                <SOSAction icon={AlertTriangle} label="Accident" onClick={() => handleSOS("Accident")} />
                <SOSAction icon={HelpCircle} label="Help Center" onClick={() => navigate({ to: "/rider/support" })} />
              </div>
              
              <div className="mt-6 rounded-2xl bg-muted/40 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Digital Insurance Card</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Policy #SCO-82910</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <p className="mt-6 text-center text-[10px] text-muted-foreground leading-relaxed">
                Emergency services will be notified of your current location. False alerts are subject to disciplinary action.
              </p>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}

function SOSAction({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-3xl bg-muted/40 p-4 transition active:scale-95 hover:bg-muted/60"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-soft ring-1 ring-border/60 text-rose-500">
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
