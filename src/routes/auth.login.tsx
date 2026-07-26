import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ROLE_HOME, useAuth } from "@/lib/auth-store";
import { APPS, type AppId } from "@/lib/apps";

type LoginSearch = { app?: AppId; redirect?: string };

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    app: (["customer", "partner", "rider", "admin"] as const).includes(search.app as AppId)
      ? (search.app as AppId)
      : undefined,
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Scoobix · Sign in" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { app: appId, redirect } = Route.useSearch() as LoginSearch;
  const app = appId ? APPS[appId] : null;
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (!res.ok) { toast.error(res.message ?? "Sign in failed"); return; }
    const user = res.user!;
    toast.success(`Welcome back, ${user.name}`);
    // The account's own role decides the destination — never the form.
    const home = ROLE_HOME[user.role];
    const canResume = !!redirect && (!app || app.role === user.role) && redirect.startsWith(home);
    navigate({ to: (canResume ? redirect : home) as never, replace: true });
  };

  return (
    <div className="min-h-svh px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-12">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <ScoobixMark size={48} />
        <p className="eyebrow mt-4">Welcome back</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
          Sign in to {app ? app.shortName : "Scoobix"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Use your Scoobix account credentials.</p>
      </div>

      <form onSubmit={submit} className="mx-auto mt-6 max-w-md space-y-4">
        <div className="space-y-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@scoobix.app" />
          <Field icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
          <div className="flex justify-end">
            <Link to="/auth/forgot" className="text-[12px] font-bold text-primary">Forgot password?</Link>
          </div>
        </div>

        <Button type="submit" disabled={busy} className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow">
          {busy ? "Signing in…" : <>Sign in <ArrowRight className="ml-1 h-4 w-4" /></>}
        </Button>

        <p className="text-center text-[12.5px] text-muted-foreground">
          New to Scoobix? <Link to="/auth/signup" className="font-bold text-primary">Create an account</Link>
        </p>
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
