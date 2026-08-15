import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { 
  ShoppingBag, Search, Filter, Star, Clock, 
  ChevronRight, ArrowRight, Package, Info, 
  Zap, Gift, ShieldCheck, CreditCard, X, Shield, ExternalLink, HelpCircle
} from "lucide-react";
import { cn } from "@/lib/format";
import { formatPrice } from "@/lib/format";
import { useLiveData } from "@/lib/realtime-hooks";
import { fetchBazaarCatalog, createBazaarRequest } from "@/lib/rider-api";
import { useDriver } from "@/lib/driver-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/rider/bazaar")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Bazaar" }] }),
  component: RiderBazaar,
});

const CATEGORIES = ["All", "Protection", "Gear", "Loans", "Fuel", "Health"];

function RiderBazaar() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [activeService, setActiveService] = useState<string | null>(null);
  const { driverId } = useDriver();
  
  const { data: items, loading } = useLiveData<any[]>(
    ["bazaar_items"],
    () => fetchBazaarCatalog(),
    []
  );

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => {
      const matchesCategory = activeCategory === "All" || item.category?.toLowerCase() === activeCategory.toLowerCase();
      const matchesSearch = !searchQuery || 
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, activeCategory, searchQuery]);

  const handleRequest = async (item: any) => {
    if (!driverId) {
      toast.error("Rider identity not resolved");
      return;
    }
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search equipment or services..." 
            className="w-full rounded-2xl bg-muted/50 px-10 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full bg-muted text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
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
      <div className="mb-8 rounded-[2.5rem] bg-zinc-900 p-6 text-white overflow-hidden relative shadow-pop">
         <div className="relative z-10">
            <span className="rounded-full bg-primary px-3 py-1 text-[9px] font-black uppercase tracking-widest">Featured</span>
            <h3 className="mt-3 font-display text-xl font-extrabold leading-tight">Accident Cover<br/>up to ₹5,00,000</h3>
            <p className="mt-2 text-xs text-white/60">Comprehensive insurance for you and your family.</p>
            <button 
              onClick={() => setShowCoverModal(true)}
              className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary group"
            >
              View Details <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
            </button>
         </div>
         <ShieldCheck className="absolute -bottom-4 -right-4 h-32 w-32 text-white/5" />
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-xs text-muted-foreground">Loading catalog...</div>
        ) : filteredItems.length === 0 ? (
          <div className="col-span-2 rounded-3xl bg-muted/30 p-8 text-center border-2 border-dashed border-border/60">
             <Package className="h-10 w-10 mx-auto text-muted/40 mb-3" />
             <p className="text-xs font-bold">No results found</p>
             <p className="text-[10px] text-muted-foreground mt-1">Try adjusting your filters or search.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
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
              { id: 'loan', icon: CreditCard, title: "Quick Cash Loan", desc: "Up to ₹20,000 instant credit", color: "bg-blue-50 text-blue-600" },
              { id: 'rewards', icon: Gift, title: "Scoobix Rewards", desc: "Redeem points for fuel vouchers", color: "bg-purple-50 text-purple-600" },
              { id: 'legal', icon: Info, title: "Legal Assistance", desc: "Free consultation for partners", color: "bg-zinc-100 text-zinc-600" }
            ].map((s) => (
              <button 
                key={s.id} 
                onClick={() => setActiveService(s.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card shadow-soft ring-1 ring-border/60 text-left active:scale-[0.98] transition"
              >
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

      {/* Accident Cover Modal */}
      {showCoverModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-5 animate-in fade-in duration-300">
           <div className="w-full max-w-sm rounded-[2.5rem] bg-card p-6 shadow-glow ring-1 ring-border/60 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                   <ShieldCheck className="h-6 w-6" />
                </div>
                <button onClick={() => setShowCoverModal(false)} className="rounded-full bg-muted p-2 hover:bg-muted/80 transition"><X className="h-4 w-4" /></button>
              </div>
              
              <h3 className="font-display text-xl font-extrabold italic uppercase tracking-tight">Accident Cover</h3>
              <p className="mt-2 text-sm text-muted-foreground">Comprehensive coverage of up to ₹5,00,000 for Scoobix partners.</p>
              
              <div className="mt-6 space-y-4">
                 <div className="p-4 rounded-2xl bg-muted/30 border border-border/40">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Coverage Scope</p>
                    <ul className="space-y-2 text-xs font-medium">
                       <li className="flex gap-2">
                          <div className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
                          <span>Accidental death or permanent disability: ₹5,00,000</span>
                       </li>
                       <li className="flex gap-2">
                          <div className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
                          <span>Hospitalization (IPD): Up to ₹50,000 per year</span>
                       </li>
                       <li className="flex gap-2">
                          <div className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
                          <span>OPD Expenses: Up to ₹5,000 per year</span>
                       </li>
                    </ul>
                 </div>
                 
                 <div className="p-4 rounded-2xl bg-muted/30 border border-border/40">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Eligibility</p>
                    <p className="text-xs leading-relaxed font-medium">
                       Active partners who have completed at least 50 orders in the last 30 days are automatically enrolled at no cost.
                    </p>
                 </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                 <Button onClick={() => { toast.success("Enrolled in Accident Cover!"); setShowCoverModal(false); }} className="rounded-2xl h-12 font-bold shadow-glow">Claim Benefits</Button>
                 <Button variant="ghost" onClick={() => setShowCoverModal(false)} className="rounded-2xl h-12 text-xs font-bold uppercase tracking-widest">Close</Button>
              </div>
           </div>
        </div>
      )}

      {/* Service Detail Modal */}
      {activeService && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-5 animate-in fade-in duration-300">
           <div className="w-full max-w-sm rounded-[2.5rem] bg-card p-6 shadow-glow ring-1 ring-border/60">
              <div className="flex items-center justify-between mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                   {activeService === 'loan' ? <CreditCard className="h-6 w-6" /> : 
                    activeService === 'rewards' ? <Gift className="h-6 w-6" /> : <HelpCircle className="h-6 w-6" />}
                </div>
                <button onClick={() => setActiveService(null)} className="rounded-full bg-muted p-2"><X className="h-4 w-4" /></button>
              </div>
              
              <h3 className="font-display text-xl font-extrabold italic uppercase tracking-tight">
                {activeService === 'loan' ? "Quick Cash Loan" : 
                 activeService === 'rewards' ? "Scoobix Rewards" : "Legal Assistance"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {activeService === 'loan' ? "Get instant personal loans up to ₹20,000 with minimal documentation and low interest rates." : 
                 activeService === 'rewards' ? "Earn points for every delivery and redeem them for fuel, mobile recharges, or Scoobix gear." : 
                 "Access free legal consultation and support for motor vehicle documentation, insurance claims, and road safety matters."}
              </p>

              <div className="mt-8 flex flex-col gap-3">
                 <Button onClick={() => { toast.info("Support ticket created. Our team will contact you shortly."); setActiveService(null); }} className="rounded-2xl h-12 font-bold shadow-glow">Apply Now</Button>
                 <Button variant="ghost" onClick={() => setActiveService(null)} className="rounded-2xl h-12 text-xs font-bold uppercase tracking-widest text-muted-foreground">Cancel</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

