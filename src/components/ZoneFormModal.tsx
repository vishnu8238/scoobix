import { useState, useEffect } from "react";
import { X, Save, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { createNewZone, createNewSubzone } from "@/lib/zones.functions";
import { GoogleMap as GoogleMap } from "./maps/GoogleMap";
import type { DeliveryZone, Subzone } from "@/lib/zones-api";

type ZoneFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<DeliveryZone>;
};

export function ZoneFormModal({ isOpen, onClose, onSuccess, initialData }: ZoneFormProps) {
  const [loading, setLoading] = useState(false);
  
  // Stable form state outside of map/re-renders
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    city: initialData?.city || "Vadodara",
    status: initialData?.status || "ACTIVE",
    pickup_radius_km: initialData?.pickup_radius_km || 1,
    max_delivery_distance_km: initialData?.max_delivery_distance_km || 4,
    description: initialData?.description || "",
    boundary: initialData?.boundary || { type: "Polygon", coordinates: [] }
  });

  // Keep lat/lng separate for manual entry stability
  const [manualCoords, setManualCoords] = useState({
    lat: initialData?.center_lat?.toString() || (initialData?.boundary?.coordinates?.[0]?.[0]?.[1]?.toString()) || "22.3072",
    lng: initialData?.center_lng?.toString() || (initialData?.boundary?.coordinates?.[0]?.[0]?.[0]?.toString()) || "73.1812"
  });

  const hasMapPoints = formData.boundary?.coordinates?.[0]?.length >= 3;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Robust boundary fallback for Logistics: allow creation with minimal deterministic coordinates
      // if map/polygon is unavailable or fails to draw.
      const DEFAULT_BOUNDARY = { 
        type: "Polygon", 
        coordinates: [[
          [73.1812, 22.3072], 
          [73.1912, 22.3072], 
          [73.1912, 22.3172], 
          [73.1812, 22.3172],
          [73.1812, 22.3072]
        ]] 
      };

      const boundary = hasMapPoints ? formData.boundary : DEFAULT_BOUNDARY;

      // Ensure polygon closure: first coordinate must match the last
      if (boundary.coordinates && boundary.coordinates.length > 0) {
        const coords = boundary.coordinates[0];
        if (coords.length >= 3) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (JSON.stringify(first) !== JSON.stringify(last)) {
            coords.push([...first]);
          }
        }
      }

      const submission = {
        ...formData,
        pickup_radius_km: Number(formData.pickup_radius_km) || 1,
        max_delivery_distance_km: Number(formData.max_delivery_distance_km) || 4,
        boundary,
        center_lat: boundary.coordinates?.[0]?.[0]?.[1] || 22.3072,
        center_lng: boundary.coordinates?.[0]?.[0]?.[0] || 73.1812
      };

      const { insforge: sdk } = await import("@/lib/insforge");

      console.log("[ZONE_MODAL] Submitting zone directly via SDK client...");
      const { data: result, error } = await sdk.database
        .from("logistics_zones")
        .insert([submission])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || "Failed to create zone (Unauthorized or RLS)");
      }
      
      toast.success("Zone created and verified in database");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("[ZONE_MODAL] Production creation error:", err);
      toast.error(`Production Zone Error: ${err.message || "Unauthorized or RLS Blocked"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
      <div 
        className="relative w-full max-w-5xl bg-zinc-950 rounded-[2.5rem] border border-white/10 shadow-[2xl] overflow-hidden flex flex-col my-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-6 border-b border-border/60">
          <h2 className="font-display text-xl font-extrabold">{initialData ? "Edit Zone" : "Create Zone"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Zone Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. West Zone"
                  className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 focus:ring-primary/40 outline-none transition"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">City</label>
                  <input 
                    required
                    value={formData.city}
                    onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Status</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 focus:ring-primary/40 outline-none appearance-none"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>


              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Description</label>
                <textarea 
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none resize-none"
                />
              </div>
            </div>

            <div className="relative h-[400px] rounded-3xl overflow-hidden ring-1 ring-border/60">
              <GoogleMap 
                className="h-full w-full"
                interactive={true}
                center={formData.boundary?.coordinates?.[0]?.[0] ? { lat: formData.boundary.coordinates[0][0][1], lng: formData.boundary.coordinates[0][0][0] } : { lat: parseFloat(manualCoords.lat), lng: parseFloat(manualCoords.lng) }}
                onPick={(c) => {
                  // Update manual coords on pick too
                  setManualCoords({ lat: c.lat.toString(), lng: c.lng.toString() });
                  
                  if (!formData.boundary?.coordinates?.[0]?.length) {
                    setFormData(prev => ({
                      ...prev,
                      boundary: {
                        type: "Polygon",
                        coordinates: [[
                          [c.lng - 0.005, c.lat - 0.005],
                          [c.lng + 0.005, c.lat - 0.005],
                          [c.lng + 0.005, c.lat + 0.005],
                          [c.lng - 0.005, c.lat + 0.005],
                          [c.lng - 0.005, c.lat - 0.005]
                        ]]
                      }
                    }));
                  }
                }}
                onPolygonEdit={(id, points) => {
                  if (points.length > 0) {
                    setManualCoords({ lat: points[0].lat.toString(), lng: points[0].lng.toString() });
                  }
                  setFormData(prev => ({
                    ...prev,
                    boundary: {
                      type: "Polygon",
                      coordinates: [points.map(p => [p.lng, p.lat])]
                    }
                  }));
                }}
                polygons={formData.boundary?.coordinates?.[0]?.length >= 3 ? [{
                  id: "new-zone",
                  points: formData.boundary.coordinates[0].map((c: any) => ({ lat: c[1], lng: c[0] })),
                  color: "rgba(16, 185, 129, 0.5)"
                }] : []}
              />
              {!hasMapPoints && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/40 backdrop-blur-[2px] pointer-events-none">
                  <div className="bg-zinc-950/90 border border-white/10 p-6 rounded-[2rem] shadow-2xl text-center max-w-[280px] pointer-events-auto">
                    <MapPin className="h-8 w-8 text-primary mx-auto mb-3" />
                    <p className="text-sm font-black mb-2">No boundary defined</p>
                    <p className="text-[10px] text-muted-foreground font-bold mb-4">
                      Enter coordinates below to define the zone area if drawing is unavailable.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="number" step="any" placeholder="Lat" 
                        value={manualCoords.lat}
                        className="bg-muted px-3 py-2 rounded-xl text-[10px] outline-none ring-1 ring-border/60"
                        onChange={e => {
                          const latVal = e.target.value;
                          setManualCoords(prev => ({ ...prev, lat: latVal }));
                          const lat = parseFloat(latVal);
                          const lng = parseFloat(manualCoords.lng);
                          if (!isNaN(lat) && !isNaN(lng)) {
                            setFormData(prev => ({ ...prev, boundary: { type: "Polygon", coordinates: [[[lng, lat], [lng+0.01, lat], [lng+0.01, lat+0.01], [lng, lat+0.01], [lng, lat]]] } }));
                          }
                        }}
                      />
                      <input 
                        type="number" step="any" placeholder="Lng" 
                        value={manualCoords.lng}
                        className="bg-muted px-3 py-2 rounded-xl text-[10px] outline-none ring-1 ring-border/60"
                        onChange={e => {
                          const lngVal = e.target.value;
                          setManualCoords(prev => ({ ...prev, lng: lngVal }));
                          const lng = parseFloat(lngVal);
                          const lat = parseFloat(manualCoords.lat);
                          if (!isNaN(lat) && !isNaN(lng)) {
                            setFormData(prev => ({ ...prev, boundary: { type: "Polygon", coordinates: [[[lng, lat], [lng+0.01, lat], [lng+0.01, lat+0.01], [lng, lat+0.01], [lng, lat]]] } }));
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        <footer className="sticky bottom-0 p-6 border-t border-border/60 flex justify-end gap-3 bg-zinc-950/90 backdrop-blur-md z-10">
          <button 
            type="button" 
            onClick={onClose}
            className="rounded-2xl px-6 py-2.5 text-sm font-bold text-muted-foreground transition hover:bg-muted"
          >
            Cancel
          </button>
          <button 
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {initialData ? "Save Changes" : "Create Zone"}
          </button>
        </footer>
      </div>
    </div>
  );
}

type SubzoneFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  zoneId?: string;
  zones?: DeliveryZone[];
  initialData?: Partial<Subzone>;
  zoneBoundary?: any;
};

export function SubzoneFormModal({ isOpen, onClose, onSuccess, zoneId, zones, initialData }: SubzoneFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    zone_id: zoneId || initialData?.zone_id || "",
    name: initialData?.name || "",
    status: initialData?.status || "ACTIVE",
    boundary: initialData?.boundary || { type: "Polygon", coordinates: [] }
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!formData.zone_id) {
      toast.error("Please select a parent zone");
      setLoading(false);
      return;
    }
    try {
      await createNewSubzone({ data: formData as any });
      toast.success("Subzone created successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`Failed to create subzone: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-card shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-border/60 overflow-hidden flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-6 border-b border-border/60">
          <h2 className="font-display text-xl font-extrabold">{initialData ? "Edit Subzone" : "Add Subzone"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Parent Zone</label>
              <select 
                required
                value={formData.zone_id}
                onChange={e => setFormData(prev => ({ ...prev, zone_id: e.target.value }))}
                className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none appearance-none disabled:opacity-50"
                disabled={!!zoneId}
              >
                <option value="">Select a zone...</option>
                {zones?.map(z => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Subzone Name</label>
              <input 
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Alkapuri"
                className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none"
              />
            </div>
          </div>
          
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Status</label>
            <select 
              value={formData.status}
              onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
              className="w-full rounded-2xl bg-muted/50 px-4 py-3 text-sm ring-1 ring-border/60 outline-none appearance-none"
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </div>


          <div className="sticky bottom-0 flex justify-end gap-3 pt-4 pb-6 px-6 -mx-6 bg-card/90 backdrop-blur-md z-10 border-t border-border/60">
            <button 
              type="button" 
              onClick={onClose}
              className="rounded-2xl px-6 py-2.5 text-sm font-bold text-muted-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {initialData ? "Save Changes" : "Create Subzone"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
