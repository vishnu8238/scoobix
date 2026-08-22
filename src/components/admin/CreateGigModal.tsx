import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Loader2, Plus, Database, Info, AlertTriangle, Search, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchZones, fetchCities, type DeliveryZone } from "@/lib/zones-api";
import { createGig } from "@/lib/gigs-api";
import { insforge } from "@/lib/insforge";
import { createRecord, handleResponse } from "@/lib/insforge-crud";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from 'uuid';

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
    slots: [
      { id: uuidv4(), start_time: "09:00", end_time: "18:00" }
    ],
    city_id: "",
    zone_id: "",
    capacity: 50,
    completion_pct: 98
  });

  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const c = await fetchCities();
      console.log("[CREATE_GIG] Cities loaded:", c.length);
      setCities(c);

      const z = await fetchZones();
      console.log("[CREATE_GIG] Zones loaded:", z.length);
      setZones(z);

      if (c.length > 0 && !formData.city_id) {
        setFormData(prev => ({ ...prev, city_id: c[0].id }));
      }
    } catch (err: any) {
      console.error("Failed to load cities/zones:", err);
      setDiagnostics({ error: err.message, stack: "loadInitialData" });
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    setDiagnostics(null);
    try {
      console.log("[SEED_CLIENT] Starting authoritative client-side logistics seed...");
      
      const CITY_1_ID = "c1110000-0000-0000-0000-000000000001";
      const ZONE_1_ID = "z1110000-0000-0000-0000-000000000001";

      // Discovery: probe for writable tables
      const cityTableCandidates = ["cities", "logistics_cities", "delivery_cities"];
      const zoneTableCandidates = ["zones", "logistics_zones", "delivery_zones"];
      
      const results: any[] = [];
      
      // Seed City
      let seededCity = false;
      for (const table of cityTableCandidates) {
        try {
          const res = await createRecord(table, {
            id: CITY_1_ID,
            name: "Vadodara",
            status: "ACTIVE",
            metadata: { demo_tag: "logistics_test_v6", seeded_at: new Date().toISOString() }
          });
          if (res) {
            results.push({ table, op: "upsert_city", success: true });
            seededCity = true;
            break; 
          }
        } catch (e: any) {
          results.push({ table, op: "upsert_city", success: false, error: e.message });
        }
      }

      // Seed Zone
      let seededZone = false;
      if (seededCity) {
        for (const table of zoneTableCandidates) {
          try {
            const res = await createRecord(table, {
              id: ZONE_1_ID,
              city_id: CITY_1_ID,
              name: "Main Zone",
              status: "ACTIVE",
              metadata: { demo_tag: "logistics_test_v6", seeded_at: new Date().toISOString() }
            });
            if (res) {
              results.push({ table, op: "upsert_zone", success: true });
              seededZone = true;
              break;
            }
          } catch (e: any) {
            results.push({ table, op: "upsert_zone", success: false, error: e.message });
          }
        }
      }

      setDiagnostics({ diagnostics: results });
      
      if (seededCity && seededZone) {
        toast.success("Logistics prerequisites seeded successfully (Client-side)");
        await loadInitialData();
        setFormData(prev => ({ ...prev, city_id: CITY_1_ID, zone_id: ZONE_1_ID }));
      } else {
        toast.error("Seeding failed to establish prerequisites. Check diagnostics.");
      }
    } catch (err: any) {
      console.error("[SEED_CLIENT] Fatal error:", err);
      toast.error(`Seeding failed: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const addSlot = () => {
    setFormData(prev => ({
      ...prev,
      slots: [...prev.slots, { id: uuidv4(), start_time: "09:00", end_time: "18:00" }]
    }));
  };

  const removeSlot = (id: string) => {
    if (formData.slots.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      slots: prev.slots.filter(s => s.id !== id)
    }));
  };

  const updateSlot = (id: string, field: 'start_time' | 'end_time', value: string) => {
    setFormData(prev => ({
      ...prev,
      slots: prev.slots.map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validate slots
      for (const slot of formData.slots) {
        if (!slot.start_time || !slot.end_time) {
          throw new Error("All time slots must have a start and end time.");
        }
        if (slot.start_time >= slot.end_time) {
          throw new Error(`Invalid time range: ${slot.start_time} to ${slot.end_time}. End time must be later than start time.`);
        }
      }

      // Check for overlapping/duplicate slots
      const ranges = formData.slots.map(s => `${s.start_time}-${s.end_time}`);
      if (new Set(ranges).size !== ranges.length) {
        throw new Error("Duplicate time slots detected.");
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const TABLE = "gigs";
      const results: any[] = [];
      const errors: string[] = [];

      for (const slot of formData.slots) {
        const payload = {
          title: formData.slots.length > 1 ? `${formData.title} (${slot.start_time}-${slot.end_time})` : formData.title,
          description: formData.description,
          reward_amount: formData.reward_amount,
          target_deliveries: formData.target_deliveries,
          city_id: formData.city_id,
          zone_id: formData.zone_id,
          capacity: formData.capacity,
          completion_pct: formData.completion_pct,
          status: "ACTIVE" as const,
          start_time: `${todayStr}T${slot.start_time}:00Z`,
          end_time: `${todayStr}T${slot.end_time}:00Z`
        };

        try {
          const res = await createRecord<any>(TABLE, payload);
          if (res) results.push(res);
        } catch (err: any) {
          errors.push(`${slot.start_time}-${slot.end_time}: ${err.message}`);
        }
      }
      
      if (errors.length > 0) {
        toast.error(`Failed to create ${errors.length} slots:\n${errors.join('\n')}`);
      }

      if (results.length > 0) {
        toast.success(`Successfully created ${results.length} gig(s)`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error("[CREATE_GIG_MODAL] Error:", err.message);
      toast.error(err.message || "Failed to create gigs");
    } finally {
      setLoading(false);
    }
  };

  const selectedCityZones = zones.filter(z => z.city_id === formData.city_id);

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

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                    <Clock className="h-3 w-3" /> Time Slots
                  </label>
                  <button
                    type="button"
                    onClick={addSlot}
                    className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 transition flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Slot
                  </button>
                </div>
                
                <div className="space-y-3 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                  {formData.slots.map((slot, index) => (
                    <div key={slot.id} className="flex items-end gap-3 p-3 rounded-2xl bg-muted/20 ring-1 ring-border/40 group relative">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-muted-foreground/60">Start</label>
                          <input 
                            type="time"
                            required
                            value={slot.start_time}
                            onChange={e => updateSlot(slot.id, 'start_time', e.target.value)}
                            className="w-full h-10 px-3 bg-card rounded-xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-muted-foreground/60">End</label>
                          <input 
                            type="time"
                            required
                            value={slot.end_time}
                            onChange={e => updateSlot(slot.id, 'end_time', e.target.value)}
                            className="w-full h-10 px-3 bg-card rounded-xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-xs"
                          />
                        </div>
                      </div>
                      {formData.slots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSlot(slot.id)}
                          className="h-10 w-10 flex items-center justify-center rounded-xl text-muted-foreground/40 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 
               formData.slots.length > 1 ? `Create ${formData.slots.length} Gigs` : "Create Gig"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}