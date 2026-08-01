/**
 * Shared account-security surface, mounted in every app's profile/settings
 * screen. Same component for customer, partner, rider and manager — the data is
 * always scoped to the signed-in account.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Laptop, Loader2, LogOut, ShieldCheck, Smartphone, Trash2, KeyRound, Download, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-store";
import { ifChangePassword } from "@/lib/insforge-auth";
import {
  cancelAccountDeletion, consentState, endCurrentSession, exportUserData,
  fetchUserSecurity, lastLogin, listDevices, listLoginHistory, listSessions,
  localSessionId, notePasswordChanged, passwordStrength, recordConsent,
  requestAccountDeletion, revokeAllSessions, revokeSession,
  type ConsentKind, type DeviceRow, type LoginRow, type SessionRow, type UserSecurityRow,
} from "@/lib/security-api";
import { guardMessage, rateLimit } from "@/lib/api-guard";

function when(value?: string): string {
  if (!value) return "—";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return "—";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return new Date(t).toLocaleDateString();
}

const CONSENTS: { kind: ConsentKind; label: string; hint: string }[] = [
  { kind: "marketing_email", label: "Marketing emails", hint: "Offers and product news by email" },
  { kind: "marketing_push", label: "Push notifications", hint: "Deals and reminders on this device" },
  { kind: "marketing_sms", label: "SMS updates", hint: "Order and offer texts" },
];

export function SecurityPanel() {
  const { user, signOut } = useAuth();
  const userId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserSecurityRow | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [last, setLast] = useState<LoginRow | null>(null);
  const [consents, setConsents] = useState<Record<string, { granted?: boolean }>>({});

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [p, s, l, d, ll, c] = await Promise.all([
      fetchUserSecurity(userId).catch(() => null),
      listSessions(userId).catch(() => []),
      listLoginHistory(userId, 20).catch(() => []),
      listDevices(userId, 20).catch(() => []),
      lastLogin(userId).catch(() => null),
      consentState(userId).catch(() => ({})),
    ]);
    setProfile(p); setSessions(s); setLogins(l); setDevices(d); setLast(ll); setConsents(c);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const strength = useMemo(() => passwordStrength(next), [next]);
  const thisSession = localSessionId();

  const changePassword = async () => {
    if (!userId) return;
    if (next !== confirm) { toast.error("New passwords do not match"); return; }
    if (!strength.ok) { toast.error(strength.issues[0] ?? "Choose a stronger password"); return; }
    try {
      rateLimit("auth.password", userId);
    } catch (err) { toast.error(guardMessage(err)); return; }

    setBusy("password");
    try {
      await ifChangePassword(current, next);
      await notePasswordChanged(userId, user?.role);
      setCurrent(""); setNext(""); setConfirm("");
      toast.success("Password updated — other devices were signed out");
      void load();
    } catch (err) {
      toast.error(guardMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const signOutEverywhere = async () => {
    if (!userId) return;
    setBusy("sessions");
    const count = await revokeAllSessions(userId, { id: userId, role: user?.role }, {
      exceptSessionId: thisSession ?? undefined, reason: "user_logout_all",
    }).catch(() => 0);
    setBusy(null);
    toast.success(count ? `Signed out of ${count} other device${count === 1 ? "" : "s"}` : "No other active devices");
    void load();
  };

  const revokeOne = async (row: SessionRow) => {
    if (!userId) return;
    if (row.id === thisSession) {
      await endCurrentSession(userId);
      signOut();
      return;
    }
    await revokeSession(row.id, { id: userId, role: user?.role }, "user_revoked").catch(() => null);
    toast.success("Device signed out");
    void load();
  };

  const exportData = async () => {
    if (!userId) return;
    try { rateLimit("privacy.export", userId); } catch (err) { toast.error(guardMessage(err)); return; }
    setBusy("export");
    try {
      const data = await exportUserData(userId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scoobix-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded");
    } catch (err) {
      toast.error(guardMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleConsent = async (kind: ConsentKind, granted: boolean) => {
    if (!userId) return;
    setConsents((prev) => ({ ...prev, [kind]: { granted } }));
    await recordConsent({ userId, kind, granted, source: "settings" }).catch(() => null);
  };

  const deleteAccount = async () => {
    if (!userId) return;
    setBusy("delete");
    const scheduled = await requestAccountDeletion(userId, user?.role).catch(() => null);
    setBusy(null);
    if (!scheduled) { toast.error("Could not submit the request"); return; }
    toast.success(`Deletion scheduled for ${new Date(scheduled).toLocaleDateString()}`);
    void load();
  };

  const cancelDeletion = async () => {
    if (!userId) return;
    await cancelAccountDeletion(userId, user?.role).catch(() => null);
    toast.success("Deletion request cancelled");
    void load();
  };

  if (!userId) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Account security</h2>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Last sign-in</dt>
            <dd className="text-sm text-foreground">{when(last?.created_at)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Password changed</dt>
            <dd className="text-sm text-foreground">{when(profile?.password_changed_at)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Known devices</dt>
            <dd className="text-sm text-foreground">{devices.length}</dd>
          </div>
        </dl>
        {profile?.account_state === "pending_deletion" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-xs text-foreground">
              Deletion scheduled for{" "}
              {profile.deletion_scheduled_for ? new Date(profile.deletion_scheduled_for).toLocaleDateString() : "soon"}.
            </p>
            <Button size="sm" variant="outline" onClick={cancelDeletion}>Keep my account</Button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Change password</h2>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="sec-current" className="text-xs">Current password</Label>
            <Input id="sec-current" type="password" value={current} autoComplete="current-password"
              onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sec-next" className="text-xs">New password</Label>
            <Input id="sec-next" type="password" value={next} autoComplete="new-password"
              onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sec-confirm" className="text-xs">Confirm new password</Label>
            <Input id="sec-confirm" type="password" value={confirm} autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        {next && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Strength</span>
              <span className="font-medium text-foreground">{strength.label}</span>
            </div>
            <Progress value={(strength.score + 1) * 20} className="h-1.5" />
            {strength.issues.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{strength.issues.join(" · ")}</p>
            )}
          </div>
        )}
        <Button className="mt-3" size="sm" disabled={busy === "password" || !current || !next}
          onClick={changePassword}>
          {busy === "password" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Update password
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Laptop className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Active sessions</h2>
          </div>
          <Button size="sm" variant="outline" disabled={busy === "sessions"} onClick={signOutEverywhere}>
            <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out everywhere
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {sessions.length === 0 && !loading && (
            <li className="text-xs text-muted-foreground">No active sessions recorded yet.</li>
          )}
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm text-foreground">
                  {s.platform === "mobile" ? <Smartphone className="h-3.5 w-3.5" /> : <Laptop className="h-3.5 w-3.5" />}
                  {s.device_label ?? "Unknown device"}
                  {s.id === thisSession && <Badge variant="secondary" className="text-[10px]">This device</Badge>}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {s.app ?? "app"} · {s.ip ?? "unknown IP"} · active {when(s.last_seen_at)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void revokeOne(s)}>Sign out</Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Login history</h2>
        </div>
        <ul className="mt-3 space-y-1.5">
          {logins.length === 0 && !loading && (
            <li className="text-xs text-muted-foreground">Nothing recorded yet.</li>
          )}
          {logins.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-foreground">
                {l.device_label ?? l.browser ?? "Unknown device"} · {l.provider ?? "password"}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                {l.success === false && <Badge variant="destructive" className="text-[10px]">failed</Badge>}
                {when(l.created_at)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Privacy &amp; preferences</h2>
        <div className="mt-3 space-y-3">
          {CONSENTS.map((c) => (
            <div key={c.kind} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-foreground">{c.label}</p>
                <p className="text-[11px] text-muted-foreground">{c.hint}</p>
              </div>
              <Switch
                checked={Boolean(consents[c.kind]?.granted)}
                onCheckedChange={(v) => void toggleConsent(c.kind, v)}
              />
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy === "export"} onClick={exportData}>
            <Download className="mr-2 h-3.5 w-3.5" /> Export my data
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={profile?.account_state === "pending_deletion"}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your Scoobix account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your account is scheduled for deletion after a 14-day grace period. You can cancel
                  any time before then by signing in again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep account</AlertDialogCancel>
                <AlertDialogAction onClick={() => void deleteAccount()}>Request deletion</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}

export default SecurityPanel;
