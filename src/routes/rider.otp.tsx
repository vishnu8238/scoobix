import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, Store, MapPin, Check, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { riderActiveDelivery } from "@/lib/role-data";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/rider/otp")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Complete delivery" }] }),
  component: OtpPage,
});

const CORRECT = "4821";

function OtpPage() {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);

  const setDigit = (i: number, v: string) => {
    const x = v.replace(/\D/g, "").slice(-1);
    setDigits((d) => d.map((c, idx) => (idx === i ? x : c)));
    if (x && i < 3) {
      const next = document.getElementById(`otp-${i + 1}`);
      next?.focus();
    }
  };

  const code = digits.join("");
  const ready = code.length === 4;

  const submit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      if (code === CORRECT) {
        toast.success("Delivery completed · +₹600 earned");
        navigate({ to: "/rider/earnings" });
      } else {
        toast.error("Wrong OTP · ask the customer to share again");
      }
    }, 700);
  };

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Complete delivery" subtitle={riderActiveDelivery.id} />

      <section className="mx-4 mt-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><MapPin className="h-6 w-6" strokeWidth={2.4} /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dropping off to</p>
            <h3 className="truncate font-display text-base font-bold">{riderActiveDelivery.customer}</h3>
            <p className="truncate text-xs text-muted-foreground">{riderActiveDelivery.customerAddress}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => toast(`Calling ${riderActiveDelivery.customer}…`)} variant="outline" className="rounded-2xl"><Phone className="mr-2 h-4 w-4 text-primary" /> Call customer</Button>
          <Button onClick={() => toast("Chat opened")} variant="outline" className="rounded-2xl"><MessageCircle className="mr-2 h-4 w-4 text-primary" /> Message</Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={() => toast(`Calling ${riderActiveDelivery.restaurant}…`)} variant="outline" className="rounded-2xl"><Store className="mr-2 h-4 w-4 text-primary" /> Call restaurant</Button>
          <Button onClick={() => toast(`Calling ${riderActiveDelivery.restaurantPhone}`)} variant="outline" className="rounded-2xl"><Phone className="mr-2 h-4 w-4 text-primary" /> Helpline</Button>
        </div>
      </section>

      <section className="mx-4 mt-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <h3 className="text-sm font-bold">Enter customer OTP</h3>
        <p className="mt-1 text-xs text-muted-foreground">Ask the customer for their 4-digit code to confirm hand-off. Hint: it's <span className="font-mono font-bold">{CORRECT}</span></p>

        <div className="mt-5 flex items-center justify-center gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              id={`otp-${i}`}
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              className={cn(
                "h-16 w-14 rounded-2xl border-2 bg-secondary/40 text-center font-display text-2xl font-extrabold outline-none transition",
                d ? "border-primary bg-primary-soft text-primary" : "border-border text-foreground focus:border-primary",
              )}
            />
          ))}
        </div>

        <Button disabled={!ready || submitting} onClick={submit} className="mt-6 h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">
          {submitting ? "Verifying…" : <><Check className="mr-2 h-4 w-4" /> Confirm delivery</>}
        </Button>
      </section>
    </div>
  );
}
