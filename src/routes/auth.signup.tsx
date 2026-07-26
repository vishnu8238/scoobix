import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Utensils, Store, Bike } from "lucide-react";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ROLE_HOME, useAuth } from "@/lib/auth-store";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({ meta: [{ title: "Scoobix · Create account" }] }),
  component: SignupPage,
});

const ROLES: { value: Role; label: string; icon: typeof Utensils; next?: string }[] = [
  { value: "customer", label: "Customer",   icon: Utensils },
  { value: "partner",  label: "Restaurant", icon: Store, next: "/partner/onboarding" },
  { value: "rider",    label: "Rider",      icon: Bike,  next: "/rider/onboarding" },
];

function SignupPage() {
  const navigate = useNavigate();
  const { signUp, signInWithProvider } = useAuth();
  const [role, setRole] = useState<Role>("customer");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await signUp({ ...form, role });
    setBusy(false);
    if (!res.ok) { toast.error(res.message ?? "Sign up failed"); return; }
    if (res.needsVerification) { toast.success(res.message ?? "Verify your email to continue"); return; }
    toast.success("Account created");
    const next = ROLES.find((r) => r.value === role)?.next ?? ROLE_HOME[role];
    navigate({ to: next });
  };

  // OAuth sign-up and sign-in are the same call — the provider account is
  // linked to the existing user when the email already exists.
  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    const res = await signInWithProvider(provider, role);
    if (!res.ok) { setBusy(false); toast.error(res.message ?? "Could not start sign-up"); }
  };


  return (
    <div className="min-h-svh px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-12">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <ScoobixMark size={48} />
        <p className="eyebrow mt-4">Get started</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Create your account</h1>
      </div>

      <form onSubmit={submit} className="mx-auto mt-6 max-w-md space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map((r) => (
            <button key={r.value} type="button" onClick={() => setRole(r.value)}
              className={cn("flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-[11px] font-bold ring-1 ring-border/60 transition active:scale-95",
                role === r.value && "bg-primary-soft text-primary ring-primary/40")}>
              <r.icon className="h-5 w-5" strokeWidth={2.4} />
              {r.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <F label="Full name"     value={form.name}     onChange={(v) => setForm({ ...form, name: v })}     placeholder="Alex Carter" />
          <F label="Email"         value={form.email}    onChange={(v) => setForm({ ...form, email: v })}    placeholder="you@cravio.app" type="email" />
          <F label="Phone"         value={form.phone}    onChange={(v) => setForm({ ...form, phone: v })}    placeholder="+91 9xxxxxxxxx" />
          <F label="Password"      value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="••••••••" type="password" />
        </div>

        <Button type="submit" disabled={busy} className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow">
          {busy ? "Creating…" : <>Create account <ArrowRight className="ml-1 h-4 w-4" /></>}
        </Button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border/70" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">or sign up with</span>
          <span className="h-px flex-1 bg-border/70" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={() => void oauth("google")}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-card text-sm font-bold shadow-soft ring-1 ring-border/60 transition active:scale-95 disabled:opacity-60">
            Google
          </button>
          <button type="button" disabled={busy} onClick={() => void oauth("apple")}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-card text-sm font-bold shadow-soft ring-1 ring-border/60 transition active:scale-95 disabled:opacity-60">
            Apple
          </button>
        </div>


        <p className="text-center text-[12.5px] text-muted-foreground">
          Already have one? <Link to="/auth/login" className="font-bold text-primary">Sign in</Link>
        </p>
      </form>
    </div>
  );
}

function F({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 rounded-2xl bg-secondary/50" />
    </div>
  );
}
