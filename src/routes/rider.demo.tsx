import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { 
  Bike, Home, Wallet, History, ChevronRight, 
  Info, X, Check, ArrowRight, MapPin, 
  Calendar, ShoppingBag, ShieldCheck, User
} from "lucide-react";
import { cn } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/rider/demo")({
  head: () => ({ 
    meta: [
      { title: "Scoobix Rider · Demo Mode" },
      { name: "description", content: "Experience the Scoobix Rider portal in read-only demo mode." }
    ] 
  }),
  component: RiderDemo,
});

const DEMO_STEPS = [
  { 
    title: "Welcome to Scoobix", 
    desc: "Your portal for managing deliveries, tracking earnings, and boosting your income. This is a read-only preview.",
    tab: "Home"
  },
  { 
    title: "KYC & Verification", 
    desc: "Experience the onboarding flow. Upload documents like Aadhaar and DL to get verified.",
    tab: "Home"
  },
  { 
    title: "Dashboard & Status", 
    desc: "Toggle your status to 'Online' to start receiving delivery requests from nearby restaurants.",
    tab: "Home"
  },
  { 
    title: "Trip History", 
    desc: "Review all your past successful deliveries and earnings for every trip.",
    tab: "History"
  },
  { 
    title: "Pocket Earnings", 
    desc: "Check your daily and weekly payouts, including tips and incentives.",
    tab: "Pocket"
  },
  { 
    title: "More & Support", 
    desc: "Access 24/7 support, manage your vehicle profile, and view settings.",
    tab: "More"
  },
];

const GIGS = [
  { id: 1, title: "Breakfast Rush", zone: "Sayajigunj", reward: "₹450", time: "07:00 - 11:00" },
  { id: 2, title: "Lunch Peak", zone: "Alkapuri", reward: "₹600", time: "12:00 - 16:00" },
];

