import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, AlertCircle, Loader2, Info, Database } from "lucide-react";
import { format } from "date-fns";
import { createGig } from "@/lib/gigs-api";
import { fetchZones, type DeliveryZone } from "@/lib/zones-api";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { seedLogisticsPrerequisites } from "@/lib/logistics-ops.functions";
import { useServerFn } from "@tanstack/react-start";

interface CreateGigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateGigModal({ isOpen, onClose, onSuccess }: CreateGigModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingZones, setLoadingZones] = useState(false);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    startHour: "00",
    startMinute: "00",
    endHour: "02",
    endMinute: "00",
    payout: "300",
    neededPeople: "1",
    completionPercentage: "50",
    city: "",
    zone: ""
  });

  // Unique cities from loaded zones
  const cities = useMemo(() => {
    const list = Array.from(new Set(zones.map(z => z.city))).filter(Boolean).sort();
    if (list.length === 0 && !loadingZones) {
      // If db is empty, return fallback City 1 as an option
      return ["City 1"];
    }
    return list;
  }, [zones, loadingZones]);
  
  // Filtered zones based on selected city
  const filteredZones = useMemo(() => {
    const list = zones.filter(z => z.city === formData.city).sort((a, b) => a.name.localeCompare(b.name));
    if (list.length === 0 && formData.city === "City 1") {
      // Hardcoded fallback Zone 1 that matches the authoritative seed ID
      return [{ id: "z1110000-0000-0000-0000-000000000001", name: "Zone 1", city: "City 1" }];
    }
    return list;
  }, [zones, formData.city]);



  const seedPrereqs = useServerFn(seedLogisticsPrerequisites);
  const [isSeeding, setIsSeeding] = useState(false);

  const loadZones = async () => {
    setLoadingZones(true);
    setZonesError(null);
    try {
      console.log("[GIG_MODAL] Querying authoritative zones...");
      const data = await fetchZones();
      if (!data || data.length === 0) {
        console.warn("[GIG_MODAL] Authoritative zones table is empty. Triggering automatic seed...");
        const seedResult = await seedPrereqs();
        console.log("[GIG_MODAL] Auto-seed result:", seedResult);
        
        // Re-fetch after seeding
        const freshData = await fetchZones();
        if (!freshData || freshData.length === 0) {
           console.log("[GIG_MODAL] DB still empty after seed, using UI fallbacks.");
           setZones([]);
        } else {
           setZones(freshData);
        }
      } else {
        console.log(`[GIG_MODAL] Found ${data.length} zones.`);
        setZones(data);
      }
    } catch (err: any) {
      console.error("[GIG_MODAL] Fetch error:", err);
      const isAuthError = err.status === 401 || err.message?.includes("Unauthorized");
      setZonesError(isAuthError 
        ? "Session expired or unauthorized. Please refresh the page."
        : `Database Error: ${err.message || "Failed to load cities and zones."}`);
    } finally {
      setLoadingZones(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadZones();
    }
  }, [isOpen]);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const result = await seedPrereqs();
      if (result.errors && result.errors.length > 0) {
        toast.error(`Seed partially failed: ${result.errors[0]}`);
      } else {
        toast.success(`Seeded ${result.zones} zones successfully`);
      }
      await loadZones();
    } catch (err: any) {
      toast.error(`Seed failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsSeeding(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.city || !formData.zone) {
      toast.error("City and Zone are required");
      return;
    }

    setLoading(true);
    
    try {
      // Use full ISO strings for consistency, explicitly setting UTC
      const startTime = new Date(`${formData.date}T${formData.startHour}:${formData.startMinute}:00.000Z`).toISOString();
      const endTime = new Date(`${formData.date}T${formData.endHour}:${formData.endMinute}:00.000Z`).toISOString();

      const newGig = await createGig({
        title: `Gig ${formData.startHour}:${formData.startMinute} - ${formData.endHour}:${formData.endMinute}`,
        description: `Gig in ${formData.city}, Zone ${formData.zone}`,
        reward_amount: Number(formData.payout),
        target_deliveries: 10,
        start_time: startTime,
        end_time: endTime,
        status: "SCHEDULED",
        zone_id: formData.zone,
        city_id: formData.city,
        capacity: Number(formData.neededPeople),
        completion_pct: Number(formData.completionPercentage)
      });


      if (newGig) {
        toast.success("Gig created successfully");
        onSuccess();
        onClose();
        // Reset form
        setFormData({
          date: format(new Date(), "yyyy-MM-dd"),
          startHour: "00",
          startMinute: "00",
          endHour: "02",
          endMinute: "00",
          payout: "300",
          neededPeople: "1",
          completionPercentage: "50",
          city: "",
          zone: ""
        });
      }
    } catch (error: any) {
      console.error("Failed to create gig:", error);
      toast.error(error.message || "Failed to create gig.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-[2rem] p-0 overflow-hidden max-h-[90vh] flex flex-col border-none shadow-glow">
        <DialogHeader className="p-8 pb-4 border-b bg-card shrink-0">
          <DialogTitle className="text-2xl font-black text-emerald-900 dark:text-emerald-400">
            Create New Gig
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-6">
            
          {zones.length === 0 && !loadingZones && (
            <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-900/40">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">No zones found in the database.</p>
                  <p className="mt-1 text-[10px] font-medium text-amber-700/70 dark:text-amber-400/70">
                    A city and zone are required. Use fallbacks or seed demo data to proceed.
                  </p>
                  <button 
                    onClick={handleSeed}
                    disabled={isSeeding}
                    className="mt-3 flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {isSeeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                    Seed Demo City & Zone
                  </button>
                </div>
              </div>
            </div>
          )}

          {zonesError && (

              <Alert variant="destructive" className="rounded-2xl bg-destructive/5 border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-bold">{zonesError}</AlertDescription>
              </Alert>
            )}

            {/* City & Zone Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  City <span className="text-rose-500">*</span>
                </Label>
                <Select 
                  value={formData.city} 
                  onValueChange={(v) => setFormData({ ...formData, city: v, zone: "" })}
                  disabled={loadingZones || !!zonesError}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold">
                    {loadingZones ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select City" />
                    )}
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {cities.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Zone <span className="text-rose-500">*</span>
                </Label>
                <Select 
                  value={formData.zone}
                  disabled={!formData.city || loadingZones || !!zonesError}
                  onValueChange={(v) => setFormData({ ...formData, zone: v })}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold">
                    <SelectValue placeholder={formData.city ? "Select Zone" : "Select city first"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {filteredZones.map(zone => (
                      <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Date <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold focus:ring-primary/20"
                  required
                />
                <Calendar className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Start Time <span className="text-rose-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="HH"
                    value={formData.startHour}
                    onChange={(e) => setFormData({ ...formData, startHour: e.target.value.slice(0, 2) })}
                    className="h-12 rounded-2xl border-border/60 bg-muted/30 text-center font-bold"
                    required
                  />
                  <span className="font-bold text-muted-foreground">:</span>
                  <Input
                    placeholder="MM"
                    value={formData.startMinute}
                    onChange={(e) => setFormData({ ...formData, startMinute: e.target.value.slice(0, 2) })}
                    className="h-12 rounded-2xl border-border/60 bg-muted/30 text-center font-bold"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  End Time <span className="text-rose-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="HH"
                    value={formData.endHour}
                    onChange={(e) => setFormData({ ...formData, endHour: e.target.value.slice(0, 2) })}
                    className="h-12 rounded-2xl border-border/60 bg-muted/30 text-center font-bold"
                    required
                  />
                  <span className="font-bold text-muted-foreground">:</span>
                  <Input
                    placeholder="MM"
                    value={formData.endMinute}
                    onChange={(e) => setFormData({ ...formData, endMinute: e.target.value.slice(0, 2) })}
                    className="h-12 rounded-2xl border-border/60 bg-muted/30 text-center font-bold"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Estimated Payout (₹) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. 300"
                  value={formData.payout}
                  onChange={(e) => setFormData({ ...formData, payout: e.target.value })}
                  className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Needed People <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="1"
                  type="number"
                  value={formData.neededPeople}
                  onChange={(e) => setFormData({ ...formData, neededPeople: e.target.value })}
                  className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Percentage to complete gig <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="50"
                type="number"
                value={formData.completionPercentage}
                onChange={(e) => setFormData({ ...formData, completionPercentage: e.target.value })}
                className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold"
                required
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-3 p-8 pt-4 border-t bg-card shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-12 flex-1 rounded-2xl border-border/60 font-black hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || loadingZones || !!zonesError}
              className="h-12 flex-1 rounded-2xl bg-emerald-900 font-black text-white hover:bg-emerald-800 transition-all active:scale-[0.98]"
            >
              {loading ? "Creating..." : "+ Create Gig"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
