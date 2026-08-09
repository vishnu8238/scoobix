import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ChevronRight, Store, MapPin, Clock, Banknote, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/format";
import { useAuth } from "@/lib/auth-store";
import { saveOnboardingDraft, logOnboardingEvent } from "@/lib/manager-api";

export const Route = createFileRoute("/partner/onboarding")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Onboarding" }] }),
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
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cuisine: "",
    owner_name: "",
    phone: "",
    address: "",
    city: "",
    opening_time: "10:00",
    closing_time: "23:00",
    bank_account: "",
    bank_ifsc: "",
    gst_number: "",
  });

  useEffect(() => {
    if (user) {
      setForm(f => ({ ...f, owner_name: user.name, phone: user.phone || "", contact_email: user.email }));
    }
  }, [user]);

  const StepIcon = STEPS[step].icon;
  const last = step === STEPS.length - 1;

  const handleFinish = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await saveOnboardingDraft(null, {
        ...form,
        owner_id: user.id,
        onboarding_status: "submitted",
        status: "pending"
      });
      if (res?.id) {
        await logOnboardingEvent({
          restaurantId: res.id,
          status: "submitted",
          note: "Self-onboarding submitted by partner",
          actorRole: "partner"
        });
        toast.success("Onboarding submitted · pending review");
        navigate({ to: "/partner" as any });
      }
    } catch (e) {
      toast.error("Failed to submit onboarding");
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

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
      <p className="mt-1 text-[13px] text-muted-foreground">Tell us about your restaurant to get listed on Scoobix.</p>

      <div className="mt-6 space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        {step === 0 && <>
          <Field label="Restaurant name" placeholder="Trattoria Verde" value={form.name} onChange={v => update("name", v)} />
          <Field label="Cuisine type"    placeholder="Italian · Pizza · Pasta" value={form.cuisine} onChange={v => update("cuisine", v)} />
          <Field label="Owner name"      placeholder="Marco Bianchi" value={form.owner_name} onChange={v => update("owner_name", v)} />
          <Field label="Phone"           placeholder="+91 98xxxxxx02" value={form.phone} onChange={v => update("phone", v)} />
        </>}
        {step === 1 && <>
          <Field label="Street address"  placeholder="12 Hearth Lane" value={form.address} onChange={v => update("address", v)} />
          <Field label="City"            placeholder="Mumbai" value={form.city} onChange={v => update("city", v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opens at" placeholder="10:00" value={form.opening_time} onChange={v => update("opening_time", v)} />
            <Field label="Closes at" placeholder="23:00" value={form.closing_time} onChange={v => update("closing_time", v)} />
          </div>
        </>}
        {step === 2 && <>
          <p className="text-sm text-muted-foreground">You'll be able to add your full menu once your account is live.</p>
        </>}
        {step === 3 && <>
          <Field label="Bank account" placeholder="Account Number" value={form.bank_account} onChange={v => update("bank_account", v)} />
          <Field label="IFSC" placeholder="HDFC0001234" value={form.bank_ifsc} onChange={v => update("bank_ifsc", v)} />
          <Field label="GSTIN" placeholder="27ABCDE1234F1Z5" value={form.gst_number} onChange={v => update("gst_number", v)} />
        </>}
      </div>

      <div className="mt-6 flex items-center gap-3">
        {step > 0 && <Button variant="ghost" className="rounded-full" onClick={() => setStep(step - 1)}>Back</Button>}
        <Button
          className="ml-auto h-12 rounded-full gradient-primary px-6 text-sm font-bold text-primary-foreground shadow-glow"
          disabled={loading}
          onClick={() => {
            if (last) handleFinish();
            else setStep(step + 1);
          }}
        >
          {loading ? "Submitting..." : last ? <>Submit for review <Check className="ml-1 h-4 w-4" /></> : <>Continue <ChevronRight className="ml-1 h-4 w-4" /></>}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="h-11 rounded-2xl bg-secondary/50" />
    </div>
  );
}
