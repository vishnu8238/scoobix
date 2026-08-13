import { useState, useEffect } from "react";
import { 
  X, Search, UserPlus, MapPin, Star, Truck, Loader2, 
  ChevronRight, CheckCircle2, AlertCircle, Phone, Info
} from "lucide-react";
import { listTable, patchRecord } from "@/lib/insforge-crud";
import { isUuid } from "@/lib/orders-api";
import { cn } from "@/lib/format";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit-api";

interface AssignRiderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onAssigned: () => void;
  currentRiderId?: string;
  zoneId?: string;
}

export function AssignRiderModal({ 
  isOpen, onClose, orderId, onAssigned, currentRiderId, zoneId 
}: AssignRiderModalProps) {
  const [search, setSearch] = useState("");
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void loadRiders();
    }
  }, [isOpen, zoneId]);

  const loadRiders = async () => {
    setLoading(true);
    try {
      const params: any = { 
        online_status: "eq.true",
        order: "rating.desc",
        limit: 50
      };
      
      if (zoneId) {
        params.zone_id = `eq.${zoneId}`;
      }

      const data = await listTable("drivers", params);
      
      if (data.length > 0) {
        const userIds = data.map(d => (d as any).user_id).filter(id => !!id);
        if (userIds.length > 0) {
          const users = await listTable("users", { id: `in.(${userIds.join(",")})` });
          const userMap = Object.fromEntries(users.map(u => [(u as any).id, u]));
          setRiders(data.map(d => ({
            ...d,
            user: userMap[(d as any).user_id] || {}
          })));
        } else {
          setRiders(data);
        }
      } else {
        setRiders([]);
      }
    } catch (error) {
      console.error("Failed to load riders:", error);
      toast.error("Failed to load available riders");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (riderId: string) => {
    setAssigningId(riderId);
    try {
      const ok = await patchRecord("orders", orderId, { 
        driver_id: riderId,
        status: "ASSIGNED",
        assignment_status: "COMPLETED"
      });

      if (ok) {
        await logAudit({
          category: "admin",
          subjectType: "order",
          subjectId: orderId,
          action: "RIDER_ASSIGNED",
          summary: `Manual rider assignment: ${riderId}`,
        });
        toast.success("Rider assigned successfully");
        onAssigned();
        onClose();
      } else {
        toast.error("Failed to assign rider");
      }
    } catch (error) {
      toast.error("An error occurred during assignment");
    } finally {
      setAssigningId(null);
    }
  };

  if (!isOpen) return null;

  const filteredRiders = riders.filter(r => 
    (r.user?.name || r.name || "").toLowerCase().includes(search.toLowerCase()) ||
    String(r.id || "").includes(search)
  );

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-2xl bg-card rounded-[2.5rem] shadow-glow ring-1 ring-border/60 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-8 border-b border-border/40 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <UserPlus className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-display font-black tracking-tight">Assign Rider</h2>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Order ID: <span className="text-foreground">#{orderId.slice(0, 8)}</span> · 
              <span className="ml-2 text-emerald-500 font-bold">{riders.length} AVAILABLE</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search */}
        <div className="px-8 py-4 bg-muted/20 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-11 pr-4 bg-background rounded-2xl border-none ring-1 ring-border/60 focus:ring-2 focus:ring-primary font-bold text-sm transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              <p className="font-bold uppercase tracking-widest text-xs">Finding available riders...</p>
            </div>
          ) : filteredRiders.length > 0 ? (
            filteredRiders.map((rider) => (
              <div 
                key={rider.id}
                className={cn(
                  "group relative p-4 rounded-[2rem] bg-card ring-1 transition-all duration-300",
                  currentRiderId === rider.id 
                    ? "ring-primary bg-primary/5 shadow-glow" 
                    : "ring-border/40 hover:ring-border hover:bg-muted/30 hover:shadow-lg"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img 
                      src={rider.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rider.id}`} 
                      className="h-14 w-14 rounded-2xl object-cover ring-2 ring-background shadow-sm"
                      alt=""
                    />
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-background shadow-sm" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base truncate">{rider.user?.name || rider.name || "Unknown Rider"}</h4>
                      {currentRiderId === rider.id && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          Currently Assigned
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                        <Star className="h-3 w-3 fill-amber-500" />
                        {rider.rating || "5.0"}
                      </div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        ID: #{String(rider.id).slice(0, 8)}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        <Phone className="h-3 w-3" />
                        {rider.user?.phone || rider.phone || "N/A"}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleAssign(rider.id)}
                    disabled={assigningId !== null || currentRiderId === rider.id}
                    className={cn(
                      "h-10 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                      currentRiderId === rider.id
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-emerald-500 text-white shadow-glow hover:scale-105 active:scale-95 disabled:opacity-50"
                    )}
                  >
                    {assigningId === rider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Assign"
                    )}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
              <div className="h-16 w-16 rounded-3xl bg-muted flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="font-display font-black text-lg text-foreground">No Riders Available</p>
              <p className="text-sm font-medium mt-1">Try broadening your search or check again later.</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-6 bg-muted/30 border-t border-border/40 flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Info className="h-4 w-4" />
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">
            Only online riders in the current zone are shown. Assigning a new rider will notify them immediately and update the order status.
          </p>
        </div>
      </div>
    </div>
  );
}
