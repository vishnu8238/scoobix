import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Search, RefreshCw, Bell, History as HistoryIcon, Send, 
  Users, MapPin, ShieldCheck, Clock, CheckCircle2, XCircle, 
  AlertCircle, Loader2, Info, ChevronRight
} from "lucide-react";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { 
  fetchPushRecipients, 
  fetchCampaignHistory, 
  dispatchNotificationCampaign,
  mapVerificationStatus,
  RiderProfile,
  LogisticsZone,
  RiderZoneAssignment,
  NotificationCampaign
} from "@/lib/push-notifications-api";
import { useTableVersion } from "@/lib/realtime-hooks";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/logistics/push-notifications")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Push Notifications" }] }),
  component: PushNotificationsPage,
});

function PushNotificationsPage() {
  const [activeTab, setActiveTab] = useState<"send" | "history">("send");
  
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Logistics Workspace</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Push Notifications</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select delivery partners and send targeted notifications.</p>
      </header>

      <div className="flex border-b border-border/40">
        <button
          onClick={() => setActiveTab("send")}
          className={cn(
            "px-6 py-3 text-sm font-bold transition-colors relative",
            activeTab === "send" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Send
          {activeTab === "send" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "px-6 py-3 text-sm font-bold transition-colors relative",
            activeTab === "history" ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          History
          {activeTab === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
        </button>
      </div>

      {activeTab === "send" ? <SendView /> : <HistoryView />}
    </div>
  );
}

function SendView() {
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [zones, setZones] = useState<LogisticsZone[]>([]);
  const [assignments, setAssignments] = useState<RiderZoneAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [zoneFilter, setZoneFilter] = useState("All");
  
  // Selection
  const [selection, setSelection] = useState<Set<string>>(new Set());
  
  // Composer
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const version = useTableVersion(["rider_profiles", "logistics_zones", "rider_zone_assignments"]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await fetchPushRecipients();
      setRiders(data.riders);
      setZones(data.zones);
      setAssignments(data.assignments);
    } catch (err) {
      console.error("Failed to load recipients", err);
      toast.error("Failed to load delivery partners");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, version]);

  const riderZoneMap = useMemo(() => {
    const map = new Map<string, string>();
    assignments.forEach(a => {
      const zone = zones.find(z => z.id === a.zone_id);
      if (zone) map.set(a.rider_profile_id, zone.name);
    });
    return map;
  }, [assignments, zones]);

  const filteredRiders = useMemo(() => {
    return riders.filter(r => {
      const vStatus = mapVerificationStatus(r.verification_status, r.docs_verified);
      const zone = riderZoneMap.get(r.id) || "Unassigned";
      
      const matchSearch = 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.driver_id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchStatus = statusFilter === "All" || vStatus === statusFilter;
      const matchZone = zoneFilter === "All" || zone === zoneFilter;
      
      return matchSearch && matchStatus && matchZone;
    });
  }, [riders, searchQuery, statusFilter, zoneFilter, riderZoneMap]);

  const handleSend = async () => {
    if (selection.size === 0 || !title || !message) return;
    
    setIsSending(true);
    try {
      const selectedRiderIds = Array.from(selection);
      await dispatchNotificationCampaign(title, message, selectedRiderIds, {
        status: statusFilter,
        zoneId: zones.find(z => z.name === zoneFilter)?.id || null
      });
      
      toast.success(`Successfully dispatched to ${selectedRiderIds.length} recipients`);
      setTitle("");
      setMessage("");
      setSelection(new Set());
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch notification");
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Filters & Table */}
      <div className="lg:col-span-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3 bg-card p-4 rounded-3xl border border-border/40 shadow-soft">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rider, phone, ID..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/40 text-sm font-medium outline-none ring-1 ring-border/40 focus:ring-primary/40"
            />
          </div>
          
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl bg-muted/40 text-[10px] font-black uppercase tracking-wider outline-none ring-1 ring-border/40"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select 
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="h-10 px-3 rounded-xl bg-muted/40 text-[10px] font-black uppercase tracking-wider outline-none ring-1 ring-border/40"
          >
            <option value="All">All Zones</option>
            {zones.map(z => <option key={z.id} value={z.name}>{z.name}</option>)}
          </select>

          <button 
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-muted/40 hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        </div>

        <div className="rounded-[2.5rem] bg-card p-6 shadow-card ring-1 ring-border/60 min-h-[400px]">
          {filteredRiders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="font-bold text-foreground">No matching riders</h3>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <DataTable
              columns={["Rider", "ID", "Phone", "Status", "Zone"]}
              selection={selection}
              onSelectionChange={setSelection}
              rows={filteredRiders.map(r => {
                const vStatus = mapVerificationStatus(r.verification_status, r.docs_verified);
                return [
                  <div key={`name-${r.id}`} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-xs">{r.name}</span>
                  </div>,
                  <span key={`id-${r.id}`} className="font-mono text-[10px] text-muted-foreground uppercase">{r.driver_id}</span>,
                  <span key={`phone-${r.id}`} className="text-xs font-medium">{r.phone || "—"}</span>,
                  <div key={`status-${r.id}`}>
                    <StatusBadge label={vStatus} />
                  </div>,
                  <div key={`zone-${r.id}`} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {riderZoneMap.get(r.id) || "—"}
                  </div>
                ];
              })}
            />
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="lg:col-span-4">
        <div className="sticky top-6 bg-card rounded-[2.5rem] p-6 shadow-card ring-1 ring-border/60 space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <div className="h-10 w-10 rounded-2xl bg-primary-soft flex items-center justify-center shadow-soft">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg">Send Notification</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Campaign Composer</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Recipients</span>
              <span className="text-primary">{selection.size} selected</span>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-bold">
              <span className="px-2 py-1 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                Status: {statusFilter}
              </span>
              <span className="px-2 py-1 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                Zone: {zoneFilter}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification Headline..."
                className="w-full h-11 px-4 rounded-xl bg-muted/40 text-sm font-medium outline-none ring-1 ring-border/40 focus:ring-primary/40"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Important updates for delivery partners..."
                rows={4}
                className="w-full p-4 rounded-xl bg-muted/40 text-sm font-medium outline-none ring-1 ring-border/40 focus:ring-primary/40 resize-none"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={selection.size === 0 || !title || !message || isSending}
              className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold shadow-glow transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Notification
                </>
              )}
            </button>
            
            <p className="text-[10px] text-center text-muted-foreground italic mt-2">
              Notifications will appear in the rider's in-app inbox immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryView() {
  const [history, setHistory] = useState<NotificationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const version = useTableVersion(["notification_campaigns"]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await fetchCampaignHistory();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, version]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Campaign History</h2>
        <button 
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border/40 text-[10px] font-black uppercase tracking-wider hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {history.length === 0 ? (
        <div className="bg-card rounded-[2.5rem] p-12 border border-border/40 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <HistoryIcon className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">No campaigns sent yet</h3>
            <p className="text-xs text-muted-foreground">Recent notification campaigns will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map(campaign => (
            <div key={campaign.id} className="bg-card rounded-3xl p-5 border border-border/40 shadow-soft space-y-4 flex flex-col">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-bold text-sm line-clamp-1">{campaign.title}</h3>
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {format(new Date(campaign.created_at), "MMM d, yyyy · HH:mm")}
                  </p>
                </div>
                <StatusBadge label={campaign.campaign_status} />
              </div>
              
              <p className="text-xs text-muted-foreground line-clamp-2 flex-1 italic">
                "{campaign.message}"
              </p>

              <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    Zone: {campaign.target_zone_id || "All Zones"}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <span className="block text-[8px] font-black uppercase text-muted-foreground opacity-60">Total</span>
                    <span className="font-black text-sm">{campaign.total_count}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[8px] font-black uppercase text-emerald-600">Sent</span>
                    <span className="font-black text-sm text-emerald-600">{campaign.sent_count}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[8px] font-black uppercase text-rose-600">Failed</span>
                    <span className="font-black text-sm text-rose-600">{campaign.failed_count}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
