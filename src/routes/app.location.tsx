import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, MapPin, Navigation, Plus, Check, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { GoogleMap as LeafletMap } from "@/components/maps/GoogleMap";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAddresses } from "@/lib/addresses-store";
import { useAppUI } from "@/lib/stores";
import { DEFAULT_CUSTOMER, addressCoords, type LatLng } from "@/lib/geo";
import { reverseGeocode, searchPlaces, type GeoPlace } from "@/lib/geocode";
import { toast } from "sonner";


export const Route = createFileRoute("/app/location")({
  head: () => ({ meta: [{ title: "Scoobix · Set delivery location" }] }),
  component: LocationPicker,
});

function LocationPicker() {
  const navigate = useNavigate();
  const { location, setLocation, userCoords, detectLocation, detectingLocation } = useAppUI();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<LatLng | null>(userCoords ?? null);
  const { rows: addressRows, loaded: addressesLoaded } = useAddresses();
  const saved = addressRows.map((a) => ({
    id: a.id,
    label: a.label,
    tag: a.label,
    icon: /home/i.test(a.label) ? "🏠" : /work|office/i.test(a.label) ? "💼" : "📍",
    line: [a.line1, a.line2].filter(Boolean).join(" · "),
  }));
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeoPlace[]>([]);

  // Reverse-geocode the dropped pin so the user sees the exact address.
  useEffect(() => {
    if (!picked) { setPickedLabel(null); return; }
    let cancelled = false;
    setPickedLabel("Locating…");
    void reverseGeocode(picked.lat, picked.lng).then((l) => { if (!cancelled) setPickedLabel(l); });
    return () => { cancelled = true; };
  }, [picked]);

  // Live place search (debounced).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) { setResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      void searchPlaces(term, userCoords ?? DEFAULT_CUSTOMER).then((r) => {
        if (cancelled) return;
        setResults(r);
        setSearching(false);
      });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, userCoords]);

  const select = (line: string, coords?: LatLng) => {
    setLocation(line, coords ?? addressCoords(line));
    toast.success("Delivery location updated");
    navigate({ to: "/app" });
  };

  const useCurrent = async () => {
    const r = await detectLocation();
    if (r.ok) { toast.success(r.message); navigate({ to: "/app" }); }
    else toast.error(r.message);
  };


  return (
    <div className="min-h-svh pb-10">
      <PageHeader title="Delivery location" subtitle={location} />

      <div className="relative mx-4 mt-3">
        <LeafletMap
          height={200}
          zoom={14}
          center={picked ?? userCoords ?? DEFAULT_CUSTOMER}
          pickedAt={picked}
          onPick={(c) => setPicked(c)}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 px-3">
          <button
            onClick={useCurrent}
            disabled={detectingLocation}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-[12px] font-bold shadow-pop ring-1 ring-border/60 disabled:opacity-60"
          >
            <Navigation className="h-4 w-4 text-primary" strokeWidth={2.5} />
            {detectingLocation ? "Locating…" : "Use current location"}
          </button>
          {picked && (
            <button
              onClick={() => select(pickedLabel && pickedLabel !== "Locating…" ? pickedLabel : "Pinned on map", picked)}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full gradient-primary px-4 py-2 text-[12px] font-bold text-primary-foreground shadow-glow"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} /> Use this pin
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 px-5 text-[11px] text-muted-foreground">
        {pickedLabel ?? "Tap the map to drop a pin, then drag it to fine-tune."}
      </p>



      <div className="mt-5 px-4">
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-soft ring-1 ring-border/60">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search area, street or landmark" className="border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0" />
        </div>
      </div>

      <section className="mt-6 px-4">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Saved places</h3>
        <ul className="space-y-2">
          {saved.length === 0 && (
            <li className="rounded-2xl bg-card p-3 text-xs text-muted-foreground shadow-soft ring-1 ring-border/60">
              {addressesLoaded ? "No saved places yet." : "Loading saved places…"}
            </li>
          )}
          {saved.map((l) => (
            <li key={l.id}>
              <button onClick={() => select(l.line)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-soft ring-1 ring-border/60 transition active:scale-[0.99]">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-xl">{l.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-bold">{l.label}<span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{l.tag}</span></div>
                  <p className="truncate text-xs text-muted-foreground">{l.line}</p>
                </div>
                {location === l.line && <Check className="h-4 w-4 text-primary" />}
              </button>
            </li>
          ))}
          <li>
            <button className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-border p-3 text-left text-muted-foreground transition active:scale-[0.99]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-secondary"><Plus className="h-5 w-5" /></span>
              <span className="text-sm font-bold">Add a new address</span>
            </button>
          </li>
        </ul>
      </section>

      {q.trim().length >= 3 && (
        <section className="mt-6 px-4">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Search results</h3>
          <ul className="space-y-2">
            {searching ? (
              <li className="flex items-center justify-center gap-2 rounded-2xl bg-card p-4 text-xs text-muted-foreground shadow-soft ring-1 ring-border/60">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </li>
            ) : results.length === 0 ? (
              <li className="rounded-2xl bg-card p-4 text-center text-xs text-muted-foreground shadow-soft ring-1 ring-border/60">No matches for "{q}"</li>
            ) : results.map((s) => (
              <li key={`${s.lat},${s.lng},${s.label}`}>
                <button onClick={() => select(s.label, { lat: s.lat, lng: s.lng })} className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-soft ring-1 ring-border/60 transition active:scale-[0.99]">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground"><MapPin className="h-4 w-4" /></span>
                  <span className="text-sm">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}


      <div className="px-4 pt-8">
        <Button onClick={() => navigate({ to: "/app" })} className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow">Confirm and continue</Button>
      </div>
    </div>
  );
}
