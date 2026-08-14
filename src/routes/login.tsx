import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { 
  ShieldCheck, Search, Bike, Store, Truck, LogIn,
  Layout, ArrowRight, Loader2, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, Role } from "@/lib/auth-store";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Scoobix · Login" }] }),
  component: ConsolidatedLogin,
});

const PORTALS: { id: Role; label: string; icon: any; color: string; desc: string }[] = [
  { id: "customer", label: "Customer", icon: Search, color: "bg-primary", desc: "Order food from top restaurants" },
  { id: "partner", label: "Partner", icon: Store, color: "bg-indigo-600", desc: "Manage your restaurant operations" },
  { id: "rider", label: "Rider", icon: Bike, color: "bg-emerald-600", desc: "Earn on your schedule" },
  { id: "logistics", label: "Logistics", icon: Truck, color: "bg-sky-600", desc: "Staff & operations management" },
  { id: "manager", label: "Manager", icon: LogIn, color: "bg-[#0f766e]", desc: "Merchant portfolio management" },
  { id: "admin", label: "Admin", icon: ShieldCheck, color: "bg-zinc-900", desc: "Authorized personnel only" },
];

function ConsolidatedLogin() {
  const { login, user, loading, authState, authError } = useAuth();
  const navigate = useNavigate();
  const [selectedPortal, setSelectedPortal] = useState<Role>("customer");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const portalParam = params.get("portal") as Role;
    if (portalParam && PORTALS.find(p => p.id === portalParam)) {
      setSelectedPortal(portalParam);
    }
    
    const err = params.get("error") || params.get("denied") || params.get("disabled");
    if (err) {
      const p = params.get("portal") || "requested";
      if (err === "disabled") {
        setLocalError(`Your access to the ${p} portal has been disabled. Please contact support.`);
      } else {
        setLocalError(`You don't have permission to access the ${p} portal.`);
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && user && user.membershipsResolved) {
      // If logged in and admitted to the selected portal, go there
      if (user.roles.includes(selectedPortal)) {
        const dest = selectedPortal === "customer" ? "/app" : `/${selectedPortal}`;
        console.log(`[AUTH_DEBUG] Login: User authorized for ${selectedPortal}, navigating to ${dest}`);
        // Use replace to prevent back-button loops
        navigate({ to: dest as any, replace: true });
      } else if (selectedPortal === "customer") {
        // Normal customers go to /app
        navigate({ to: "/app", replace: true });
      } else {
        // If they chose a privileged portal but aren't authorized, 
        // they stay here and see the error message (already handled via URL params)
        console.warn(`[AUTH_DEBUG] Login: User NOT authorized for ${selectedPortal}. Roles:`, user.roles);
      }
    }
  }, [user, loading, selectedPortal, navigate]);

  const handleLogin = async () => {
    try {
      setLocalError(null);
      await login('google', selectedPortal);
    } catch (err: any) {
      console.error("[AUTH_DEBUG] Login failure:", err);
      setLocalError(err.message || "Failed to sign in with Google");
    }
  };

  if (loading && !localError && !authError) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background gap-4 p-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
            Resolving Access
          </p>
        </div>
        
        {/* Anti-blank-screen insurance: If hydration worked but we are stuck in loading, 
            show a faint escape hatch after a few seconds */}
        <div className="mt-12 animate-in fade-in duration-1000 delay-5000 fill-mode-backwards">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground"
            onClick={() => window.location.reload()}
          >
            Connection taking too long? Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 py-12 text-center animate-fade-up max-w-lg mx-auto w-full">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-glow">
          <Layout className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight mt-4 italic uppercase">Scoobix</h1>
        <p className="text-sm text-muted-foreground">Select a portal to continue</p>
      </div>

      {(localError || (authState === "auth_error" && authError)) && (
        <div className="mb-6 w-full overflow-hidden rounded-2xl bg-destructive/10 ring-1 ring-destructive/20 p-4 text-left flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold text-destructive uppercase tracking-wider">Authentication Error</p>
            <p className="mt-1 text-[13px] font-medium text-destructive/90">{localError || authError}</p>
            <Button 
              variant="link" 
              className="p-0 h-auto text-[10px] font-bold uppercase text-primary mt-2"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-8">
        {PORTALS.map((portal) => {
          const isSelected = selectedPortal === portal.id;
          const Icon = portal.icon;
          return (
            <button
              key={portal.id}
              onClick={() => {
                setSelectedPortal(portal.id);
                setLocalError(null);
              }}
              className={cn(
                "relative flex flex-col items-start p-4 rounded-2xl text-left transition-all ring-1 ring-border/60 hover:shadow-soft",
                isSelected ? "bg-card ring-2 ring-primary shadow-soft" : "bg-card/40 opacity-70"
              )}
            >
              <div className={cn("p-2 rounded-xl mb-3", portal.color)}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <p className="font-bold text-sm">{portal.label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-1">{portal.desc}</p>
              {isSelected && (
                <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      <div className="w-full space-y-4">
        <Button 
          onClick={handleLogin}
          className="h-14 w-full rounded-2xl bg-white text-black ring-1 ring-border shadow-soft hover:bg-zinc-50 font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="h-5 w-5" alt="" />
          Continue to {PORTALS.find(p => p.id === selectedPortal)?.label}
        </Button>
      </div>

      {user && (
        <div className="mt-8 flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-muted/30 border border-border/40 w-full">
           <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
             <Mail className="h-4 w-4 text-primary" />
           </div>
           <div className="flex flex-col text-left overflow-hidden">
             <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Signed in as</span>
             <span className="text-xs font-medium text-foreground truncate">{user.email}</span>
           </div>
        </div>
      )}

      <p className="mt-10 text-[10px] text-muted-foreground max-w-[300px] leading-relaxed">
        Authorized use only. By continuing, you agree to Scoobix’s Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
