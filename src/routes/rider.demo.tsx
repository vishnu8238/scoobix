import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  Bike, Home, Wallet, History, ChevronRight, 
  Info, Check, User, Bell, AlertTriangle
} from "lucide-react";

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
  { title: "Welcome to Scoobix", desc: "Your portal for managing deliveries and tracking earnings. This is a read-only preview.", tab: "Home" },
  { title: "KYC & Verification", desc: "Experience the onboarding flow. Upload documents like Aadhaar to get verified.", tab: "Home" },
  { title: "Dashboard & Status", desc: "Toggle your status to 'Online' to start receiving delivery requests.", tab: "Home" },
  { title: "Trip History", desc: "Review all your past successful deliveries and earnings for every trip.", tab: "History" },
  { title: "Pocket Earnings", desc: "Check your daily and weekly payouts, including tips and incentives.", tab: "Pocket" },
  { title: "More & Support", desc: "Access 24/7 support and manage your vehicle profile.", tab: "More" },
];

function RiderDemo() {
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
    <div className="flex flex-col items-center w-full min-h-svh bg-[#0A0A0A] overflow-x-hidden text-white font-sans">
      {/* 430px Mobile Shell Container */}
      <div className="relative w-full max-w-[430px] min-h-svh bg-[#121212] shadow-2xl flex flex-col ring-1 ring-white/5 overflow-hidden">
        
        {/* Static Header */}
        <header className="sticky top-0 z-[70] flex h-16 w-full items-center justify-between border-b border-white/5 bg-[#121212]/90 px-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3B82F6] text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-black italic tracking-tighter text-[#3B82F6] uppercase">SCOOBIX</span>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500 leading-none">Rider Demo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-rose-500/10 text-rose-500"><AlertTriangle className="h-5 w-5" /></div>
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400"><Bell className="h-5 w-5" /></div>
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400"><User className="h-5 w-5" /></div>
          </div>
        </header>

        {/* Demo Overlay Guide */}
        <div className="w-full p-4 bg-[#3B82F6]/10 border-b border-[#3B82F6]/20 z-[60]">
          <div className="rounded-2xl bg-[#1A1A1A] p-4 shadow-xl ring-1 ring-white/10">
             <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black italic uppercase text-[#3B82F6]">{DEMO_STEPS[step].title}</h3>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{step + 1} / {DEMO_STEPS.length}</span>
             </div>
             <p className="text-[11px] text-zinc-400 mb-4 leading-relaxed font-medium">{DEMO_STEPS[step].desc}</p>
             <div className="flex gap-2">
                <button 
                  onClick={prevStep} 
                  disabled={step === 0}
                  className="flex-1 rounded-xl text-[10px] font-bold uppercase tracking-widest h-9 border border-white/10 bg-transparent disabled:opacity-20"
                >
                  Back
                </button>
                <button 
                  onClick={nextStep}
                  disabled={step === DEMO_STEPS.length - 1}
                  className="flex-1 rounded-xl bg-[#3B82F6] text-white text-[10px] font-bold uppercase tracking-widest h-9 disabled:opacity-20"
                >
                  {step === DEMO_STEPS.length - 1 ? "Complete" : "Next Step"}
                </button>
             </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 w-full overflow-y-auto p-4 space-y-6 pb-24">
          <h1 className="text-2xl font-black italic uppercase tracking-tight text-white mt-2">Rider Demo Mode</h1>
          
          {tab === "Home" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Status Card */}
              <div className="rounded-[2.5rem] bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] p-8 text-white shadow-xl relative overflow-hidden">
                 <div className="absolute -right-4 -bottom-4 opacity-10">
                   <Bike className="h-32 w-32 rotate-12" />
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Current Status</p>
                 <div className="flex items-center gap-3 mt-2">
                   <div className="h-3 w-3 rounded-full bg-white animate-pulse shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                   <h2 className="text-4xl font-black italic uppercase tracking-tighter">Online</h2>
                 </div>
                 <button className="mt-8 rounded-full bg-white/20 backdrop-blur-md px-7 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/30 transition shadow-lg">Go Offline</button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="rounded-3xl bg-[#1A1A1A] p-5 border border-white/5 shadow-sm">
                    <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Earnings Today</p>
                    <p className="text-2xl font-black mt-1 italic text-[#3B82F6] tracking-tight">₹1,240</p>
                    <p className="text-[9px] font-bold text-zinc-600 mt-1 uppercase">5 TRIPS</p>
                 </div>
                 <div className="rounded-3xl bg-[#1A1A1A] p-5 border border-white/5 shadow-sm">
                    <p className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Driver Rating</p>
                    <p className="text-2xl font-black mt-1 italic text-amber-500 tracking-tight">4.9</p>
                    <p className="text-[9px] font-bold text-zinc-600 mt-1 uppercase">EXCELLENT</p>
                 </div>
              </div>

              {/* KYC Progress */}
              <div className="rounded-[2rem] bg-[#1A1A1A] p-6 border border-white/5 shadow-sm">
                 <div className="flex items-center justify-between mb-5">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Verification Progress</h4>
                    <span className="text-[10px] font-black text-[#3B82F6] uppercase bg-[#3B82F6]/10 px-2 py-0.5 rounded-full">80%</span>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-[#242424] border border-white/5">
                       <span className="text-[11px] font-bold uppercase text-zinc-300">Aadhaar Card</span>
                       <div className="bg-emerald-500/10 p-1 rounded-full"><Check className="h-3 w-3 text-emerald-500" /></div>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-[#242424] border border-white/5">
                       <span className="text-[11px] font-bold uppercase text-zinc-300">Vehicle RC</span>
                       <div className="h-4 w-4 rounded-full border border-dashed border-amber-500/50" />
                    </div>
                 </div>
              </div>
            </div>
          )}

          {tab === "History" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h3 className="text-xl font-black italic uppercase tracking-tight text-white">Trip History</h3>
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-3xl bg-[#1A1A1A] p-5 border border-white/5 shadow-sm">
                   <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Order #SC-{8290 + i}</p>
                      <div className="bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">Delivered</div>
                   </div>
                   <p className="text-sm font-black mt-2 tracking-tight">Sayajigunj → Akota Gardens</p>
                   <div className="flex justify-between items-center mt-5 pt-4 border-t border-dashed border-white/5 text-[10px]">
                      <span className="font-bold text-zinc-500 uppercase">Aug 18, 2026 • 12:4{i} PM</span>
                      <span className="font-black text-[#3B82F6] text-sm">₹14{i}.00</span>
                   </div>
                </div>
              ))}
            </div>
          )}

          {tab === "Pocket" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="rounded-[2.5rem] bg-gradient-to-b from-[#242424] to-[#121212] p-10 text-white shadow-xl text-center border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Available for Payout</p>
                  <h2 className="text-5xl font-black italic tracking-tighter mt-3 tracking-tighter">₹5,420.00</h2>
                  <button className="w-full mt-10 bg-white text-black hover:bg-zinc-200 rounded-2xl h-14 font-black uppercase tracking-widest text-[11px] transition-all active:scale-95">Withdraw to Bank</button>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-3xl bg-[#1A1A1A] border border-white/5">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Base Pay</p>
                    <p className="text-xl font-black italic mt-1">₹3,800</p>
                  </div>
                  <div className="p-5 rounded-3xl bg-[#1A1A1A] border border-white/5">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Tips</p>
                    <p className="text-xl font-black italic mt-1 text-amber-500">₹420</p>
                  </div>
               </div>
            </div>
          )}

          {tab === "More" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="flex items-center gap-5 p-5 rounded-[2rem] bg-[#1A1A1A] border border-white/5 shadow-sm">
                  <div className="h-20 w-20 rounded-3xl bg-[#242424] flex items-center justify-center border border-white/5 shadow-inner">
                    <User className="h-10 w-10 text-zinc-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic uppercase tracking-tight text-white">Demo Rider</h3>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-1">ID: #SCO-99-DEMO</p>
                  </div>
               </div>
               <div className="space-y-2.5">
                  {["Vehicle Management", "Insurance Details", "Availability", "Help & Support"].map(m => (
                    <button key={m} className="w-full flex items-center justify-between p-5 rounded-2xl bg-[#1A1A1A] border border-white/5 text-[11px] font-black uppercase tracking-widest hover:bg-[#242424] transition-all active:scale-[0.98]">
                      <span className="text-zinc-300">{m}</span>
                      <ChevronRight className="h-4 w-4 text-zinc-700" />
                    </button>
                  ))}
               </div>
               <button 
                 className="w-full text-rose-500 font-black uppercase tracking-widest text-[11px] h-14 rounded-2xl bg-rose-500/5 border border-rose-500/20 mt-4 transition-all hover:bg-rose-500/10 active:scale-95"
                 onClick={() => window.location.replace("/login?portal=rider")}
               >
                 Exit Demo Mode
               </button>
            </div>
          )}
        </main>

        {/* Static Bottom Navigation */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 flex h-24 w-full max-w-[430px] items-center justify-around border-t border-white/5 bg-[#121212]/95 pb-4 backdrop-blur-xl px-2 z-[70] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
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
                className={`flex flex-1 flex-col items-center justify-center gap-2 transition-all duration-300 ${active ? "text-[#3B82F6]" : "text-zinc-600 hover:text-zinc-400"}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 ${active ? "bg-[#3B82F6]/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]" : "bg-transparent"}`}>
                  <n.icon className={`h-5 w-5 ${active ? "stroke-[2.5px]" : "stroke-[2px]"}`} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${active ? "opacity-100" : "opacity-40"}`}>{n.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}