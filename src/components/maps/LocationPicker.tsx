import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { reverseGeocode } from "@/lib/maps-service";
import { LatLng } from "@/lib/geo";

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number, address: string) => void;
  address?: string;
}

export function LocationPicker({ latitude, longitude, onChange, address: initialAddress }: LocationPickerProps) {
  const [latInput, setLatInput] = useState(latitude?.toString() || "");
  const [lngInput, setLngInput] = useState(longitude?.toString() || "");
  const [resolvedAddress, setResolvedAddress] = useState(initialAddress || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (latitude !== null) setLatInput(latitude.toString());
    if (longitude !== null) setLngInput(longitude.toString());
  }, [latitude, longitude]);

  const validateAndSync = async (latStr: string, lngStr: string) => {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      setError("Please enter valid numeric coordinates.");
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
    const address = await reverseGeocode(lat, lng);
    setResolvedAddress(address);
    onChange(lat, lng, address);
  };


  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Latitude</Label>
          <Input 
            type="number" 
            step="any"
            placeholder="22.3072" 
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
            placeholder="73.1812" 
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


      {resolvedAddress && (
        <div className="rounded-2xl bg-primary/5 p-3 ring-1 ring-primary/10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Location found</p>
          <p className="text-xs font-medium leading-relaxed">{resolvedAddress}</p>
        </div>
      )}
    </div>
  );
}
