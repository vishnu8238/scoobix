import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { useState } from "react";
import { ChevronRight, Bike, User, FileCheck2, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/rider/onboarding")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Onboarding" }] }),
  component: () => (
    <RoleGuard>
      <RiderOnboarding />
    </RoleGuard>
  ),
});

const STEPS = [
  { key: "personal", title: "Personal details", icon: User },
  { key: "vehicle",  title: "Vehicle details",  icon: Bike },
  { key: "docs",     title: "Documents",        icon: FileCheck2 },
];

const VEHICLES = ["Bike", "Scooter", "E-bike", "Bicycle"];

function RiderOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [vehicle, setVehicle] = useState("Scooter");
  const StepIcon = STEPS[step].icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto min-h-svh max-w-[480px] px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-24">
      <div className="flex items-center gap-3">
        <Link to="/rider" className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Skip</Link>
        <div className="ml-auto text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Step {step + 1} of {STEPS.length}</div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <span key={s.key} className={cn("h-1.5 flex-1 rounded-full transition-all", i <= step ? "bg-primary" : "bg-foreground/10")} />
        ))}
      </div>

      <div className="mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><StepIcon className="h-7 w-7" strokeWidth={2.5} /></div>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">{STEPS[step].title}</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Tell us a bit about you to start riding with Scoobix.</p>

      <div className="mt-6 space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        {step === 0 && <>
          <Field label="Full name" placeholder="Aarav Mehta" />
          <Field label="Phone"     placeholder="+91 98xxxxxx02" />
          <Field label="Email"     placeholder="rider@cravio.app" />
        </>}
        {step === 1 && <>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Vehicle type</Label>
            <div className="grid grid-cols-4 gap-2">
              {VEHICLES.map((v) => (
                <button key={v} type="button" onClick={() => setVehicle(v)}
                  className={cn("rounded-2xl bg-secondary/50 px-2 py-2 text-[11px] font-bold transition active:scale-95",
                    vehicle === v && "bg-primary-soft text-primary ring-1 ring-primary/40")}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <Field label="Vehicle number" placeholder="KA 03 9981" />
          <Field label="Model"          placeholder="Honda Activa 6G" />
        </>}
        {step === 2 && <>
          <UploadField label="Driving licence" />
          <UploadField label="Vehicle RC" />
          <UploadField label="Insurance" />
        </>}
      </div>

      <div className="mt-6 flex items-center gap-3">
        {step > 0 && <Button variant="ghost" className="rounded-full" onClick={() => setStep(step - 1)}>Back</Button>}
        <Button
          className="ml-auto h-12 rounded-full gradient-primary px-6 text-sm font-bold text-primary-foreground shadow-glow"
          onClick={() => {
            if (last) { toast.success("Application submitted · pending verification"); navigate({ to: "/rider" }); }
            else setStep(step + 1);
          }}
        >
          {last ? <>Submit <Check className="ml-1 h-4 w-4" /></> : <>Continue <ChevronRight className="ml-1 h-4 w-4" /></>}
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

function UploadField({ label }: { label: string }) {
  const [name, setName] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <label className="flex h-11 cursor-pointer items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/30 px-3 text-sm font-bold text-muted-foreground transition active:scale-[0.99]">
        <Upload className="h-4 w-4" />
        <span className="truncate">{name ?? "Upload document"}</span>
        <input type="file" className="hidden" onChange={(e) => setName(e.target.files?.[0]?.name ?? null)} />
      </label>
    </div>
  );
}