function RiderDemo() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState("Home");

  const nextStep = () => {
    const next = Math.min(DEMO_STEPS.length - 1, step + 1);
    setStep(next);
    setTab(DEMO_STEPS[next].tab);
  };

  const prevStep = () => {
    const prev = Math.max(0, step - 1);
    setStep(prev);
    setTab(DEMO_STEPS[prev].tab);
  };

  return (
    <div className="flex flex-col items-center w-full min-h-full">
      {/* Demo Overlay Guide */}
      <div className="w-full max-w-[430px] p-4 bg-emerald-600/10 border-b border-emerald-600/20">
        <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-emerald-600/20">
           <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-sm font-black italic uppercase text-emerald-600">{DEMO_STEPS[step].title}</h3>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{step + 1} / {DEMO_STEPS.length}</span>
           </div>
           <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed font-medium">{DEMO_STEPS[step].desc}</p>
           <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={prevStep} 
                disabled={step === 0}
                className="flex-1 rounded-xl text-[10px] font-bold uppercase tracking-widest h-9"
              >
                Back
              </Button>
              <Button 
                size="sm" 
                onClick={nextStep}
                disabled={step === DEMO_STEPS.length - 1}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-widest h-9"
              >
                {step === DEMO_STEPS.length - 1 ? "Guided Complete" : "Next Step"}
              </Button>
           </div>
        </div>
      </div>

      {/* Demo Badge */}
      <div className="w-full max-w-[430px] bg-emerald-600 text-white py-1.5 px-4 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] italic">Rider Demo · Read Only</p>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[430px] overflow-y-auto p-4 space-y-5 pb-24">
        {tab === "Home" && (
          <>
            {/* Status Card */}
            <div className="rounded-[2.5rem] bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 text-white shadow-glow relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-10">
                 <Bike className="h-24 w-24 rotate-12" />
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Current Status</p>
               <div className="flex items-center gap-3 mt-2">
                 <div className="h-3 w-3 rounded-full bg-white animate-pulse shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                 <h2 className="text-3xl font-black italic uppercase tracking-tighter">Online</h2>
               </div>
               <button 
                 onClick={() => toast.info("Demo only — sign in to change status.")}
                 className="mt-6 rounded-full bg-white/20 backdrop-blur-md px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-white/30 transition shadow-soft"
               >
                 Go Offline
               </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
               <StatCard label="Today's Earnings" value="₹1,240" sub="5 Trips" color="text-emerald-600" />
               <StatCard label="Rating" value="4.9" sub="Excellent" color="text-amber-500" />
            </div>

            {/* Verification Status */}
            <div className="rounded-3xl bg-card p-5 border border-border/60 shadow-soft">
               <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Verification Progress</h4>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">80% Done</span>
               </div>
               <div className="space-y-3">
                  <VerificationItem label="Aadhaar Card" status="verified" />
                  <VerificationItem label="Driving License" status="verified" />
                  <VerificationItem label="Vehicle RC" status="pending" />
               </div>
               <Button 
                 variant="ghost" 
                 className="w-full mt-4 text-[10px] font-black uppercase tracking-widest text-primary"
                 onClick={() => toast.info("Demo only — sign in to upload documents.")}
               >
                 View All Documents <ArrowRight className="h-3 w-3 ml-2" />
               </Button>
            </div>

            {/* Upcoming Gigs */}
            <div className="space-y-3">
               <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Available Gigs</h4>
               {GIGS.map(gig => (
                 <div key={gig.id} className="rounded-2xl bg-card p-4 border border-border/60 shadow-soft flex items-center justify-between">
                    <div>
                       <p className="text-xs font-black uppercase italic tracking-tight">{gig.title}</p>
                       <p className="text-[9px] text-muted-foreground font-bold mt-0.5">{gig.zone} • {gig.time}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-black text-emerald-600 tracking-tighter">{gig.reward}</p>
                       <button onClick={() => toast.info("Demo only — sign in to book gigs.")} className="text-[9px] font-black text-primary uppercase tracking-widest mt-1">Book</button>
                    </div>
                 </div>
               ))}
            </div>
          </>
        )}

        {tab === "History" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="font-display text-lg font-black italic uppercase tracking-tight">Trip History</h3>
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-card p-4 border border-border shadow-soft">
                 <div className="flex justify-between items-start mb-2">
                    <div>
                       <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Order #SC-{8290 + i}</p>
                       <p className="text-xs font-bold mt-1">Sayajigunj → Akota</p>
                    </div>
                    <div className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">Delivered</div>
                 </div>
                 <div className="flex justify-between items-center mt-4 pt-3 border-t border-dashed border-border">
                    <span className="text-[10px] font-bold text-muted-foreground">Aug 18, 2026 • 12:4{i} PM</span>
                    <span className="text-xs font-black text-emerald-600">₹14{i}.00</span>
                 </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              className="w-full rounded-2xl h-12 text-[10px] font-black uppercase tracking-widest"
              onClick={() => toast.info("Demo only — sign in to view full history.")}
            >
              Load Older Trips
            </Button>
          </div>
        )}

        {tab === "Pocket" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="rounded-[2.5rem] bg-zinc-900 p-8 text-white shadow-glow text-center border border-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Balance Available</p>
                <h2 className="text-4xl font-black italic tracking-tighter mt-2">₹5,420.00</h2>
                <div className="flex gap-2 mt-8">
                   <Button className="flex-1 bg-white text-black hover:bg-zinc-200 rounded-2xl h-12 font-black uppercase tracking-widest text-[10px]" onClick={() => toast.info("Demo only — payouts disabled.")}>Withdraw</Button>
                   <Button variant="outline" className="flex-1 rounded-2xl h-12 font-black uppercase tracking-widest text-[10px] border-white/20 hover:bg-white/10" onClick={() => toast.info("Demo only.")}>Details</Button>
                </div>
             </div>

             <div className="space-y-3">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Weekly Summary</h4>
                <div className="grid grid-cols-2 gap-3">
                   <StatCard label="Base Pay" value="₹3,800" sub="Total Trips" color="text-foreground" />
                   <StatCard label="Incentives" value="₹1,200" sub="Gig Bonuses" color="text-emerald-500" />
                   <StatCard label="Tips" value="₹420" sub="From Customers" color="text-amber-500" />
                   <StatCard label="Adjustments" value="₹0" sub="No penalties" color="text-blue-500" />
                </div>
             </div>
          </div>
        )}

        {tab === "More" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-center gap-4 p-4 rounded-3xl bg-card border border-border shadow-soft">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center overflow-hidden">
                   <User className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                   <h3 className="text-lg font-black italic uppercase tracking-tight">Demo Rider</h3>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">ID: #DEMO-991</p>
                </div>
             </div>

             <div className="grid grid-cols-1 gap-2">
                <MenuAction icon={ShieldCheck} label="Insurance Details" onClick={() => toast.info("Demo only.")} />
                <MenuAction icon={Bike} label="Vehicle Management" onClick={() => toast.info("Demo only.")} />
                <MenuAction icon={Calendar} label="Availability Calendar" onClick={() => toast.info("Demo only.")} />
                <MenuAction icon={ShoppingBag} label="Scoobix Bazaar" onClick={() => toast.info("Demo only.")} />
                <MenuAction icon={Info} label="Help & Support" onClick={() => toast.info("Demo only.")} />
             </div>

             <Button 
               variant="ghost" 
               className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-black uppercase tracking-widest text-[11px] h-14 rounded-2xl"
               onClick={() => {
                 window.location.replace("/login?portal=rider");
               }}
             >
               Exit Demo Mode
             </Button>
          </div>
        )}
      </main>

      {/* Bottom Navigation Emulator */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 flex h-20 w-full max-w-[430px] items-center justify-around border-t border-border bg-card/95 backdrop-blur-md px-2 shadow-glow">
        {[
          { label: "Home", icon: Home },
          { label: "History", icon: History },
          { label: "Pocket", icon: Wallet },
          { label: "More", icon: Info },
        ].map((n) => {
          const active = tab === n.label;
          return (
            <button
              key={n.label}
              onClick={() => setTab(n.label)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1.5 transition-all duration-300",
                active ? "text-emerald-600" : "text-muted-foreground hover:text-emerald-500"
              )}
            >
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300",
                active ? "bg-emerald-50 text-emerald-600 shadow-glow" : "bg-transparent"
              )}>
                <n.icon className="h-5 w-5" />
              </div>
              <span className={cn("text-[9px] font-black uppercase tracking-widest", active ? "opacity-100" : "opacity-60")}>
                {n.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 border border-border/60 shadow-soft">
      <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
      <p className={cn("font-display text-xl font-black mt-1 italic tracking-tight", color)}>{value}</p>
      <p className="text-[9px] font-bold text-muted-foreground/60 mt-1 uppercase">{sub}</p>
    </div>
  );
}

function VerificationItem({ label, status }: { label: string; status: 'verified' | 'pending' }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/20">
       <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
       <div className="flex items-center gap-2">
          {status === 'verified' ? (
            <Check className="h-3 w-3 text-emerald-600" />
          ) : (
            <div className="h-3 w-3 rounded-full border border-dashed border-amber-500" />
          )}
          <span className={cn("text-[9px] font-black uppercase tracking-widest", status === 'verified' ? "text-emerald-600" : "text-amber-500")}>
            {status}
          </span>
       </div>
    </div>
  );
}

function MenuAction({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/60 shadow-soft hover:bg-muted/30 transition-all active:scale-[0.98]"
    >
       <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground">
             <Icon className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
       </div>
       <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
    </button>
  );
}
