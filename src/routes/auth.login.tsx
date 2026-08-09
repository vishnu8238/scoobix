import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mail, Lock, ArrowRight, Phone, KeyRound } from "lucide-react";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ROLE_HOME, useAuth, getPortalIntent, resolveAuthenticatedDestination } from "@/lib/auth-store";
import { APPS, type AppId } from "@/lib/apps";
import type { User } from "@/lib/types";
import { OTP_LENGTH, OTP_RESEND_SECONDS } from "@/lib/phone-otp";

type LoginSearch = { app?: AppId; redirect?: string };

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    app: (["customer", "partner", "rider", "admin", "manager"] as const).includes(search.app as AppId)
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
  const requestedPortal = appId;
  const app = requestedPortal ? APPS[requestedPortal as AppId] : null;
  const {
    user,
    loading,
    signIn,
    signInWithProvider,
    phoneOtpEnabled,
    requestPhoneOtp,
    verifyPhoneLogin,
    resendVerification,
    signOut,
    oauthError,
    clearOAuthError,
    setPortal,
  } = useAuth();

  // Ensure portal context is set if we arrive via direct URL with ?app=
  useEffect(() => {
    if (appId) setPortal(appId);
  }, [appId, setPortal]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState(false);

  // Phone OTP
  const [mode, setMode] = useState<"password" | "phone">("password");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const autoVerified = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (loading || !user) return;
    
    // AuthProvider handles the initial landing redirect.
    // This effect handles secondary "tokens just arrived" stabilization or re-auths.
    console.log("[AUTH_FORENSIC] Login Page: User detected. Waiting for authoritative redirect...");
  }, [loading, user]);

  const land = (user: User) => {
    toast.success(`Welcome back, ${user.name}`);
    // DO NOT independently navigate here. 
    // AuthProvider's setUser() will detect the new user state and 
    // resolveAuthenticatedDestination() to handle the authoritative redirect.
    console.log("[AUTH_ADMISSION] Login successful. Waiting for AuthProvider authoritative redirect...");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (!res.ok) {
      setUnverified(!!res.needsVerification);
      toast.error(res.message ?? "Sign in failed");
      return;
    }
    land(res.user!);
  };

  useEffect(() => {
    if (!oauthError) return;
    toast.error(oauthError);
    clearOAuthError();
  }, [oauthError, clearOAuthError]);

  const oauth = async (provider: "google" | "apple", forceSelect = false) => {
    setBusy(true);
    const intent = getPortalIntent(window.location.pathname, window.location.search);
    const res = await signInWithProvider(provider, intent ?? undefined, !!intent, forceSelect);
    if (!res.ok) {
      setBusy(false);
      toast.error(res.message ?? "Could not start sign-in");
    }
  };

  const sendOtp = async () => {
    setBusy(true);
    const res = await requestPhoneOtp(phone);
    setBusy(false);
    if (!res.ok) { toast.error(res.message ?? "Could not send code"); return; }
    autoVerified.current = false;
    setOtpSent(true);
    setCooldown(res.resendAfter || OTP_RESEND_SECONDS);
    toast.success("Verification code sent");
  };

  const confirmOtp = async (code = otp) => {
    setBusy(true);
    const res = await verifyPhoneLogin(phone, code, app?.role);
    setBusy(false);
    if (!res.ok) { toast.error(res.message ?? "Invalid code"); return; }
    land(res.user!);
  };

  useEffect(() => {
    if (mode !== "phone" || !otpSent || busy || autoVerified.current) return;
    if (otp.replace(/\D/g, "").length === OTP_LENGTH) {
      autoVerified.current = true;
      void confirmOtp(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, otpSent, mode]);

  return (
    <div className="min-h-svh px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-12">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <ScoobixMark size={48} />
        <p className="eyebrow mt-4">Welcome back</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
          Sign in to {app ? app.shortName : "Scoobix"}
        </h1>
        {appId && appId !== "customer" && (
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
            {appId} Portal
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">Use your Scoobix account credentials.</p>
      </div>

      <form onSubmit={submit} className="mx-auto mt-6 max-w-md space-y-4">
        {mode === "password" ? (
          <div className="space-y-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
            <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@scoobix.app" />
            <Field icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            <div className="flex justify-end">
              <Link to="/auth/forgot" className="text-[12px] font-bold text-primary">Forgot password?</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
            <Field icon={Phone} label="Phone number" type="tel" value={phone} onChange={setPhone} placeholder="+91 98765 43210" />
            {otpSent && (
              <>
                <Field icon={KeyRound} label={`${OTP_LENGTH}-digit code`} type="text" value={otp} onChange={setOtp} placeholder="••••••" />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={cooldown > 0}
                    onClick={() => void sendOtp()}
                    className="text-[12px] font-bold text-primary disabled:text-muted-foreground"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {unverified && (
          <button
            type="button"
            onClick={async () => {
              const res = await resendVerification(email);
              res.ok ? toast.success(res.message) : toast.error(res.message);
            }}
            className="w-full rounded-2xl bg-secondary/60 px-4 py-3 text-[12.5px] font-semibold text-muted-foreground"
          >
            Email not verified — tap to resend the verification email
          </button>
        )}

        {mode === "password" ? (
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow">
            {busy ? "Signing in…" : <>Sign in <ArrowRight className="ml-1 h-4 w-4" /></>}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={busy || (!otpSent ? phone.trim().length < 6 : otp.trim().length < OTP_LENGTH)}
            onClick={() => (otpSent ? void confirmOtp() : void sendOtp())}
            className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow"
          >
            {busy ? "Please wait…" : otpSent ? <>Verify &amp; continue <ArrowRight className="ml-1 h-4 w-4" /></> : "Send code"}
          </Button>
        )}

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border/70" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">or continue with</span>
          <span className="h-px flex-1 bg-border/70" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void oauth("google")}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-card text-sm font-bold shadow-soft ring-1 ring-border/60 transition active:scale-95 disabled:opacity-60"
          >
            <GoogleGlyph /> Google
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void oauth("apple")}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-card text-sm font-bold shadow-soft ring-1 ring-border/60 transition active:scale-95 disabled:opacity-60"
          >
            <AppleGlyph /> Apple
          </button>
        </div>

        {phoneOtpEnabled && (
          <button
            type="button"
            onClick={() => { setMode(mode === "password" ? "phone" : "password"); setOtpSent(false); setOtp(""); }}
            className="w-full text-center text-[12.5px] font-bold text-primary"
          >
            {mode === "password" ? "Sign in with phone number" : "Sign in with email instead"}
          </button>
        )}

        <p className="text-center text-[12.5px] text-muted-foreground">
          New to Scoobix? <Link to="/auth/signup" className="font-bold text-primary">Create an account</Link>
        </p>
      </form>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.7 12 4.7Z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-foreground" aria-hidden>
      <path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.6.9-.8 0-1.9-.9-3.1-.8-1.6 0-3 .9-3.8 2.4-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3.1-.7 1.4 0 1.8.7 3.1.7 1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.5-1-2.5-3.4ZM14 4.6c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.9-1 3 1 .1 2.1-.5 2.8-1.4Z" />
    </svg>
  );
}

function Field({ icon: Icon, label, type, value, onChange, placeholder }: { icon: any; label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string }) {
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
