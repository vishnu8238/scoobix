import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, ArrowRight, Utensils, Store, Bike, ShieldCheck } from "lucide-react";
import { CravioMark } from "@/components/cravio/CravioLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ROLE_HOME, useAuth } from "@/lib/auth-store";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/auth/login")({
  head: () => ({ meta: [{ title: "Cravio · Sign in" }] }),
  component: LoginPage,
});

const ROLES: { value: Role; label: string; icon: typeof Utensils }[] = [
  { value: "customer", label: "Customer", icon: Utensils },
  { value: "partner",  label: "Restaurant", icon: Store },
  { value: "rider",    label: "Rider",   icon: Bike },
  { value: "admin",    label: "Admin",   icon: ShieldCheck },
];

function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("customer");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await signIn(email, password, role);
    setBusy(false);
    if (!res.ok) { toast.error(res.message ?? "Sign in failed"); return; }
    toast.success(`Welcome back, ${res.user!.name}`);
    navigate({ to: ROLE_HOME[res.user!.role] });
  };

  return (
    <div className="min-h-svh px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-12">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <CravioMark size={48} />
        <p className="eyebrow mt-4">Welcome back</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Sign in to Cravio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick your role and continue.</p>
      </div>

      <form onSubmit={submit} className="mx-auto mt-6 max-w-md space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl bg-card p-3 text-[11px] font-bold ring-1 ring-border/60 transition active:scale-95",
                role === r.value && "bg-primary-soft text-primary ring-primary/40",
              )}
            >
              <r.icon className="h-5 w-5" strokeWidth={2.4} />
              {r.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@cravio.app" />
          <Field icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
          <div className="flex justify-end">
            <Link to="/auth/forgot" className="text-[12px] font-bold text-primary">Forgot password?</Link>
          </div>
        </div>

        <Button type="submit" disabled={busy} className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow">
          {busy ? "Signing in…" : <>Sign in <ArrowRight className="ml-1 h-4 w-4" /></>}
        </Button>

        <p className="text-center text-[12.5px] text-muted-foreground">
          New to Cravio? <Link to="/auth/signup" className="font-bold text-primary">Create an account</Link>
        </p>

        <div className="rounded-2xl bg-secondary/60 p-3 text-center text-[11px] text-muted-foreground">
          Demo: any email works. Use <code>admin@cravio.app</code>, <code>partner@</code>, <code>rider@</code>, or <code>customer@</code> to auto-route.
        </div>
      </form>
    </div>
  );
}

function Field({ icon: Icon, label, type, value, onChange, placeholder }: { icon: typeof Mail; label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 rounded-2xl bg-secondary/50 pl-9" />
      </div>
    </div>
  );
}
