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
  const [manualInput, setManualInput] = useState({
    lat: "22.3072",
    lng: "73.1812"
  });

  const getRingPoints = () => {
    const raw = formData.boundary?.coordinates?.[0] || [];
    // If it's a closed GeoJSON ring, we show the open points in the UI for editing
    if (raw.length > 1 && raw[0][0] === raw[raw.length - 1][0] && raw[0][1] === raw[raw.length - 1][1]) {
      return raw.slice(0, -1);
    }
    return raw;
  };

  const points = getRingPoints();
  const hasMinPoints = points.length >= 3;

  const addPoint = () => {
    const lat = parseFloat(manualInput.lat);
    const lng = parseFloat(manualInput.lng);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error("Enter valid latitude and longitude");
      return;
    }
    const newPoints = [...points, [lng, lat]];
    setFormData(prev => ({
      ...prev,
      boundary: {
        type: "Polygon",
        coordinates: [newPoints]
      }
    }));
  };

  const removePoint = (index: number) => {
    const newPoints = points.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      boundary: {
        type: "Polygon",
        coordinates: [newPoints]
      }
    }));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate geometry: at least 3 distinct vertices are required.
    const rawRing: Array<[number, number]> = Array.isArray(formData.boundary?.coordinates?.[0])
      ? formData.boundary.coordinates[0].filter(
          (c: any) => Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))
        ).map((c: any) => [Number(c[0]), Number(c[1])] as [number, number])
      : [];

    const unique = rawRing.filter((c, i, arr) => i === 0 || c[0] !== arr[i - 1][0] || c[1] !== arr[i - 1][1]);
    const openRing = unique.length > 1 &&
      unique[0][0] === unique[unique.length - 1][0] &&
      unique[0][1] === unique[unique.length - 1][1]
        ? unique.slice(0, -1)
        : unique;

    if (openRing.length < 3) {
      toast.error("Draw a zone boundary with at least 3 points before saving.");
      return;
    }

    // Closed GeoJSON ring, [lng, lat]
    const ring = [...openRing, [...openRing[0]] as [number, number]];
    const boundary = { type: "Polygon", coordinates: [ring] };

    const centerLng = openRing.reduce((s, c) => s + c[0], 0) / openRing.length;
    const centerLat = openRing.reduce((s, c) => s + c[1], 0) / openRing.length;

    setLoading(true);
    try {
      const submission = {
        name: formData.name,
        city: formData.city,
        status: formData.status,
        description: formData.description || null,
        boundary,
        center_lat: centerLat,
        center_lng: centerLng,
        latitude: centerLat,
        longitude: centerLng,
        pickup_radius_km: Number(formData.pickup_radius_km) || 1,
        max_delivery_distance_km: Number(formData.max_delivery_distance_km) || 4,
      };

      const { insforge: sdk } = await import("@/lib/insforge");

      const { error } = await sdk.database
        .from("logistics_zones")
        .insert([submission])
        .select()
        .single();

      if (error) {
        console.error("[ZONE_MODAL] Zone creation failed:", error.message);
        throw new Error("We couldn't save this zone. Please check the boundary and try again.");
      }

      toast.success("Zone created");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("[ZONE_MODAL] Zone creation error:", err);
      toast.error(err?.message || "We couldn't save this zone. Please try again.");
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

            <div className="space-y-6">
              <div className="relative h-[300px] rounded-3xl overflow-hidden ring-1 ring-border/60">
                <GoogleMap 
                  className="h-full w-full"
                  interactive={true}
                  center={points[0] ? { lat: points[0][1], lng: points[0][0] } : { lat: 22.3072, lng: 73.1812 }}
                  onPick={(c) => {
                    setFormData(prev => {
                      const currentPoints = getRingPoints();
                      const newPoints = [...currentPoints, [c.lng, c.lat]];
                      return {
                        ...prev,
                        boundary: {
                          type: "Polygon",
                          coordinates: [newPoints]
                        }
                      };
                    });
                  }}
                  onPolygonEdit={(id, newLatLngs) => {
                    setFormData(prev => ({
                      ...prev,
                      boundary: {
                        type: "Polygon",
                        coordinates: [newLatLngs.map(p => [p.lng, p.lat])]
                      }
                    }));
                  }}
                  polygons={points.length >= 3 ? [{
                    id: "new-zone",
                    points: points.map((c: any) => ({ lat: c[1], lng: c[0] })),
                    color: "rgba(16, 185, 129, 0.5)"
                  }] : []}
                />
              </div>

              {/* Manual Boundary Block */}
              <div className="bg-muted/30 rounded-3xl p-6 border border-border/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Manual Boundary
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hasMinPoints ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}`}>
                    {points.length} / 3 points minimum
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Latitude</label>
                    <input 
                      type="number" step="any"
                      value={manualInput.lat}
                      onChange={e => setManualInput(prev => ({ ...prev, lat: e.target.value }))}
                      className="w-full rounded-xl bg-background/50 px-3 py-2 text-xs outline-none ring-1 ring-border/60 focus:ring-primary/40 transition"
                      placeholder="22.3072"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Longitude</label>
                    <input 
                      type="number" step="any"
                      value={manualInput.lng}
                      onChange={e => setManualInput(prev => ({ ...prev, lng: e.target.value }))}
                      className="w-full rounded-xl bg-background/50 px-3 py-2 text-xs outline-none ring-1 ring-border/60 focus:ring-primary/40 transition"
                      placeholder="73.1812"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={addPoint}
                    className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 active:scale-95 transition"
                  >
                    Add Point
                  </button>
                </div>

                {points.length > 0 && (
                  <div className="max-h-[120px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {points.map((p, i) => (
                      <div key={`${p[0]}-${p[1]}-${i}`} className="flex items-center justify-between bg-background/40 p-2 rounded-xl border border-border/40 group">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-muted-foreground/50 w-4">{i + 1}</span>
                          <span className="text-[10px] font-mono font-medium">
                            {p[1].toFixed(6)}, {p[0].toFixed(6)}
                          </span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removePoint(i)}
                          className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
