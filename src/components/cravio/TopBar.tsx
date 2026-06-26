import { Bell, ChevronDown, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { useAppUI } from "@/lib/stores";
import { notifications } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUGGESTED_LOCATIONS = [
  "Westside · Apt 4",
  "Cravio HQ · Innovation Park",
  "Downtown Loft · 5th Ave",
  "Sunset Marina · Pier 12",
];

export function TopBar() {
  const { location, setLocation } = useAppUI();
  const [locOpen, setLocOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [customLoc, setCustomLoc] = useState("");

  return (
    <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
        <Sheet open={locOpen} onOpenChange={setLocOpen}>
          <SheetTrigger asChild>
            <button className="flex min-w-0 items-center gap-2 text-left">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Deliver to</span>
                <span className="flex min-w-0 items-center gap-1 text-sm font-semibold text-foreground">
                  <span className="truncate">{location}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </span>
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader className="text-left">
              <SheetTitle>Delivery location</SheetTitle>
              <SheetDescription>Pick a saved address or type a new one.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-2">
              {SUGGESTED_LOCATIONS.map((l) => (
                <button
                  key={l}
                  onClick={() => { setLocation(l); setLocOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-primary-soft/30"
                >
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{l}</span>
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
            <button className="relative grid h-10 w-10 place-items-center rounded-full bg-secondary text-foreground transition hover:bg-muted">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[88vw] sm:w-[400px]">
            <SheetHeader className="text-left">
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>Updates on your orders and offers.</SheetDescription>
            </SheetHeader>
            <ul className="mt-4 space-y-2">
              {notifications.map((n) => (
                <li key={n.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    <span className="text-[11px] text-muted-foreground">{n.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  {n.unread && <span className="mt-2 inline-block rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">New</span>}
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>

        <Link
          to="/app/profile"
          aria-label="Profile"
          className="grid h-10 w-10 place-items-center rounded-full gradient-primary text-primary-foreground font-bold shadow-soft"
        >
          A
        </Link>
      </div>
    </header>
  );
}
