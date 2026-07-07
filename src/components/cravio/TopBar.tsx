import { Bell, ChevronDown, MapPin, Navigation, Loader2, Leaf } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { useAppUI } from "@/lib/stores";
import { notifications } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SUGGESTED_LOCATIONS = [
  "Westside · Apt 4",
  "Scoobix HQ · Innovation Park",
  "Downtown Loft · 5th Ave",
  "Sunset Marina · Pier 12",
];

export function TopBar() {
  const { location, setLocation, detectLocation, detectingLocation, locationPermission } = useAppUI();
  const [locOpen, setLocOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [customLoc, setCustomLoc] = useState("");

  const handleDetect = async () => {
    const res = await detectLocation();
    if (res.ok) {
      toast.success("Location updated", { description: res.message });
      setLocOpen(false);
    } else {
      toast.error(res.message);
    }
  };

  return (
    <header className="sticky top-0 z-30 glass px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
        <Sheet open={locOpen} onOpenChange={setLocOpen}>
          <SheetTrigger asChild>
            <button className="flex min-w-0 flex-col items-start text-left">
              <span className="eyebrow">Delivering to</span>
              <span className="mt-0.5 flex min-w-0 items-center gap-1">
                <span className="truncate font-display text-[15px] font-bold tracking-tight text-foreground">{location}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-[32px]">
            <SheetHeader className="text-left">
              <SheetTitle className="font-display">Delivery location</SheetTitle>
              <SheetDescription>Pick a saved address or type a new one.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-2">
              <button
                onClick={handleDetect}
                disabled={detectingLocation || locationPermission === "unsupported"}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary-soft/60 p-3.5 text-left transition active:scale-[0.99] disabled:opacity-60"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                  {detectingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-bold text-primary">
                    {detectingLocation ? "Detecting your location…" : "Use current location"}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {locationPermission === "denied"
                      ? "Permission denied — enable in browser settings"
                      : locationPermission === "unsupported"
                      ? "Not available on this device"
                      : "We'll ask your browser for permission"}
                  </span>
                </span>
              </button>
              {SUGGESTED_LOCATIONS.map((l) => (
                <button
                  key={l}
                  onClick={() => { setLocation(l); setLocOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition hover:border-primary/40 hover:bg-primary-soft/40 active:scale-[0.99]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{l}</span>
                </button>
              ))}
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="Enter a new address"
                  value={customLoc}
                  onChange={(e) => setCustomLoc(e.target.value)}
                  className="rounded-2xl"
                />
                <Button
                  onClick={() => {
                    if (customLoc.trim()) { setLocation(customLoc.trim()); setCustomLoc(""); setLocOpen(false); }
                  }}
                  className="rounded-2xl"
                >Save</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
          <SheetTrigger asChild>
            <button className="relative grid h-11 w-11 place-items-center rounded-2xl bg-surface text-foreground shadow-soft ring-1 ring-border transition active:scale-95">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-surface" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[88vw] sm:w-[400px]">
            <SheetHeader className="text-left">
              <SheetTitle className="font-display">Notifications</SheetTitle>
              <SheetDescription>Updates on your orders and offers.</SheetDescription>
            </SheetHeader>
            <ul className="mt-4 space-y-2">
              {notifications.map((n) => (
                <li key={n.id} className="rounded-2xl border border-border bg-card p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    <span className="text-[11px] text-muted-foreground">{n.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  {n.unread && <span className="mt-2 inline-block rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">New</span>}
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>

        <VegModeToggle />
      </div>
    </header>
  );
}

function VegModeToggle() {
  const { vegMode, setVegMode } = useAppUI();
  return (
    <button
      onClick={() => setVegMode(!vegMode)}
      aria-pressed={vegMode}
      aria-label={vegMode ? "Veg mode on — showing pure veg only" : "Veg mode off — showing all restaurants"}
      title={vegMode ? "Veg mode on" : "Veg mode off"}
      className={
        "flex h-11 items-center gap-1.5 rounded-2xl px-2.5 shadow-soft ring-1 transition active:scale-95 " +
        (vegMode
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-surface text-foreground ring-border")
      }
    >
      <span
        className={
          "grid h-7 w-7 place-items-center rounded-xl " +
          (vegMode ? "bg-white/20 text-white" : "bg-primary-soft text-primary")
        }
      >
        <Leaf className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <span className="pr-1 text-[11px] font-extrabold uppercase tracking-wider">
        {vegMode ? "Veg" : "All"}
      </span>
    </button>
  );
}
