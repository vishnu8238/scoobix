import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Building2, Users, Wallet, CalendarDays, Send } from "lucide-react";
import { restaurants } from "@/lib/mock-data";
import { useBulk } from "@/lib/scoobix-extras";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, currency } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/bulk")({
  head: () => ({ meta: [
    { title: "Scoobix Corporate & Bulk Orders" },
    { name: "description", content: "Request catering, office lunches, or event orders — Scoobix partners reply within hours." },
    { property: "og:title", content: "Scoobix Corporate & Bulk Orders" },
    { property: "og:description", content: "Catering & office ordering built on Scoobix." },
  ] }),
  component: BulkPage,
});

function BulkPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requests, create } = useBulk();

  const today = new Date().toISOString().slice(0, 10);
  const [eventDate, setEventDate] = useState(today);
  const [eventTime, setEventTime] = useState("13:00");
  const [guestCount, setGuest] = useState(25);
  const [budget, setBudget] = useState(5000);
  const [restaurantId, setRestaurantId] = useState<string>("any");
  const [notes, setNotes] = useState("");

  const myRequests = requests.filter((r) => r.customerId === (user?.id ?? "guest"));

  const submit = () => {
    if (guestCount < 5) { toast.error("Minimum 5 guests"); return; }
    create({
      customerId: user?.id ?? "guest",
      customerName: user?.name ?? "Guest",
      restaurantId: restaurantId === "any" ? undefined : restaurantId,
      restaurantName: restaurantId === "any" ? undefined : restaurants.find((r) => r.id === restaurantId)?.name,
      eventDate, eventTime, guestCount, budget, notes: notes.trim() || undefined,
    });
    toast.success("Request sent · partner will respond soon");
    setNotes("");
  };

  return (
    <div className="min-h-svh pb-28">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_40px] items-center gap-3">
          <button onClick={() => navigate({ to: "/app/more" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-center font-display text-base font-bold">Corporate & Bulk</h1>
          <div />
        </div>
      </header>

      <div className="p-4 space-y-4">
        <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-extrabold">Request catering</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Office lunches, events, birthdays — we'll match you with the right kitchen.</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="eyebrow flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Date</span>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-1 w-full rounded-2xl bg-secondary px-3 py-2.5 text-sm font-semibold outline-none" />
            </label>
            <label className="block">
              <span className="eyebrow">Time</span>
              <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="mt-1 w-full rounded-2xl bg-secondary px-3 py-2.5 text-sm font-semibold outline-none" />
            </label>
            <label className="block">
              <span className="eyebrow flex items-center gap-1"><Users className="h-3 w-3" /> Guests</span>
              <Input type="number" min={5} value={guestCount} onChange={(e) => setGuest(Number(e.target.value))} className="mt-1 rounded-2xl" />
            </label>
            <label className="block">
              <span className="eyebrow flex items-center gap-1"><Wallet className="h-3 w-3" /> Budget (₹)</span>
              <Input type="number" min={500} step={500} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="mt-1 rounded-2xl" />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="eyebrow">Restaurant</span>
            <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} className="mt-1 w-full rounded-2xl bg-secondary px-3 py-2.5 text-sm font-semibold outline-none">
              <option value="any">Any Scoobix partner</option>
              {restaurants.slice(0, 12).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 400))} placeholder="Menu preferences, dietary needs, setup details…" className="mt-3 min-h-[90px] rounded-2xl" />

          <Button onClick={submit} className="mt-4 h-12 w-full rounded-full gradient-primary text-primary-foreground shadow-glow">
            <Send className="mr-2 h-4 w-4" /> Send request
          </Button>
        </section>

        <section>
          <p className="eyebrow px-1">Your requests</p>
          {myRequests.length === 0 ? (
            <p className="mt-2 rounded-2xl bg-card p-4 text-center text-xs text-muted-foreground ring-1 ring-border/60">No requests yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {myRequests.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                  <div>
                    <p className="text-sm font-bold">{r.eventDate} · {r.guestCount} guests</p>
                    <p className="text-[11px] text-muted-foreground">Budget {currency(r.budget)} · {r.restaurantName ?? "Any partner"}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold capitalize",
                    r.status === "accepted" ? "bg-primary-soft text-primary" :
                    r.status === "rejected" ? "bg-destructive/10 text-destructive" :
                    "bg-warning/15 text-[oklch(0.45_0.14_70)]")}>{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
