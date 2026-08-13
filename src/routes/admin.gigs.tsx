import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Search, Plus, Loader2, Calendar, RefreshCw, Upload, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchGigs, type Gig } from "@/lib/gigs-api";
import { format, addDays, startOfToday } from "date-fns";
import { GigCard, GigStats } from "@/components/admin/GigCard";
import { CreateGigModal } from "@/components/admin/CreateGigModal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/gigs")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Gig Management" }] }),
  component: AdminGigs,
});

function AdminGigs() {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchGigs();
    setGigs(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dates = Array.from({ length: 7 }).map((_, i) => addDays(startOfToday(), i - 1));

  const filteredGigs = gigs.filter(g => 
    g.title.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="min-h-screen space-y-8 bg-slate-50/50 p-8 dark:bg-transparent">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">Gig Management</h1>
          <p className="mt-1 text-sm font-bold text-muted-foreground/60">Create and manage delivery gigs and shifts</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <GigStats 
            totalGigs={gigs.length} 
            needed={1080} 
            enrolled={162} 
            fullyBooked={0} 
          />
          
          <div className="flex items-center gap-2 border-l border-border/60 pl-3">
            <button 
              onClick={() => load()}
              className="group flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border/60 transition-all hover:bg-muted active:scale-95"
            >
              <RefreshCw className={cn("h-4 w-4 transition-transform group-active:rotate-180", loading && "animate-spin")} />
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-700 active:scale-95"
            >
              <Plus className="h-4 w-4" /> Create New Gig
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition-all hover:bg-slate-800 active:scale-95 dark:bg-slate-100 dark:text-slate-900">
              <Upload className="h-4 w-4" /> Upload Excel
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-card px-4 py-2 text-xs font-black ring-1 ring-border/60 transition-all hover:bg-muted active:scale-95">
              <Download className="h-4 w-4" /> Download Sample Excel
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border/60">
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50/50 p-1 ring-1 ring-emerald-100 dark:bg-emerald-950/20 dark:ring-emerald-900/30">
            {dates.map((date) => (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black transition-all",
                  format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                    : "text-emerald-700 hover:bg-emerald-100/50 dark:text-emerald-400"
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                {format(date, "EEE, dd MMM, yyyy")}
              </button>
            ))}
          </div>
          
          <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border/60">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex h-10 items-center rounded-xl bg-card px-3 ring-1 ring-border/60 focus-within:ring-primary/40">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="Search gigs..."
              className="ml-2 w-48 bg-transparent text-xs font-bold outline-none"
            />
          </div>
          <div className="flex h-10 items-center gap-2 rounded-xl bg-card px-3 font-mono text-xs font-black ring-1 ring-border/60">
            {format(selectedDate, "dd-MM-yyyy")}
            <Calendar className="h-3.5 w-3.5 opacity-40" />
          </div>
        </div>
      </div>

      <section>
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2 dark:bg-emerald-950/50">
              <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Gigs for {format(selectedDate, "EEEE").toUpperCase()}
            </h2>
          </div>
          <div className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            {filteredGigs.length} Gigs
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredGigs.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[3rem] bg-card/50 ring-1 ring-border/40">
            <div className="mb-4 rounded-full bg-muted p-6">
              <Calendar className="h-12 w-12 text-muted-foreground/30" />
            </div>
            <p className="text-lg font-black text-slate-900 dark:text-white">No gigs available</p>
            <p className="text-sm font-bold text-muted-foreground/60">Try selecting another date or adjusting your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredGigs.map((gig) => (
              <GigCard key={gig.id} gig={gig} />
            ))}
          </div>
        )}
      </section>

      <CreateGigModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={load}
      />
    </div>
  );
}
