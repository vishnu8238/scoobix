import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Store, MapPin, Clock, Banknote, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/partner/onboarding")({
  head: () => ({ meta: [{ title: "Cravio Partner · Onboarding" }] }),
  component: PartnerOnboarding,
});

const STEPS = [
  { key: "business", title: "Business details", icon: Store },
  { key: "location", title: "Address & hours",  icon: MapPin },
  { key: "menu",     title: "Menu basics",      icon: Clock },
  { key: "payouts",  title: "Payout setup",     icon: Banknote },
];

function PartnerOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const StepIcon = STEPS[step].icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto min-h-svh max-w-[480px] px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-24">
      <div className="flex items-center gap-3">
        <Link to="/partner" className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Skip</Link>
        <div className="ml-auto text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Step {step + 1} of {STEPS.length}</div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <span key={s.key} className={cn("h-1.5 flex-1 rounded-full transition-all", i <= step ? "bg-primary" : "bg-foreground/10")} />
        ))}
      </div>

      <div className="mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><StepIcon className="h-7 w-7" strokeWidth={2.5} /></div>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">{STEPS[step].title}</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Tell us about your restaurant to get listed on Cravio.</p>

      <div className="mt-6 space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        {step === 0 && <>
          <Field label="Restaurant name" placeholder="Trattoria Verde" />
          <Field label="Cuisine type"    placeholder="Italian · Pizza · Pasta" />
          <Field label="Owner name"      placeholder="Marco Bianchi" />
          <Field label="Phone"           placeholder="+91 98xxxxxx02" />
        </>}
        {step === 1 && <>
          <Field label="Street address"  placeholder="12 Hearth Lane" />
          <Field label="City"            placeholder="Mumbai" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opens at" placeholder="10:00" />
            <Field label="Closes at" placeholder="23:00" />
          </div>
        </>}
        {step === 2 && <>
          <Field label="Number of menu items" placeholder="42" />
          <Field label="Average prep time" placeholder="18 min" />
          <Field label="Average ticket" placeholder="₹720" />
        </>}
        {step === 3 && <>
          <Field label="Bank account" placeholder="HDFC ••• 4421" />
          <Field label="IFSC" placeholder="HDFC0001234" />
          <Field label="GSTIN" placeholder="27ABCDE1234F1Z5" />
        </>}
      </div>

      <div className="mt-6 flex items-center gap-3">
        {step > 0 && <Button variant="ghost" className="rounded-full" onClick={() => setStep(step - 1)}>Back</Button>}
        <Button
          className="ml-auto h-12 rounded-full gradient-primary px-6 text-sm font-bold text-primary-foreground shadow-glow"
          onClick={() => {
            if (last) { toast.success("Onboarding submitted · pending review"); navigate({ to: "/partner" }); }
            else setStep(step + 1);
          }}
        >
          {last ? <>Submit for review <Check className="ml-1 h-4 w-4" /></> : <>Continue <ChevronRight className="ml-1 h-4 w-4" /></>}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input placeholder={placeholder} className="h-11 rounded-2xl bg-secondary/50" />
    </div>
  );
}
