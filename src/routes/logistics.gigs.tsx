import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState, useMemo } from "react";
import { insforge } from "@/lib/insforge";
import { 
  Search, 
  Plus, 
  Loader2, 
  Calendar, 
  RefreshCw, 
  Upload, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  MapPin,
  TrendingUp,
  Settings,
  History
} from "lucide-react";
import { fetchGigs, createGig, enrollInGig, fetchGigEnrollmentCounts, fetchGigEnrollmentData, deleteGig, bulkCancelGigs, bulkDeleteGigs, type Gig } from "@/lib/gigs-api";
import { format, addDays, startOfToday, parseISO, isAfter, subMonths, isWithinInterval, differenceInHours } from "date-fns";
import { GigCard, GigStats } from "@/components/admin/GigCard";
import { CreateGigModal } from "@/components/admin/CreateGigModal";
import { EditGigModal } from "@/components/admin/EditGigModal";
import { ImportGigsModal } from "@/components/admin/ImportGigsModal";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { exportExcel } from "@/lib/export-utils";
import { createRecord, listTable } from "@/lib/insforge-crud";
import { newUuid } from "@/lib/orders-api";
import { useTableVersion } from "@/lib/realtime-hooks";
import { PortalErrorBoundary } from "@/components/cravio/PortalErrorBoundary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/logistics/gigs")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Gig Management" }] }),
  component: LogisticsGigs,
});

