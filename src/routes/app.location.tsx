import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, MapPin, Navigation, Plus, Check } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { savedLocations } from "@/lib/mock-extras";
import { useAppUI } from "@/lib/stores";
import { toast } from "sonner";


export const Route = createFileRoute("/app/location")({
  head: () => ({ meta: [{ title: "Cravio · Set delivery location" }] }),
  component: LocationPicker,
});

function LocationPicker() {
  const navigate = useNavigate();
  const { location, setLocation } = useAppUI();
  const [q, setQ] = useState("");

  const select = (line: string) => {
    setLocation(line);
    toast.success("Delivery location updated");
    navigate({ to: "/app" });
  };

  const suggestions = ["Westside · Apt 4", "MG Road, Bengaluru", "Bandra West, Mumbai", "Connaught Place, Delhi", "Indiranagar 100ft Rd"]
    .filter((s) => s.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-svh pb-10">
      <PageHeader title="Delivery location" subtitle={location} />

      <div className="relative mx-4 mt-3 h-44 overflow-hidden rounded-3xl shadow-soft ring-1 ring-border/60 bg-[radial-gradient(circle_at_30%_30%,_oklch(0.9_0.08_148_/_0.6),_oklch(0.97_0.02_140))]">
        <svg viewBox="0 0 320 180" className="absolute inset-0 h-full w-full opacity-60">
          <path d="M0 60 L320 60 M0 120 L320 120 M80 0 L80 180 M220 0 L220 180" stroke="currentColor" strokeWidth="0.5" className="text-foreground/15" />
          <path d="M30 150 Q120 80 200 90 T300 30" stroke="hsl(var(--primary))" strokeWidth="3" fill="none" strokeDasharray="6 4" />
          <circle cx="300" cy="30" r="6" fill="hsl(var(--primary))" /></svg>
        <button
          onClick={() => select("Current location · Auto-detected")}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-[12px] font-bold shadow-pop ring-1 ring-border/60"
        >
          <Navigation className="h-4 w-4 text-primary" strokeWidth={2.5} /> Use current location
        </button>
      </div>

      <div className="mt-5 px-4">
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-soft ring-1 ring-border/60">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search area, street or landmark" className="border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0" />
        </div>
      </div>

      <section className="mt-6 px-4">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Saved places</h3>
        <ul className="space-y-2">
          {savedLocations.map((l) => (
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

      {q && (
        <section className="mt-6 px-4">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Search results</h3>
          <ul className="space-y-2">
            {suggestions.length === 0 ? (
              <li className="rounded-2xl bg-card p-4 text-center text-xs text-muted-foreground shadow-soft ring-1 ring-border/60">No matches for "{q}"</li>
            ) : suggestions.map((s) => (
              <li key={s}>
                <button onClick={() => select(s)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-soft ring-1 ring-border/60 transition active:scale-[0.99]">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-muted-foreground"><MapPin className="h-4 w-4" /></span>
                  <span className="text-sm">{s}</span>
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
