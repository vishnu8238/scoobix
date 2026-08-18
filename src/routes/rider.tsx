import { createFileRoute, Link, Outlet, useRouterState, useNavigate, useLocation } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Bike, Wallet, Bell, AlertTriangle, X, PhoneCall, Shield, HelpCircle, ChevronRight, User, LogOut, Info, Calendar, ShoppingBag, History } from "lucide-react";
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
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { driver } = useDriver();
  const [showSOS, setShowSOS] = useState(false);
  const [showUpdate, setShowUpdate] = useState(true);

  const displayName = getDisplayName(user) || "Rider";

  const handleSOS = async (type: string) => {
    if (!driver?.id) return;
    
    const confirmed = window.confirm(`Confirm emergency call to ${type}?`);
    if (!confirmed) return;

    try {
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
      
      if (type === "Ambulance") window.location.href = "tel:108";
      if (type === "Police") window.location.href = "tel:100";
    } catch (err) {
      toast.error("Failed to log emergency event, but you can still call.");
    }
  };

  return (
    <RoleGuard allow="rider" transitionLabel="Accessing Rider Portal..." bypass={pathname === "/rider/demo"}>
      <div className="relative min-h-svh bg-background flex flex-col items-center">
        {/* Mobile App Container */}
        <div className="relative w-full min-h-svh max-w-[430px] bg-card shadow-2xl flex flex-col ring-1 ring-border/10 overflow-hidden">
          
          {/* Compact Responsive Header */}
          <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
                <Bike className="h-5 w-5" />
              </div>
              <div>
                <span className="font-display text-sm font-black italic tracking-tighter text-primary">SCOOBIX</span>
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 leading-none">Rider Portal</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowSOS(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 transition active:scale-90"
                aria-label="Emergency SOS"
              >
                <AlertTriangle className="h-5 w-5" />
              </button>
              <Link 
                to="/rider/notifications" 
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 transition active:scale-90"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary border-2 border-background" />
              </Link>
              <Link 
                to="/rider/profile" 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 transition active:scale-90 overflow-hidden"
                aria-label="Profile"
              >
                 {user?.avatar ? (
                   <img src={user.avatar} alt={displayName} className="h-full w-full object-cover" />
                 ) : (
                   <User className="h-5 w-5" />
                 )}
              </Link>
            </div>
          </header>

          {/* Update Banner */}
          <AnimatePresence>
            {showUpdate && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-primary/10"
              >
                <div className="flex items-center justify-between px-4 py-2.5 text-[10px] font-bold text-primary">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5" />
                    <span>App update available.</span>
                  </div>
                  <button onClick={() => setShowUpdate(false)} aria-label="Close banner"><X className="h-3.5 w-3.5" /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <main className="flex-1 w-full overflow-y-auto overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom))]">
            <div className="w-full">
              <Outlet />
            </div>
          </main>

          {/* Fixed Bottom Navigation (Mobile App Style) */}
          <nav className="fixed bottom-0 left-1/2 z-50 flex h-[calc(4.5rem+env(safe-area-inset-bottom))] w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t border-border/40 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md px-2 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-label={n.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-1 flex-col items-center justify-center gap-1.5 transition-all duration-300",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300",
                    active ? "bg-primary/10 shadow-glow text-primary" : "bg-transparent"
                  )}>
                    <n.icon className={cn("h-5 w-5", active ? "stroke-[2.5px]" : "stroke-[2px]")} />
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-widest", active ? "opacity-100" : "opacity-60")}>
                    {n.label}
                  </span>
                  {active && (
                    <motion.div 
                      layoutId="activeNavTab"
                      className="absolute -bottom-1 h-1 w-4 rounded-full bg-primary" 
                    />
                  )}
                </Link>
              );
            })}
            <Link
              to="/rider/more"
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1.5 transition-all duration-300",
                pathname.startsWith("/rider/more") ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300",
                pathname.startsWith("/rider/more") ? "bg-primary/10 shadow-glow text-primary" : "bg-transparent"
              )}>
                <ChevronRight className={cn("h-5 w-5 rotate-90", pathname.startsWith("/rider/more") ? "stroke-[2.5px]" : "stroke-[2px]")} />
              </div>
              <span className={cn("text-[9px] font-black uppercase tracking-widest", pathname.startsWith("/rider/more") ? "opacity-100" : "opacity-60")}>
                More
              </span>
            </Link>
          </nav>
        </div>

        {/* SOS Modal */}
        {showSOS && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-5 animate-in fade-in duration-300">
            <div className="w-full max-w-sm rounded-[2.5rem] bg-card p-6 shadow-glow ring-1 ring-border/60 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-xl font-extrabold text-rose-500 italic uppercase tracking-tight">Emergency SOS</h3>
                <button onClick={() => setShowSOS(false)} className="rounded-full bg-muted p-2 hover:bg-muted/80 transition" aria-label="Close SOS"><X className="h-4 w-4" /></button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <SOSAction icon={PhoneCall} label="Ambulance" onClick={() => handleSOS("Ambulance")} />
                <SOSAction icon={Shield} label="Police" onClick={() => handleSOS("Police")} />
                <SOSAction icon={AlertTriangle} label="Accident" onClick={() => handleSOS("Accident")} />
                <SOSAction icon={HelpCircle} label="Help Center" onClick={() => navigate({ to: "/rider/support" })} />
              </div>
              
              <div className="mt-6 rounded-2xl bg-muted/40 p-4 border border-border/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Digital Insurance Card</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Policy #SCO-82910</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <p className="mt-6 text-center text-[10px] text-muted-foreground leading-relaxed font-medium">
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
      className="flex flex-col items-center justify-center gap-2 rounded-3xl bg-muted/40 p-4 transition active:scale-95 hover:bg-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-soft ring-1 ring-border/60 text-rose-500">
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
    </button>
  );
}