function LogisticsGigs() {
  const [activeTab, setActiveTab] = useState<"fleet" | "slots" | "capacity">("fleet");
  const [dateFilterMode, setDateFilterMode] = useState<"selected" | "all" | "last2months">("selected");
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [enrollmentData, setEnrollmentData] = useState<Record<string, { count: number; completed_deliveries: number }>>({});
  const enrollmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(enrollmentData).forEach(id => {
      counts[id] = enrollmentData[id].count;
    });
    return counts;
  }, [enrollmentData]);
  const [allGigsCount, setAllGigsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState(format(startOfToday(), "yyyy-MM-dd"));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>({ initial: true });
  const [isTesting, setIsTesting] = useState(false);
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedGigIds, setSelectedGigIds] = useState<string[]>([]);


  // Filters for Slots/Capacity
  const [city, setCity] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [zone, setZone] = useState("all");
  const [citiesMap, setCitiesMap] = useState<Record<string, string>>({});
  const [zonesMap, setZonesMap] = useState<Record<string, string>>({});

  // Real-time sync
  const version = useTableVersion(["gigs", "rider_gig_enrollments"]);

  // NOTE: seedDemos removed; page is read-only for operational data.

  const load = useCallback(async () => {
    setLoading(true);
    try {
      console.log("[GIGS_PAGE] Loading authoritative canonical list...");
      
      // seedDemos removed; operational read-only only.

      // 1. Authoritative fetch
      let all = await fetchGigs({ limit: 1000 });
      console.log(`[GIGS_PAGE] Loaded ${all.length} normalized rows.`);

      // 2. Fetch authoritative enrollment data
      const gigIds = all.map(g => g.id);
      const dataMap = await fetchGigEnrollmentData(gigIds);
      setEnrollmentData(dataMap);

      // Fetch Cities & Zones for mapping
      const { fetchCities, fetchZones } = await import("@/lib/zones-api");
      const [cities, zones] = await Promise.all([fetchCities(), fetchZones()]);
      
      const cMap: Record<string, string> = {};
      cities.forEach(c => cMap[c.id] = c.name);
      setCitiesMap(cMap);

      const zMap: Record<string, string> = {};
      zones.forEach(z => zMap[z.id] = z.name);
      setZonesMap(zMap);
      
      // 3. Date key normalization for Asia/Kolkata
      const getKolkataDateKey = (dateInput: string | Date) => {
        try {
          const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
          if (isNaN(date.getTime())) return null;
          return new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'Asia/Kolkata', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
          }).format(date);
        } catch (e) {
          return null;
        }
      };
      
      // 4. Normalized filtering & data enrichment (Exclude demo/non-operational)
      const data = all.filter(g => {
        if (g.metadata?.is_demo === true) return false;

        // Requirement: show all non-demo persisted rows with honest unavailable states.
        // Remove filters that exclude rows with null canonical fields or specific statuses.
        
        if (dateFilterMode === "all") return true;

        if (dateFilterMode === "last2months") {
          if (!g.start_time) return false; // Incomplete rows stay hidden in temporal views
          const startTime = new Date(g.start_time);
          const twoMonthsAgo = subMonths(new Date(), 2);
          const today = new Date();
          return isWithinInterval(startTime, { start: twoMonthsAgo, end: today });
        }

        // Selected Date filter: only show if start_time exists and matches
        if (!g.start_time) return false;
        const gigDateKey = getKolkataDateKey(g.start_time);
        return gigDateKey === selectedDateKey;
      }).map(g => ({
        ...g,
        enrolled_count: enrollmentCounts[g.id] || 0
      }));
      
      setGigs(data);
      setAllGigsCount(all.length);
      
      setDiagnostics({
        lastLoad: new Date().toISOString(),
        total: all.length,
        filtered: data.length,
        filterDate: selectedDateKey,
        businessTimezone: 'Asia/Kolkata',
        firstGig: all[0] ? { id: all[0].id, title: all[0].title, isDemo: !!all[0].metadata?.is_demo } : "none",
        sessionActive: !!insforge.auth.session?.accessToken,
        tokenPrefix: insforge.auth.session?.accessToken ? insforge.auth.session.accessToken.substring(0, 10) : "none"
      });
    } catch (err: any) {
      console.error("[GIGS_PAGE] Authoritative load failed:", err);
      // Error path handled by toast
      setGigs([]);

      const errorMsg = err.message || "Unknown database error";
      toast.error(`Failed to load gigs: ${errorMsg}`);
      setDiagnostics({ 
        error: errorMsg, 
        status: err.status,
        session: !!insforge.auth.session?.accessToken,
        timestamp: new Date().toISOString()
      });
      setGigs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDateKey, dateFilterMode]);




  useEffect(() => { void load(); }, [load, version]);

  const dates = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(startOfToday(), i - 1);
    return {
      date: d,
      key: format(d, "yyyy-MM-dd")
    };
  });

  const filteredGigs = gigs.filter(g => 
    !q || (g.title || "").toLowerCase().includes(q.toLowerCase())
  );

  const handleSelectGig = (id: string, selected: boolean) => {
    setSelectedGigIds(prev => 
      selected ? [...prev, id] : prev.filter(x => x !== id)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedGigIds(filteredGigs.map(g => g.id));
    } else {
      setSelectedGigIds([]);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedGigIds.length === 0) return;
    
    const selectedGigs = gigs.filter(g => selectedGigIds.includes(g.id));
    const startedGigs = selectedGigs.filter(g => g.start_time && isAfter(new Date(), new Date(g.start_time)));
    
    if (startedGigs.length > 0) {
      toast.warning(`${startedGigs.length} gigs have already started and cannot be cancelled.`);
    }

    const cancellableIds = selectedGigs
      .filter(g => !g.start_time || !isAfter(new Date(), new Date(g.start_time)))
      .map(g => g.id);

    if (cancellableIds.length === 0) return;
    
    const zeroEnrollmentIds = cancellableIds.filter(id => (enrollmentCounts[id] || 0) === 0);
    const enrolledIds = cancellableIds.filter(id => (enrollmentCounts[id] || 0) > 0);
    const totalEnrollments = enrolledIds.reduce((acc, id) => acc + (enrollmentCounts[id] || 0), 0);
    
    if (!confirm(`Are you sure you want to process ${cancellableIds.length} gigs?\n- ${zeroEnrollmentIds.length} will be permanently deleted\n- ${enrolledIds.length} will be cancelled (${totalEnrollments} riders notified)`)) {
      return;
    }

    setLoading(true);
    try {
      if (zeroEnrollmentIds.length > 0) {
        await bulkDeleteGigs(zeroEnrollmentIds);
      }
      if (enrolledIds.length > 0) {
        await bulkCancelGigs(enrolledIds);
      }
      
      toast.success(`Processed ${cancellableIds.length} gigs successfully`);
      setSelectedGigIds([]);
      load();
    } catch (err: any) {
      toast.error("Bulk processing failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGig = async (gig: Gig) => {
    const count = enrollmentCounts[gig.id] || 0;
    
    // Per contract: 0 enrollment = permanent delete (even if past started)
    // >0 enrollment = cancellation (past start check applies)
    if (count > 0) {
      const isStarted = gig.start_time && isAfter(new Date(), new Date(gig.start_time));
      if (isStarted) {
        toast.error("Cannot cancel a gig that has already started.");
        return;
      }
    }

    const outcome = count > 0 
      ? "changing status to CANCELLED (enrollments will be preserved)" 
      : "PERMANENTLY deleting this gig (zero enrollments)";
    
    if (!confirm(`Are you sure you want to proceed?\n\nReal Outcome: ${outcome}\n\nThis action cannot be undone.`)) return;

    setLoading(true);
    try {
      await deleteGig(gig.id, count);
      toast.success(`Gig ${count > 0 ? "cancelled" : "deleted"} successfully`);
      setIsEditModalOpen(false);
      setEditingGig(null);
      load();
    } catch (err: any) {
      toast.error("Operation failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (filteredGigs.length === 0) {
      toast.info("No gigs to export for the selected filters.");
      return;
    }

    const columns = [
      { key: "id", label: "Gig ID" },
      { key: "date", label: "Date" },
      { key: "start_time", label: "Start Time" },
      { key: "end_time", label: "End Time" },
      { key: "duration", label: "Duration" },
      { key: "city", label: "City" },
      { key: "zone", label: "Zone" },
      { key: "reward_amount", label: "Payout" },
      { key: "enrolled", label: "Enrollment" },
      { key: "capacity", label: "Capacity" },
      { key: "completion_percentage", label: "Completion %" },
      { key: "status", label: "Status" },
    ];

    const rows = filteredGigs.map(g => {
      let duration = "";
      if (g.start_time && g.end_time) {
        const start = new Date(g.start_time);
        const end = new Date(g.end_time);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          duration = `${diffHours.toFixed(1)}h`;
        }
      }

      let resolvedCompletion: string | number = "";
      if (typeof g.completion_pct === 'number' && g.completion_pct >= 0 && g.completion_pct <= 100) {
        resolvedCompletion = g.completion_pct;
      } else if (g.target_deliveries && g.target_deliveries > 0) {
        const completed = enrollmentData[g.id]?.completed_deliveries || 0;
        resolvedCompletion = Math.min(100, Math.max(0, (completed / g.target_deliveries) * 100));
      }

      const completionPercentage = resolvedCompletion !== "" ? `${Math.round(Number(resolvedCompletion))}%` : "";

      return {
        id: g.id,
        date: g.start_time ? (g.start_time.includes('T') ? g.start_time.split('T')[0] : g.start_time) : "",
        start_time: g.start_time || "",
        end_time: g.end_time || "",
        duration,
        city: g.city_id || "",
        zone: g.zone_id || "",
        reward_amount: g.reward_amount || 0,
        enrolled: enrollmentCounts[g.id] || 0,
        capacity: typeof g.capacity === "number" ? g.capacity : "",
        completion_percentage: completionPercentage,
        status: g.status || "",
      };

    });

    exportExcel([{
      title: `Gigs - ${selectedDateKey}`,
      columns,
      rows: rows as any[]
    }], `scoobix-gigs-${selectedDateKey}`);
    
    toast.success("Excel export started.");
  };

  return (
    <PortalErrorBoundary portal="Logistics Gigs">
      <div>


      <div className="space-y-6 bg-slate-50/50 p-8 dark:bg-transparent">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">
              {activeTab === "fleet" ? "Fleet Gig Management" : activeTab === "slots" ? "Slots Details" : "Capacity Change"}
            </h1>
            <p className="mt-1 text-sm font-bold text-muted-foreground/60">Manage delivery slots and rider incentives for the fleet</p>
          </div>
        </header>
        
        <div className="flex flex-wrap items-center gap-3">
          <GigStats 
            totalGigs={allGigsCount ?? gigs.length} 
            needed={gigs.reduce((acc, g) => acc + (typeof g.capacity === "number" ? g.capacity : 0), 0)} 
            enrolled={gigs.reduce((acc, g) => acc + (g as any).enrolled_count || 0, 0)} 
            fullyBooked={gigs.filter(g => typeof g.capacity === "number" && (g as any).enrolled_count >= g.capacity).length} 
          />

          
          <div className="flex items-center gap-2 border-l border-border/60 pl-3">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              title="Import Gigs"
              className="group flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border/60 transition-all hover:bg-muted active:scale-95"
            >
              <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </button>
            <button 
              onClick={() => handleExport()}
              disabled={loading || filteredGigs.length === 0}
              title="Export Excel"
              className="group flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border/60 transition-all hover:bg-muted active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </button>

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
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-muted/30 p-1 w-fit ring-1 ring-border/40 mx-8 mb-6">
        {[
          { id: "fleet", label: "Fleet Gigs" },
          { id: "slots", label: "Slots Details" },
          { id: "capacity", label: "Capacity Change" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-6 py-2 rounded-xl text-xs font-black transition-all",
              activeTab === tab.id ? "bg-card text-primary shadow-sm ring-1 ring-border/60" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "fleet" ? (
        <div className="px-8 pb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1 ring-1 ring-border/60 dark:bg-slate-800/50">
                <button
                  onClick={() => setDateFilterMode("all")}
                  className={cn(
                    "rounded-xl px-4 py-2 text-[10px] font-black transition-all",
                    dateFilterMode === "all"
                      ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                  )}
                >
                  All Gigs
                </button>
                <button
                  onClick={() => setDateFilterMode("last2months")}
                  className={cn(
                    "rounded-xl px-4 py-2 text-[10px] font-black transition-all",
                    dateFilterMode === "last2months"
                      ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                  )}
                >
                  Last 2 Months
                </button>
              </div>
              
              <input 
                type="date"
                value={selectedDateKey}
                onChange={(e) => {
                  setSelectedDateKey(e.target.value);
                  setDateFilterMode("selected");
                }}
                className="h-10 px-4 rounded-xl border border-border/60 bg-card text-[10px] font-black transition-all hover:bg-muted active:scale-95 outline-none focus:ring-2 focus:ring-emerald-500/20"
              />

              <div className="h-6 w-px bg-border/60 mx-1 hidden sm:block" />

              <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border/60 hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50/50 p-1 ring-1 ring-emerald-100 dark:bg-emerald-950/20 dark:ring-emerald-900/30">
                {dates.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => {
                      setSelectedDateKey(d.key);
                      setDateFilterMode("selected");
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black transition-all",
                      d.key === selectedDateKey && dateFilterMode === "selected"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                        : "text-emerald-700 hover:bg-emerald-100/50 dark:text-emerald-400"
                    )}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    {format(d.date, "EEE, dd MMM")}
                  </button>
                ))}
              </div>
              
              <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-card ring-1 ring-border/60 hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>

              {dateFilterMode !== "all" && (
                <button
                  onClick={() => setDateFilterMode("all")}
                  className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black text-slate-500 hover:text-rose-600 transition-colors"
                >
                  <History className="h-3.5 w-3.5" />
                  Clear date / Show all
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-card p-2 ring-1 ring-border/60">
                <input 
                  type="checkbox"
                  checked={selectedGigIds.length === filteredGigs.length && filteredGigs.length > 0}
                  ref={el => {
                    if (el) el.indeterminate = selectedGigIds.length > 0 && selectedGigIds.length < filteredGigs.length;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded-md border-border/60 bg-muted/50 accent-primary focus:ring-primary/40 transition-all cursor-pointer ml-2"
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mr-2">Select All</span>
              </div>

              <div className="relative flex h-10 items-center rounded-xl bg-card px-3 ring-1 ring-border/60 focus-within:ring-primary/40">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input 
                  value={q} 
                  onChange={(e) => setQ(e.target.value)} 
                  placeholder="Search gigs..."
                  className="ml-2 w-48 bg-transparent text-xs font-bold outline-none"
                />
              </div>
            </div>
          </div>

          {selectedGigIds.length > 0 && (
            <div className="sticky top-4 z-20 mb-6 flex items-center justify-between rounded-[2rem] bg-slate-900 px-8 py-4 text-white shadow-2xl ring-1 ring-white/10 dark:bg-slate-900/90 dark:backdrop-blur-xl">
              <div className="flex items-center gap-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black tracking-tight">{selectedGigIds.length} Gigs Selected</p>
                  <p className="text-[10px] font-bold text-white/50">Manage bulk actions for the selected fleet slots</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedGigIds([])}
                  className="px-6 py-2.5 rounded-xl text-xs font-black hover:bg-white/10 transition active:scale-[0.98]"
                >
                  Clear Selection
                </button>
                <button 
                  onClick={handleBulkCancel}
                  className="flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-rose-950/20 hover:bg-rose-700 transition active:scale-[0.98]"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Selected
                </button>
              </div>
            </div>
          )}

          <section>
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-2 dark:bg-emerald-950/50">
                  <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {dateFilterMode === "all" ? `All Persistent Gigs (${filteredGigs.length})` : 
                   dateFilterMode === "last2months" ? `Gigs from Last 2 Months (${filteredGigs.length})` :
                   `Gigs for ${format(parseISO(selectedDateKey), "EEE dd MMM").toUpperCase()} (${filteredGigs.length})`}
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
                  <GigCard 
                    key={gig.id} 
                    gig={gig} 
                    enrollmentCount={enrollmentData[gig.id]?.count || 0}
                    completedDeliveries={enrollmentData[gig.id]?.completed_deliveries || 0}
                    selected={selectedGigIds.includes(gig.id)}
                    onSelect={handleSelectGig}
                    onEdit={(g) => {
                      setEditingGig(g);
                      setIsEditModalOpen(true);
                    }}
                    onDelete={handleDeleteGig}
                    citiesMap={citiesMap}
                    zonesMap={zonesMap}
                  />
                ))}
              </div>

            )}
            {diagnostics && (
              <div className="mt-8 rounded-2xl bg-slate-900/5 p-6 text-[10px] font-mono text-slate-500 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10">
                <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-2">
                  <p className="font-black uppercase tracking-widest text-slate-400">Live Production Diagnostics</p>
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", diagnostics.error || diagnostics.testError ? "bg-rose-500 animate-pulse" : "bg-emerald-500")} />
                    <span className="font-bold text-[9px]">
                      {diagnostics.error || diagnostics.testError ? "ISSUE DETECTED" : "SYNCED"}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground uppercase text-[8px] font-black">Canonical Table</span>
                    <span className="text-primary font-bold text-xs">{diagnostics.activeTable || "gigs"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground uppercase text-[8px] font-black">Verified Persistence</span>
                    <span className={cn("font-bold text-xs", (diagnostics.total > 0 || (diagnostics.testError && diagnostics.testError.success)) ? "text-emerald-500" : "text-amber-500")}>
                      {diagnostics.total ?? 0} Rows Found
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground uppercase text-[8px] font-black">Calendar Filter</span>
                    <span className="text-foreground font-bold text-xs">{diagnostics.filterDate}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground uppercase text-[8px] font-black">Filtered View</span>
                    <span className="text-foreground font-bold text-xs">{diagnostics.filtered ?? 0} Gigs Shown</span>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <button 
                    onClick={() => void load()}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-[9px] font-black text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Retry Load
                  </button>
                  <p className="text-[9px] font-bold text-muted-foreground/60 italic">Refreshing operational data from authoritative tables</p>
                </div>

                {diagnostics.testError && (
                  <div className={cn(
                    "mt-4 rounded-xl p-3 ring-1",
                    diagnostics.testError.success ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20" : "bg-rose-500/10 text-rose-500 ring-rose-500/20"
                  )}>
                    <p className="font-black uppercase text-[8px] mb-1">Test Result: {diagnostics.testError.success ? "PASSED" : "FAILED"}</p>
                    <div className="space-y-1">
                      {diagnostics.testError.success ? (
                        <p>ID: {diagnostics.testError.testRecordId} | User: {diagnostics.testError.userId} | List: {diagnostics.testError.listCount}</p>
                      ) : (
                        <>
                          <p>Error: {diagnostics.testError.error}</p>
                          {diagnostics.testError.details && <p className="opacity-70">Details: {diagnostics.testError.details}</p>}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      ) : activeTab === "slots" ? (
        <SlotsDetailsView 
          gigs={gigs}
          citiesMap={citiesMap}
          zonesMap={zonesMap}
          city={city} setCity={setCity}
          zone={zone} setZone={setZone}
          date={parseISO(selectedDateKey)}
        />
      ) : (
        <CapacityChangeView 
          gigs={gigs}
          citiesMap={citiesMap}
          city={city} setCity={setCity}
          zone={zone} setZone={setZone}
          date={parseISO(selectedDateKey)}
        />
      )}

      <CreateGigModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={load}
      />

      <EditGigModal 
        gig={editingGig}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingGig(null);
        }}
        onSuccess={load}
      />

      <ImportGigsModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={load}
      />
      </div>
    </PortalErrorBoundary>
  );
}

function SlotsDetailsView({ gigs, citiesMap, zonesMap, city, setCity, zone, setZone, date }: any) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap gap-4 items-center">
        <FilterSelect label="City" value={city} onChange={setCity} options={Object.values(citiesMap)} />
        <div className="flex flex-col gap-1.5 opacity-50">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Entity Type</label>
          <div className="h-10 px-4 flex items-center bg-card rounded-xl ring-1 ring-border/60 font-bold text-xs text-muted-foreground">
            Unavailable
          </div>
        </div>
        <FilterSelect label="Zone" value={zone} onChange={setZone} options={Object.values(zonesMap)} />
        <div className="flex flex-col gap-1.5 opacity-50">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Carrier</label>
          <div className="h-10 px-4 flex items-center bg-card rounded-xl ring-1 ring-border/60 font-bold text-xs text-muted-foreground">
            Unavailable
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Date</label>
          <div className="h-10 px-4 flex items-center bg-card rounded-xl ring-1 ring-border/60 font-bold text-xs">
            {format(date, "dd-MM-yyyy")}
          </div>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-card p-1 shadow-soft ring-1 ring-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40">
                {["Capacity ID", "Start Time", "End Time", "Total Capacity", "Available", "Booked %", "Min Earnings", "Max Earnings"].map(h => (
                  <th key={h} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
                {gigs.length > 0 ? (
                  gigs.map((g: Gig) => (
                    <tr key={g.id} className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-[10px] font-black text-primary">{g.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-xs font-bold">{g.start_time ? format(parseISO(g.start_time), "HH:mm") : "Unavailable"}</td>
                      <td className="px-6 py-4 text-xs font-bold">{g.end_time ? format(parseISO(g.end_time), "HH:mm") : "Unavailable"}</td>
                      <td className="px-6 py-4 text-xs font-bold">{typeof g.capacity === "number" ? g.capacity : "Unavailable"}</td>
                      <td className="px-6 py-4 text-xs font-bold text-emerald-600">{typeof g.capacity === "number" ? Math.max(0, g.capacity - ((g as any).enrolled_count || 0)) : "Unavailable"}</td>
                      <td className="px-6 py-4 text-xs font-bold">{typeof g.capacity === "number" && g.capacity > 0 ? `${Math.round(((g as any).enrolled_count || 0) / g.capacity * 100)}%` : "Unavailable"}</td>

                      <td className="px-6 py-4 text-xs font-black">₹{g.reward_amount || 0}</td>
                      <td className="px-6 py-4 text-xs font-black text-slate-400">Fixed</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-xs font-black text-muted-foreground">No active gig slots found.</td></tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CapacityChangeView({ gigs, citiesMap, city, setCity, zone, setZone, date }: any) {
  const [mode, setMode] = useState<"view" | "create">("view");
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCapacityChange = (gigId: string, value: string) => {
    const val = parseInt(value);
    if (!isNaN(val) && val > 0) {
      setDrafts(prev => ({ ...prev, [gigId]: val }));
    }
  };

  const handleSave = async () => {
    const changedIds = Object.keys(drafts);
    if (changedIds.length === 0) {
      toast.info("No capacity changes to save.");
      return;
    }

    setIsUpdating(true);
    try {
      const { updateGigCapacity } = await import("@/lib/gigs-api");
      const results = await Promise.all(
        changedIds.map(id => updateGigCapacity(id, drafts[id]))
      );
      
      toast.success(`Successfully updated capacity for ${results.length} gig(s)`);
      setDrafts({});
      setMode("view");
    } catch (err: any) {
      toast.error(`Failed to update capacity: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <FilterSelect label="City" value={city} onChange={setCity} options={Object.values(citiesMap)} />
          <div className="flex flex-col gap-1.5 opacity-50">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Entity Type</label>
            <div className="h-10 px-4 flex items-center bg-card rounded-xl ring-1 ring-border/60 font-bold text-xs text-muted-foreground">
              Unavailable
            </div>
          </div>
          <div className="flex flex-col gap-1.5 opacity-50">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Entity Name</label>
            <div className="h-10 px-4 flex items-center bg-card rounded-xl ring-1 ring-border/60 font-bold text-xs text-muted-foreground">
              Unavailable
            </div>
          </div>
          <div className="flex flex-col gap-1.5 opacity-50">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Carrier</label>
            <div className="h-10 px-4 flex items-center bg-card rounded-xl ring-1 ring-border/60 font-bold text-xs text-muted-foreground">
              Unavailable
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setMode("view")}
            className={cn("px-4 py-2 rounded-xl text-xs font-black transition", mode === "view" ? "bg-primary text-white shadow-glow" : "bg-card hover:bg-muted")}
          >
            View
          </button>
          <button 
            onClick={() => setMode("create")}
            className={cn("px-4 py-2 rounded-xl text-xs font-black transition", mode === "create" ? "bg-primary text-white shadow-glow" : "bg-card hover:bg-muted")}
          >
            Create
          </button>
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-card p-8 shadow-soft ring-1 ring-border/60">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-display text-lg font-extrabold">{mode === "create" ? "Bulk Capacity Update" : "Current Capacity Configuration"}</h3>
          <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-[10px] font-black text-white hover:bg-slate-800 transition active:scale-95">Get Slots</button>
        </div>

        <div className="space-y-4">
          {gigs.length > 0 ? (
            gigs.map((g: Gig) => {
              const currentCapacity = typeof g.capacity === "number" ? g.capacity : 0;
              const newCapacity = drafts[g.id] ?? currentCapacity;
              
              return (
                <div key={g.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 ring-1 ring-border/40">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-card font-black text-xs uppercase">{g.id.slice(0, 2)}</div>
                    <div>
                      <p className="text-xs font-black">{g.title || "Unavailable"}</p>
                      <p className="text-[10px] font-medium text-muted-foreground">Persisted Capacity: {currentCapacity || "Unavailable"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Update Capacity</span>
                      <input 
                        type="number" 
                        min="1"
                        value={newCapacity || ""}
                        onChange={(e) => handleCapacityChange(g.id, e.target.value)}
                        className="w-20 h-10 px-3 bg-card rounded-xl ring-1 ring-border/60 text-xs font-black text-center outline-none focus:ring-primary/40"
                        disabled={mode === "view" || isUpdating}
                      />
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">New Total</span>
                      <span className={cn(
                        "h-10 px-4 flex items-center font-black",
                        newCapacity !== currentCapacity ? "text-primary" : "text-emerald-600"
                      )}>
                        {newCapacity || "Unavailable"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs font-black text-muted-foreground">No eligible gigs found for capacity adjustment.</div>
          )}
        </div>

        {mode === "create" && (
          <div className="mt-8 flex justify-end gap-3 border-t border-border/40 pt-6">
            <button 
              onClick={() => { setDrafts({}); setMode("view"); }}
              className="px-6 py-2.5 rounded-xl text-xs font-black bg-muted hover:bg-muted/80 transition active:scale-95"
              disabled={isUpdating}
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={isUpdating || Object.keys(drafts).length === 0}
              className="px-8 py-2.5 rounded-xl text-xs font-black bg-primary text-white shadow-glow hover:opacity-90 transition active:scale-95 flex items-center gap-2"
            >
              {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


function FilterSelect({ label, value, onChange, options }: any) {
  const allLabel = label === "Zone" ? "All zones" : "All cities";
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="h-10 pl-3 pr-8 bg-card rounded-xl ring-1 ring-border/60 text-xs font-bold outline-none focus:ring-primary/40"
      >
        <option value="all">{allLabel}</option>
        {options.map((o: any) => <option key={o} value={o.toLowerCase()}>{o}</option>)}
      </select>
    </div>
  );
}
