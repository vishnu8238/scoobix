import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-store";
import { useDriver } from "@/lib/driver-store";
import { createRiderProfile } from "@/lib/rider-kyc";
import { VerificationUploadCard } from "@/components/cravio/VerificationPanel";
import { Bike, ShieldCheck, User, Phone, Clipboard, CheckCircle2, Loader2, AlertCircle, TrendingUp, Clock, Package, ChevronRight, Star, MapPin, Zap, ExternalLink, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { getDisplayName } from "@/lib/identity-utils";
import { setRiderAvailability } from "@/lib/rider-api";

type OrderRow = {
  id: string;
  status?: string;
  driver_id?: string | null;
  delivery_fee?: number;
  delivery_address?: string;
  created_at?: string;
};

const ACTIVE = ["ASSIGNED", "ACCEPTED", "READY", "AT_PICKUP", "PICKED_UP", "ON_THE_WAY", "ARRIVED"];

function isToday(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function ProgressStat({ label, value, color }: { label: string; value: string; color: "primary" | "sky" | "amber" }) {
  const colors = {
    primary: "bg-primary/5 text-primary ring-primary/10",
    sky: "bg-sky-50 text-sky-700 ring-sky-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };
  
  return (
    <div className={cn("rounded-2xl p-4 ring-1 flex flex-col items-center text-center", colors[color])}>
      <p className="font-display text-lg font-black tracking-tight">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-widest opacity-60">{label}</p>
    </div>
  );
}

function PromoCard({ title, desc, icon: Icon, color, to, url }: any) {
  const content = (
    <div className={cn("flex min-w-[200px] flex-col rounded-3xl p-5 text-white shadow-soft transition active:scale-95", color)}>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="font-display text-sm font-extrabold tracking-tight">{title}</p>
      <p className="mt-1 text-[10px] text-white/80 leading-snug">{desc}</p>
    </div>
  );

  if (url) return <a href={url} target="_blank" rel="noopener noreferrer">{content}</a>;
  if (to) return <Link to={to}>{content}</Link>;
  return content;
}


export const Route = createFileRoute("/rider/")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Home" }] }),
  component: RiderOnboardingFlow,
});

function RiderHomeContent() {
  const { user } = useAuth();
  const { driver, driverId, update } = useDriver();
  const [online, setOnline] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [offers, setOffers] = useState<OrderRow[]>([]);
  const [locationState, setLocationState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  
  const version = useTableVersion(["orders", "drivers"]);

  useEffect(() => { 
    setOnline(Boolean(driver?.is_online || (driver as any)?.online_status)); 

  }, [driver?.is_online]);

  // Check geolocation permission on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).permissions) {
      (navigator as any).permissions.query({ name: 'geolocation' }).then((result: any) => {
        setLocationState(result.state);
        result.onchange = () => setLocationState(result.state);
      });
    }
  }, []);

  const load = useCallback(async () => {
    if (!driverId) return;
    const [mine, pending] = await Promise.all([
      listTable<OrderRow>("orders", { driver_id: `eq.${driverId}`, order: "created_at.desc", limit: 50 }),
      listTable<OrderRow>("orders", { driver_id: `eq.${driverId}`, status: "eq.ASSIGNING", limit: 3 }),
    ]);
    setOrders(mine);
    setOffers(pending);
  }, [driverId]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const stats = useMemo(() => {
    const done = orders.filter((o) => String(o.status ?? "").toUpperCase() === "DELIVERED" && isToday(o.created_at));
    const total = done.reduce((s, o) => s + (Number(o.delivery_fee ?? 0) || 0), 0);
    const trips = done.length;
    // Calculate active time based on order timestamps if available
    const timeOnOrders = done.reduce((acc, o) => {
      if (o.created_at && (o as any).delivered_at) {
        const start = new Date(o.created_at).getTime();
        const end = new Date((o as any).delivered_at).getTime();
        return acc + Math.round((end - start) / 60000);
      }
      return acc + 25; // fallback avg
    }, 0);
    return { total, trips, timeOnOrders };
  }, [orders]);

  const active = useMemo(
    () => orders.find((o) => ACTIVE.includes(String(o.status ?? "").toUpperCase())) ?? null,
    [orders],
  );

  const displayName = getDisplayName(user) || "Rider";
  const firstName = displayName.split(" ")[0];

  const verified = Boolean((driver as any)?.docs_verified);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationState('granted'),
      () => {
        setLocationState('denied');
        toast.error("Location access denied. Please enable it in settings.");
      }
    );
  };

  const toggleOnline = async () => {
    if (locationState !== 'granted') {
      toast.error("Location access is required to go online.");
      requestLocation();
      return;
    }

    const next = !online;
    if (next && !verified) {
      toast.error("Complete your KYC verification before going online.");
      return;
    }

    try {
      setOnline(next);
      if (driverId) {
        await setRiderAvailability(driverId, next);
        // Best-effort local state update
        await update({ is_online: next });

        toast.success(next ? "You are now ONLINE" : "You are now OFFLINE");
      }
    } catch (err) {
      setOnline(!next); // Revert
      toast.error("Failed to sync availability. Try again.");
    }
  };

  return (
    <div className="animate-fade-up space-y-6 px-4 pb-8 pt-7">
      
      {/* Header & Identity */}
      <header className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="eyebrow text-primary">Active Rider</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight truncate">Hey, {firstName}</h1>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            <span className="font-bold text-foreground">{(Number(driver?.rating) || 5).toFixed(2)}</span>
            <span className="mx-1 opacity-40">·</span>
            <span>{driver?.total_deliveries ?? 0} trips</span>
            <span className="mx-1 opacity-40">·</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Level 1</span>
          </div>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 shadow-soft ring-1 ring-primary/20">
          <Bike className="h-7 w-7 text-primary" strokeWidth={2.4} />
        </div>
      </header>

      {/* Online/Offline Toggle */}
      <div className={cn(
        "relative overflow-hidden rounded-[2rem] p-6 shadow-pop transition-all duration-500",
        online ? "bg-gradient-to-br from-primary to-primary-strong text-primary-foreground ring-4 ring-primary/20" : "bg-card ring-1 ring-border/60",
      )}>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-full animate-pulse", online ? "bg-emerald-400" : "bg-muted-foreground")} />
              <p className={cn("text-[11px] font-bold uppercase tracking-[0.2em]", online ? "text-white/80" : "text-muted-foreground")}>
                Current Status
              </p>
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold italic tracking-tight">{online ? "ONLINE" : "OFFLINE"}</p>
            <p className={cn("mt-1 text-xs font-medium", online ? "text-white/80" : "text-muted-foreground")}>
              {online ? "Ready for delivery requests" : "Tap toggle to start earning"}
            </p>
          </div>
          <button
            onClick={toggleOnline}
            className={cn(
              "relative h-10 w-20 rounded-full p-1.5 transition-colors duration-300",
              online ? "bg-white/30" : "bg-muted ring-1 ring-border/60",
            )}
          >
            <span className={cn(
              "block h-7 w-7 rounded-full bg-white shadow-pop transition-transform duration-300 flex items-center justify-center",
              online && "translate-x-10",
            )}>
              {online ? <Zap className="h-4 w-4 text-primary" /> : <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />}
            </span>
          </button>
        </div>
        {online && (
          <div className="absolute -right-6 -top-6 opacity-10">
            <Zap className="h-32 w-32 text-white" />
          </div>
        )}
      </div>

      {/* Location Permission Alert */}
      {locationState !== 'granted' && (
        <div className="rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-rose-500 p-1 text-white">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-rose-900">Location Access Required</p>
              <p className="mt-1 text-xs leading-relaxed text-rose-700">
                To receive nearby orders, we need to know where you are. 
              </p>
              <button 
                onClick={requestLocation}
                className="mt-3 text-[11px] font-black uppercase tracking-widest text-rose-600 underline"
              >
                Allow Access Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Today's Progress Cards */}
      <section>
        <div className="flex items-center justify-between px-2 mb-3">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-muted-foreground">Today's Progress</h2>
          <Link to="/rider/history" className="text-[10px] font-bold text-primary uppercase tracking-wider">Details</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <ProgressStat label="Earnings" value={formatPrice(stats.total)} color="primary" />
          <ProgressStat label="Orders" value={String(stats.trips)} color="sky" />
          <ProgressStat label="Active" value={`${stats.timeOnOrders}m`} color="amber" />
        </div>
      </section>

      {/* Incentive / Slot Carousel (Feed Item) */}
      <section className="rounded-[2rem] bg-indigo-600 p-6 text-white shadow-glow relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">Flat Pay Bonus</div>
            <span className="text-[9px] font-bold text-white/60">Ending in 2h 45m</span>
          </div>
          <h3 className="mt-3 font-display text-xl font-extrabold italic tracking-tight">Weekend Warrior Bonus</h3>
          <p className="mt-1 text-xs text-indigo-100">Complete 10 orders to earn an extra ₹500 today.</p>
          
          <div className="mt-6 flex items-center justify-between">
             <div className="h-2 flex-1 rounded-full bg-white/20 mr-4 overflow-hidden">
                <div className="h-full w-2/3 bg-white" />
             </div>
             <span className="text-[10px] font-black">7/10</span>
          </div>
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-20">
          <TrendingUp className="h-24 w-24 text-white" />
        </div>
      </section>

      {/* Promotional Carousel */}
      <section className="px-1 overflow-x-auto hide-scrollbar flex gap-4 pb-2">
        <PromoCard 
          title="Tax Filing Support" 
          desc="Get expert help with your taxes." 
          icon={ExternalLink} 
          color="bg-emerald-500" 
          url="https://tax-support.scoobix.app"
        />
        <PromoCard 
          title="Book Next Gig" 
          desc="Schedule your weekend shifts." 
          icon={Calendar} 
          color="bg-primary" 
          to="/rider/requests"
        />
        <PromoCard 
          title="Health Plan" 
          desc="Exclusive coverage for riders." 
          icon={CheckCircle2} 
          color="bg-sky-600" 
          to="/rider/more"
        />
      </section>

      {/* Active Gig / Offers Card */}
      <section className="rounded-[2rem] bg-card p-6 shadow-card ring-1 ring-border/60">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold tracking-tight">Delivery Requests</h2>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
            {offers.length}
          </div>
        </div>
        
        {offers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center opacity-60">
            <div className="mb-3 rounded-2xl bg-muted/40 p-4">
               <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {online ? "Hunting for orders..." : "Go online to see offers"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map((o) => (
              <Link 
                key={o.id} 
                to="/rider/requests" 
                className="flex items-center gap-4 rounded-[1.5rem] bg-muted/30 p-4 transition active:scale-[0.98] hover:bg-muted/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
                  <Package className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs font-black uppercase tracking-wider">#{o.id.slice(-5)}</p>
                    <span className="font-display text-sm font-black text-primary">{formatPrice(o.delivery_fee ?? 0)}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{o.delivery_address || "New delivery available"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Sticky Active Trip Card */}
      {active && (
        <Link 
          to="/rider/active" 
          className="fixed bottom-28 left-5 right-5 z-20 flex items-center justify-between rounded-[2rem] bg-foreground p-5 text-background shadow-glow ring-2 ring-primary/20 transition active:scale-[0.98] animate-in slide-in-from-bottom-10"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Bike className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-background/60">Active Trip</p>
              <p className="mt-0.5 font-display text-sm font-extrabold tracking-tight truncate max-w-[150px]">
                #{active.id.slice(-5)} · {active.status}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 opacity-60" />
        </Link>
      )}
    </div>
  );
}

function RiderOnboardingFlow() {
  const { user } = useAuth();
  const { driver, loading: driverLoading, error: driverError } = useDriver();
  const [step, setStep] = useState<"profile" | "kyc" | "ready">("profile");
  
  // Profile form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    vehicle_type: "Motorcycle",
    license_number: "",
    vehicle_number: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.name) setFormData(prev => ({ ...prev, name: prev.name || user.name || "" }));
    if (user?.phone) setFormData(prev => ({ ...prev, phone: prev.phone || user.phone || "" }));
  }, [user]);

  useEffect(() => {
    if (!driverLoading && driver) {
      if (driver.docs_verified) {
        setStep("ready");
      } else {
        setStep("kyc");
      }
    }
  }, [driver, driverLoading]);

  // If driver exists and is verified, we should probably render the actual home content
  // But for this task, let's keep it simple: if verified, we show a success screen or redirect.
  // Actually, let's import the original RiderHome logic and wrap it.
  
  if (driverLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Initializing Rider Identity...</p>
      </div>
    );
  }

  if (driverError) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold">Identity Error</h2>
        <p className="text-sm text-muted-foreground">{driverError}</p>
        <Button onClick={() => window.location.reload()}>Retry Connection</Button>
      </div>
    );
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    
    setSubmitting(true);
    try {
      // Removed email from payload to match drivers schema
      await createRiderProfile(user.id, {
        ...formData
      });
      toast.success("Profile created! Now let's verify your documents.");
      setStep("kyc");
    } catch (err: any) {
      toast.error(err.message || "Failed to create profile");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "profile") {
    return (
      <div className="animate-fade-up px-6 py-10 space-y-8">
        <header className="text-center space-y-2">
          <div className="mx-auto h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Bike className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-black italic tracking-tight">Become a Scoobix Rider</h1>
          <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">Complete your professional profile to start earning with the Scoobix fleet.</p>
        </header>

        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="space-y-4 rounded-[2rem] bg-card p-6 shadow-soft ring-1 ring-border/60">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest ml-1">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="name"
                  required
                  placeholder="e.g. Rahul Sharma"
                  className="pl-10 h-12 rounded-2xl bg-muted/30 border-none ring-1 ring-border/40 focus:ring-primary/40"
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest ml-1">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="phone"
                  required
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  className="pl-10 h-12 rounded-2xl bg-muted/30 border-none ring-1 ring-border/40 focus:ring-primary/40"
                  value={formData.phone}
                  onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle" className="text-[10px] font-black uppercase tracking-widest ml-1">Vehicle Type</Label>
              <select 
                id="vehicle"
                className="w-full h-12 px-4 rounded-2xl bg-muted/30 border-none ring-1 ring-border/40 focus:ring-primary/40 text-sm font-medium outline-none"
                value={formData.vehicle_type}
                onChange={e => setFormData(f => ({ ...f, vehicle_type: e.target.value }))}
              >
                <option>Motorcycle</option>
                <option>Scooter</option>
                <option>Bicycle</option>
                <option>Electric Bike</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="license" className="text-[10px] font-black uppercase tracking-widest ml-1">License Number</Label>
              <div className="relative">
                <Clipboard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="license"
                  required
                  placeholder="DL-XXXXXXXXXXXX"
                  className="pl-10 h-12 rounded-2xl bg-muted/30 border-none ring-1 ring-border/40 focus:ring-primary/40"
                  value={formData.license_number}
                  onChange={e => setFormData(f => ({ ...f, license_number: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vnum" className="text-[10px] font-black uppercase tracking-widest ml-1">Vehicle Number (Optional)</Label>
              <Input 
                id="vnum"
                placeholder="KA-01-XX-0000"
                className="h-12 rounded-2xl bg-muted/30 border-none ring-1 ring-border/40 focus:ring-primary/40"
                value={formData.vehicle_number}
                onChange={e => setFormData(f => ({ ...f, vehicle_number: e.target.value }))}
              />
            </div>
          </div>

          <Button 
            disabled={submitting}
            className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-widest shadow-glow active:scale-95 transition-all"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save & Continue"}
          </Button>
        </form>
      </div>
    );
  }

  if (step === "ready") {
    return <RiderHomeContent />;
  }

  if (step === "kyc") {
    return (
      <div className="animate-fade-up px-4 py-8 space-y-6">
        <header className="px-2">
          <p className="eyebrow text-primary">Identity Check</p>
          <h1 className="mt-1 font-display text-2xl font-black italic tracking-tight">KYC Verification</h1>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Upload clear photos of your documents. You can save your progress and return later.
          </p>
        </header>

        <div className="space-y-4">
          <VerificationUploadCard 
            subject="rider"
            subjectId={driver?.id || user?.id}
            actor={{ id: user?.id, name: user?.name, role: 'rider' }}
            title="Required Documents"
            note="Our compliance team will review your submission within 24-48 hours. You will receive a notification once verified."
          />
          
          <div className="p-4 rounded-[2rem] bg-muted/30 border border-border/40 space-y-3">
             <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Self-submission active</span>
             </div>
             <p className="text-[10px] text-muted-foreground leading-relaxed">
               By submitting, you agree that all provided documents are authentic. Scoobix reserves the right to suspend accounts with fraudulent credentials.
             </p>
          </div>

          <Button 
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest border-border/60"
          >
            Refresh Status
          </Button>
        </div>
      </div>
    );
  }

  // Fallback if somehow step is not matched
  return null;
}
