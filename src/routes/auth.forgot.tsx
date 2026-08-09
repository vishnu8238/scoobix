import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/auth/forgot")({
  head: () => ({ meta: [{ title: "Scoobix · Reset password" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await auth.resetPassword(email);
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(res.message);
    navigate({ to: "/auth/login" });
  };

  return (
    <div className="min-h-svh px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-12">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <ScoobixMark size={48} />
        <p className="eyebrow mt-4">Forgot password</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">We'll send a reset link to your email.</p>
      </div>

      <form onSubmit={submit} className="mx-auto mt-6 max-w-md space-y-4">
        <div className="space-y-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@scoobix.app" className="h-11 rounded-2xl bg-secondary/50 pl-9" />
            </div>
          </div>
        </div>

        <Button type="submit" disabled={busy} className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow">
          {busy ? "Sending…" : <>Send reset link <ArrowRight className="ml-1 h-4 w-4" /></>}
        </Button>

        <p className="text-center text-[12.5px] text-muted-foreground">
          Remembered it? <Link to="/auth/login" className="font-bold text-primary">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
