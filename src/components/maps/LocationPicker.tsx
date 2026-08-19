import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { reverseGeocode } from "@/lib/maps-service";
import { toast } from "sonner";

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null, address?: string) => void;
  address?: string;
  showCurrentLocation?: boolean;
}

export function LocationPicker({ 
  latitude, 
  longitude, 
  onChange, 
  address: initialAddress,
  showCurrentLocation = true 
}: LocationPickerProps) {
  const [latInput, setLatInput] = useState(latitude?.toString() || "");
  const [lngInput, setLngInput] = useState(longitude?.toString() || "");
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    setLatInput(latitude?.toString() || "");
    setLngInput(longitude?.toString() || "");
  }, [latitude, longitude]);

  const validateAndSync = (latStr: string, lngStr: string) => {
    if (!latStr.trim() && !lngStr.trim()) {
      setError(null);
      onChange(null, null);
      return;
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      setError("Enter valid numeric coordinates or leave both empty.");
      return;
    }

    if (lat < -90 || lat > 90) {
      setError("Latitude must be between -90 and 90.");
      return;
    }

    if (lng < -180 || lng > 180) {
      setError("Longitude must be between -180 and 180.");
      return;
    }

    setError(null);
    onChange(lat, lng);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setLatInput(lat.toString());
        setLngInput(lng.toString());
        setError(null);
        
        let address: string | undefined;
        try {
          address = await reverseGeocode(lat, lng);
        } catch (err) {
          console.warn("Reverse geocoding failed", err);
        }
        
        onChange(lat, lng, address);
        setLocating(false);
        toast.success("Location detected");
      },
      (err) => {
        setLocating(false);
        toast.error("Failed to detect location: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Latitude</Label>
          <Input 
            type="number" 
            step="any"
            placeholder="e.g. 22.3072" 
            value={latInput} 
            onChange={e => {
              setLatInput(e.target.value);
              validateAndSync(e.target.value, lngInput);
            }} 
            className="h-11 rounded-2xl bg-secondary/50" 
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Longitude</Label>
          <Input 
            type="number" 
            step="any"
            placeholder="e.g. 73.1812" 
            value={lngInput} 
            onChange={e => {
              setLngInput(e.target.value);
              validateAndSync(latInput, e.target.value);
            }} 
            className="h-11 rounded-2xl bg-secondary/50" 
          />
        </div>
      </div>

      {error && <p className="text-[11px] font-bold text-rose-500">{error}</p>}

      {showCurrentLocation && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={locating}
          onClick={useCurrentLocation}
          className="h-10 w-full rounded-2xl border-dashed bg-transparent text-[10px] font-black uppercase tracking-widest active:scale-[0.98]"
        >
          <MapPin className={`mr-2 h-3.5 w-3.5 ${locating ? "animate-pulse" : ""}`} />
          {locating ? "Detecting..." : "Use Current Location"}
        </Button>
      )}
    </div>
  );
}

