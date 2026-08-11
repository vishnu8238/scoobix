import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { useState, useEffect } from "react";
import { ChevronRight, Store, MapPin, Clock, Banknote, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/format";
import { useAuth } from "@/lib/auth-store";
import { saveOnboardingDraft, logOnboardingEvent } from "@/lib/manager-api";
import { ImageUploader } from "@/components/cravio/ImageUploader";
import { LocationPicker } from "@/components/maps/LocationPicker";

export const Route = createFileRoute("/partner/onboarding")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Onboarding" }] }),
  component: () => (
    <RoleGuard allow="partner">
      <PartnerOnboarding />
    </RoleGuard>
  ),
});

const STEPS = [
  { key: "business", title: "Business details", icon: Store },
  { key: "location", title: "Address & hours", icon: MapPin },
  { key: "menu", title: "Menu basics", icon: Clock },
  { key: "payouts", title: "Payout setup", icon: Banknote },
];

function PartnerOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cuisine: "",
    owner_name: "",
    phone: "",
    address: "",
    city: "",
    latitude: null as number | null,
    longitude: null as number | null,
    opening_time: "10:00",
    closing_time: "23:00",
    bank_account: "",
    bank_ifsc: "",
    gst_number: "",
    logo_url: "",
  });

  useEffect(() => {
    if (user) {
      setForm(f => ({ ...f, owner_name: user.name, phone: user.phone || "", contact_email: user.email }));
    }
  }, [user]);

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

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
        setSubmitted(true);
      }
    } catch (e) {
      toast.error("Failed to submit onboarding");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto min-h-svh max-w-[480px] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600 mb-6">
          <Check className="h-10 w-10" />
        </div>
        <h2 className="font-display text-2xl font-bold">Onboarding submitted!</h2>
        <p className="mt-2 text-muted-foreground">Your application for <span className="font-semibold text-foreground">{form.name}</span> is being reviewed by our team.</p>
        <Button className="mt-8 rounded-full h-12 px-8" onClick={() => navigate({ to: "/partner" })}>Return to Dashboard</Button>
      </div>
    );
  }

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

      <h1 className="mt-8 font-display text-2xl font-extrabold tracking-tight">{STEPS[step].title}</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Tell us about your restaurant to get listed on Scoobix.</p>

      <div className="mt-6 space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        {step === 0 && <>
          <Field label="Restaurant name" placeholder="Trattoria Verde" value={form.name} onChange={v => update("name", v)} />
          <Field label="Cuisine type" placeholder="Italian · Pizza · Pasta" value={form.cuisine} onChange={v => update("cuisine", v)} />
          <Field label="Owner name" placeholder="Marco Bianchi" value={form.owner_name} onChange={v => update("owner_name", v)} />
          <Field label="Phone" placeholder="+91 98xxxxxx02" value={form.phone} onChange={v => update("phone", v)} />
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-4 block">Restaurant Logo</Label>
          <ImageUploader type="logo" onChange={(r) => update("logo_url", r?.image_url ?? "")} />
        </>}
        {step === 1 && <>
          <LocationPicker 
            latitude={form.latitude} 
            longitude={form.longitude} 
            address={form.address}
            onChange={(lat, lng, addr) => {
              update("latitude", lat);
              update("longitude", lng);
              update("address", addr);
            }} 
          />
          <Field label="City" placeholder="Mumbai" value={form.city} onChange={v => update("city", v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opens at" placeholder="10:00" value={form.opening_time} onChange={v => update("opening_time", v)} />
            <Field label="Closes at" placeholder="23:00" value={form.closing_time} onChange={v => update("closing_time", v)} />
          </div>
        </>}
        {step === 2 && <p className="text-sm text-muted-foreground py-4">Menu setup is available once your account is live.</p>}
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
            if (step === STEPS.length - 1) handleFinish();
            else setStep(step + 1);
          }}
        >
          {loading ? "Submitting..." : step === STEPS.length - 1 ? <>Submit for review <Check className="ml-1 h-4 w-4" /></> : <>Continue <ChevronRight className="ml-1 h-4 w-4" /></>}
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
