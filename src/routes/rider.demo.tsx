import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bike, Home, Wallet, History, ChevronRight, Info, X, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/rider/demo")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Demo Mode" }] }),
  component: RiderDemo,
});

const DEMO_STEPS = [
  { title: "Welcome to Scoobix", desc: "Your portal for managing deliveries, tracking earnings, and boosting your income." },
  { title: "Profile & KYC", desc: "Upload your Aadhaar, DL, and RC once to start earning. Everything is verified by our team." },
  { title: "Dashboard", desc: "Toggle your status to 'Online' to start receiving delivery requests from nearby restaurants." },
  { title: "History", desc: "Review all your past successful deliveries and your earnings for every single trip." },
  { title: "Pocket", desc: "Check your daily and weekly payouts, including tips from happy customers." },
  { title: "More", desc: "Access support, manage your availability, and view your profile settings." },
];

function RiderDemo() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState("Home");
  const [demoOpen, setDemoOpen] = useState(true);

  if (!demoOpen) return null;

  return (
    <div className="relative min-h-svh bg-background flex flex-col items-center">
      <div className="relative w-full min-h-svh max-w-[430px] bg-card shadow-2xl flex flex-col ring-1 ring-border/10 overflow-hidden">
        
        {/* Header */}
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-glow">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-sm font-black italic tracking-tighter text-emerald-600">SCOOBIX</span>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 leading-none">Rider Demo</p>
            </div>
          </div>
          <button 
            onClick={() => { setDemoOpen(false); window.location.href = "/login?portal=rider"; }}
            className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            Exit Demo <X className="h-3 w-3" />
          </button>
        </header>

        {/* Demo Badge */}
        <div className="bg-emerald-600 text-white p-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest italic">Rider Demo Mode</p>
        </div>

        {/* Stepper */}
        <div className="p-4 bg-muted/20">
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
             <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-sm font-extrabold">{DEMO_STEPS[step].title}</h3>
                <span className="text-[9px] font-bold text-muted-foreground">{step + 1} / {DEMO_STEPS.length}</span>
             </div>
             <p className="text-[11px] text-muted-foreground mb-4">{DEMO_STEPS[step].desc}</p>
             <div className="flex gap-2">
                <button onClick={() => setStep(Math.max(0, step - 1))} className="flex-1 rounded-xl bg-muted py-2 text-[10px] font-bold">Back</button>
                <button onClick={() => step < DEMO_STEPS.length - 1 ? setStep(step + 1) : setStep(DEMO_STEPS.length - 1)} className="flex-1 rounded-xl bg-emerald-600 text-white py-2 text-[10px] font-bold">Next</button>
             </div>
          </div>
        </div>

        {/* Content Tabs */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === "Home" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white text-center">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Status</p>
                 <p className="text-2xl font-black mt-1">ONLINE</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <Stat label="Earnings" value="₹1,250" />
                 <Stat label="Trips" value="5" />
              </div>
              <DemoToastAction />
            </div>
          )}
          {tab === "History" && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl bg-card p-4 border border-border">
                   <p className="text-xs font-bold">Order #{1000 + i}</p>
                   <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">Delivered</p>
                </div>
              ))}
              <DemoToastAction />
            </div>
          )}
          {tab === "Pocket" && (
             <div className="rounded-2xl bg-card p-6 text-center border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Payout</p>
                <p className="text-3xl font-black mt-2">₹5,400</p>
                <DemoToastAction />
             </div>
          )}
          {tab === "More" && (
             <div className="text-sm p-4 text-muted-foreground">Support, Profile, Availability settings (Demo). <DemoToastAction /></div>
          )}
        </main>

        {/* Bottom Nav */}
        <nav className="border-t border-border flex justify-around p-4 bg-background">
          {[
            { label: "Home", icon: Home },
            { label: "History", icon: History },
            { label: "Pocket", icon: Wallet },
            { label: "More", icon: Info },
          ].map((n) => (
            <button key={n.label} onClick={() => setTab(n.label)} className={cn("flex flex-col items-center gap-1", tab === n.label ? "text-emerald-600" : "text-muted-foreground")}>
               <n.icon className="h-5 w-5" />
               <span className="text-[9px] font-bold uppercase">{n.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 border border-border text-center">
      <p className="text-[9px] font-black uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-black mt-1">{value}</p>
    </div>
  );
}

function DemoToastAction() {
  return (
    <button onClick={() => toast.info("Demo only — sign in to use this feature.")} className="mt-4 w-full rounded-full bg-emerald-50 text-emerald-700 py-3 text-[11px] font-bold uppercase">
      View full features
    </button>
  );
}
