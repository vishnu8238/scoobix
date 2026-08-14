import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Loader2, Plus, Database, Info, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { fetchZones, type DeliveryZone } from "@/lib/zones-api";
import { createGig } from "@/lib/gigs-api";
import { seedLogisticsPrerequisites } from "@/lib/logistics-ops.functions";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";

interface CreateGigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateGigModal({ isOpen, onClose, onSuccess }: CreateGigModalProps) {
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<any[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    reward_amount: 500,
    target_deliveries: 10,
    start_time: "09:00",
    end_time: "18:00",
    city_id: "",
    zone_id: "",
    capacity: 50,
    completion_pct: 98
  });

  const seedPrereqs = useServerFn(seedLogisticsPrerequisites);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      const z = await fetchZones();
      setZones(z);
      
      // Extract unique cities from zones
      const uniqueCities = Array.from(new Set(z.map(zone => zone.city))).map(cityName => {
        const zoneWithCity = z.find(zone => zone.city === cityName);
        return {
          id: zoneWithCity?.id || cityName, // Temporary fallback
          name: cityName
        };
      });
      setCities(uniqueCities);

      if (uniqueCities.length > 0) {
        setFormData(prev => ({ ...prev, city_id: uniqueCities[0].id }));
      }
    } catch (err) {
      console.error("Failed to load cities/zones:", err);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const result = await seedPrereqs();
      setDiagnostics(result);
      if (result.errors.length === 0) {
        toast.success("Logistics prerequisites seeded successfully");
        await loadInitialData();
      } else {
        toast.error("Seeding completed with errors");
      }
    } catch (err: any) {
      toast.error(`Seeding failed: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const payload = {
        ...formData,
        status: "ACTIVE" as const,
        start_time: `${today}T${formData.start_time}:00.000Z`,
        end_time: `${today}T${formData.end_time}:00.000Z`
      };
      
      await createGig(payload);
      toast.success("Gig created successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create gig");
    } finally {
      setLoading(false);
    }
  };

  const selectedCityZones = zones.filter(z => {
    const city = cities.find(c => c.id === formData.city_id);
    return z.city === city?.name;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl ring-1 ring-border/40">
        <DialogHeader className="p-8 pb-0">
          <div className="flex items-center gap-4 mb-2">
            <div className="rounded-2xl bg-emerald-100 p-3 dark:bg-emerald-950/50">
              <Plus className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight">Create New Gig</DialogTitle>
              <DialogDescription className="text-sm font-bold text-muted-foreground/60">Configure a new delivery slot for the fleet</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Gig Title</label>
                <input 
                  required
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Morning Shift - Zone 1"
                  className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Start Time</label>
                  <input 
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">End Time</label>
                  <input 
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={e => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">City</label>
                <select 
                  required
                  value={formData.city_id}
                  onChange={e => setFormData(prev => ({ ...prev, city_id: e.target.value, zone_id: "" }))}
                  className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm appearance-none"
                >
                  <option value="">Select City</option>
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Zone</label>
                <select 
                  required
                  value={formData.zone_id}
                  onChange={e => setFormData(prev => ({ ...prev, zone_id: e.target.value }))}
                  disabled={!formData.city_id}
                  className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm appearance-none disabled:opacity-50"
                >
                  <option value="">{formData.city_id ? "Select Zone" : "Select city first"}</option>
                  {selectedCityZones.map(zone => (
                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border/40">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Payout (₹)</label>
              <input 
                type="number"
                required
                value={formData.reward_amount}
                onChange={e => setFormData(prev => ({ ...prev, reward_amount: parseInt(e.target.value) }))}
                className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Rider Capacity</label>
              <input 
                type="number"
                required
                value={formData.capacity}
                onChange={e => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) }))}
                className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm"
              />
            </div>
          </div>

          {cities.length === 0 && (
            <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200 dark:bg-rose-950/20 dark:ring-rose-900/40">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-rose-700 dark:text-rose-400">No zones found in the database</p>
                  <p className="text-[10px] font-bold text-rose-600/70 mt-1 leading-relaxed">A city and zone are required to create a gig. Use the button below to seed demo data if needed.</p>
                  <button 
                    type="button"
                    onClick={handleSeed}
                    disabled={isSeeding}
                    className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSeeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                    Seed Demo City & Zone
                  </button>
                </div>
              </div>
            </div>
          )}

          {diagnostics && (
            <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-200 dark:bg-indigo-900/20 dark:ring-indigo-900/40">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-2">Seed Diagnostics</p>
              <div className="space-y-1 text-[10px] font-bold">
                {diagnostics.diagnostics.map((d: any, i: number) => (
                  <p key={i} className={cn(d.error ? "text-rose-500" : "text-indigo-600")}>
                    {d.table}: {d.op} {d.status} {d.success ? "✓" : "✗"} {d.error}
                  </p>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="pt-6 border-t border-border/40 gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl text-xs font-black bg-muted hover:bg-muted/80 transition"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading || cities.length === 0}
              className="px-8 py-3 rounded-2xl text-xs font-black bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition disabled:opacity-50 active:scale-95"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Gig"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}