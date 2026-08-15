import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  ShoppingBag, Search, Filter, Star, Clock, 
  ChevronRight, ArrowRight, Package, Info, 
  Zap, Gift, ShieldCheck, CreditCard
} from "lucide-react";
import { cn } from "@/lib/format";
import { formatPrice } from "@/lib/format";
import { useLiveData } from "@/lib/realtime-hooks";
import { fetchBazaarCatalog, createBazaarRequest } from "@/lib/rider-api";
import { useDriver } from "@/lib/driver-store";
import { toast } from "sonner";

export const Route = createFileRoute("/rider/bazaar")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Bazaar" }] }),
  component: RiderBazaar,
});

const CATEGORIES = ["All", "Protection", "Gear", "Loans", "Fuel", "Health"];

function RiderBazaar() {
  const [activeCategory, setActiveCategory] = useState("All");
  const { driverId } = useDriver();
  
  const { data: items, loading } = useLiveData<any[]>(
    ["bazaar_items"],
    () => fetchBazaarCatalog(),
    []
  );

  const handleRequest = async (item: any) => {
    if (!driverId) return;
    try {
      const res = await createBazaarRequest(driverId, item.id);
      if (res) {
        toast.success(`Request submitted for ${item.title}`);
      }
    } catch (err) {
      toast.error("Failed to submit request");
    }
  };

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24 px-5 pt-7 animate-fade-up">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-primary mb-1">
          <ShoppingBag className="h-4 w-4" />
          <p className="eyebrow">Bazaar</p>
        </div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Rider Marketplace</h1>
        <p className="mt-1 text-xs text-muted-foreground">Exclusive deals, insurance, and equipment for Scoobix partners.</p>
      </header>

      {/* Search & Categories */}
      <div className="space-y-4 mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input 
            placeholder="Search equipment or services..." 
            className="w-full rounded-2xl bg-muted/50 px-10 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={cn(
                "whitespace-nowrap rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-widest transition",
                activeCategory === c ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground"
              )}
            >{c}</button>
          ))}
        </div>
      </div>

      {/* Featured Promo */}
      <div className="mb-8 rounded-[2.5rem] bg-zinc-900 p-6 text-white overflow-hidden relative">
         <div className="relative z-10">
            <span className="rounded-full bg-primary px-3 py-1 text-[9px] font-black uppercase tracking-widest">Featured</span>
            <h3 className="mt-3 font-display text-xl font-extrabold leading-tight">Accident Cover<br/>up to ₹5,00,000</h3>
            <p className="mt-2 text-xs text-white/60">Comprehensive insurance for you and your family.</p>
            <button className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary group">
              View Details <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
            </button>
         </div>
         <ShieldCheck className="absolute -bottom-4 -right-4 h-32 w-32 text-white/5" />
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-xs text-muted-foreground">Loading catalog...</div>
        ) : items?.length === 0 ? (
          <div className="col-span-2 rounded-3xl bg-muted/30 p-8 text-center border-2 border-dashed border-border/60">
             <Package className="h-10 w-10 mx-auto text-muted/40 mb-3" />
             <p className="text-xs font-bold">Coming Soon</p>
             <p className="text-[10px] text-muted-foreground mt-1">We're stocking up on new items.</p>
          </div>
        ) : (
          items?.map((item) => (
            <div key={item.id} className="group rounded-[2rem] bg-card p-4 shadow-soft ring-1 ring-border/60 hover:ring-primary/40 transition-all">
               <div className="aspect-square rounded-2xl bg-muted mb-4 overflow-hidden relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground/20">
                      <ShoppingBag className="h-12 w-12" />
                    </div>
                  )}
                  {item.badge && (
                    <span className="absolute left-2 top-2 rounded-lg bg-emerald-500 px-2 py-1 text-[8px] font-black uppercase text-white shadow-lg">
                      {item.badge}
                    </span>
                  )}
               </div>
               <h4 className="font-display text-sm font-extrabold truncate">{item.title}</h4>
               <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{item.category}</p>
               
               <div className="mt-4 flex items-center justify-between">
                  <span className="font-display text-sm font-black text-primary">₹{item.price}</span>
                  <button 
                    onClick={() => handleRequest(item)}
                    className="h-8 w-8 rounded-full bg-zinc-900 flex items-center justify-center text-white active:scale-90 transition"
                  >
                     <Zap className="h-3.5 w-3.5" />
                  </button>
               </div>
            </div>
          ))
        )}
      </div>

      {/* Services Section */}
      <section className="mt-12 space-y-4">
         <h2 className="font-display text-lg font-extrabold">Rider Services</h2>
         <div className="space-y-3">
            {[
              { icon: CreditCard, title: "Quick Cash Loan", desc: "Up to ₹20,000 instant credit", color: "bg-blue-50 text-blue-600" },
              { icon: Gift, title: "Scoobix Rewards", desc: "Redeem points for fuel vouchers", color: "bg-purple-50 text-purple-600" },
              { icon: Info, title: "Legal Assistance", desc: "Free consultation for partners", color: "bg-zinc-100 text-zinc-600" }
            ].map((s, i) => (
              <button key={i} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card shadow-soft ring-1 ring-border/60 text-left active:scale-[0.98] transition">
                 <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", s.color)}>
                    <s.icon className="h-5 w-5" />
                 </div>
                 <div className="flex-1">
                    <p className="text-sm font-bold">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                 </div>
                 <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
         </div>
      </section>
    </div>
  );
}
