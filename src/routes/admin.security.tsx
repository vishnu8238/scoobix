import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, Ban, CheckCircle2, Fingerprint, Loader2, Lock,
  RefreshCw, ScanSearch, ShieldAlert, ShieldCheck, Trash2, Unlock, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-store";
import { usePermissions } from "@/hooks/use-permissions";
import {
  acknowledgeSecurityEvents, lockAccount, restoreAccount, revokeAllSessions,
  revokeSession, securityOverview, setDeviceFlags, suspendAccount, unlockAccount,
  type DeviceRow, type LoginRow, type SecurityEventRow, type SessionRow, type UserSecurityRow,
} from "@/lib/security-api";
import {
  FRAUD_LABEL, listFraudReports, resolveFraudReport, runFraudScan,
  type FraudReportRow,
} from "@/lib/fraud-detection";
import {
  archiveOldAudit, auditStats, listAudit, type AuditRow, type AuditStats,
} from "@/lib/audit-api";
import { fixSecurityIssues } from "@/lib/security-actions";
import { PERMISSION_GROUPS, PERMISSION_MATRIX, ROLE_LABEL, type SecurityRole } from "@/lib/permissions";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/admin/security")({
  head: () => ({
    meta: [
      { title: "Scoobix Admin · Security & Audit" },
      { name: "description", content: "Security alerts, fraud reports, active sessions, locked accounts and the platform audit trail for Scoobix." },
      { property: "og:title", content: "Scoobix Admin · Security & Audit" },
      { property: "og:description", content: "Monitor suspicious activity, sessions, devices and every audited action across Scoobix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SecurityPage,
});

type Overview = Awaited<ReturnType<typeof securityOverview>>;

function when(value?: string): string {
  if (!value) return "—";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return "—";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return new Date(t).toLocaleString();
}

function Stat({
  icon: Icon, label, value, tone = "default",
}: {
  icon: typeof Activity; label: string; value: string | number;
  tone?: "default" | "warn" | "danger" | "good";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={cn(
          "h-4 w-4",
          tone === "danger" && "text-destructive",
          tone === "warn" && "text-amber-500",
          tone === "good" && "text-emerald-500",
          tone === "default" && "text-primary",
        )} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function severityBadge(severity?: string) {
  const s = String(severity ?? "info");
  if (s === "critical") return <Badge variant="destructive" className="text-[10px]">critical</Badge>;
  if (s === "high") return <Badge variant="destructive" className="text-[10px]">high</Badge>;
  if (s === "warning" || s === "medium") return <Badge className="bg-amber-500/15 text-amber-600 text-[10px]">{s}</Badge>;
  return <Badge variant="secondary" className="text-[10px]">{s}</Badge>;
}

function SecurityPage() {
  const { user } = useAuth();
  const perms = usePermissions();
  const actor = useMemo(() => ({ id: user?.id ?? "admin", role: perms.role }), [user?.id, perms.role]);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [fraud, setFraud] = useState<FraudReportRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, f, a, s] = await Promise.all([
      securityOverview().catch(() => null),
      listFraudReports({ status: "open", limit: 100 }).catch(() => []),
      listAudit({ category: category === "all" ? "all" : (category as never), pageSize: 80 }).catch(() => []),
      auditStats(30).catch(() => null),
    ]);
    setOverview(o); setFraud(f); setAudit(a); setStats(s);
    setLoading(false);
  }, [category]);

  useEffect(() => { 
    void load(); 
  }, [load]);

  const canManage = perms.can("fraud.manage") || perms.can("user.ban");

  const scan = async () => {
    setBusy("scan");
    toast.loading("Scanning for threats...");
    
    try {
      const res = await runFraudScan(actor);
      toast.success(`Scan complete: ${res.findings} findings identified.`);
      void load();
    } catch (err) {
      console.error("Security scan failed:", err);
      toast.error("Security scan failed to complete.");
    } finally {
      setBusy(null);
    }
  };

  const fixAll = async () => {
    setBusy("fix");
    const t = toast.loading("Executing platform-wide security remediation...");
    
    try {
      const res = await fixSecurityIssues({ 
        data: {
          actorId: actor.id, 
          actorRole: actor.role 
        }
      });
      
      toast.success(
        `Remediation complete: ${res.resolvedFraud} fraud issues resolved, ` +
        `${res.acknowledgedAlerts} alerts acknowledged, and ${res.archivedAudit} audit logs archived.`,
        { id: t, duration: 5000 }
      );
      void load();
    } catch (err) {
      console.error("Security remediation failed:", err);
      toast.error("Security remediation failed to complete.", { id: t });
    } finally {
      setBusy(null);
    }
  };



  const archive = async () => {
    setBusy("archive");
    const n = await archiveOldAudit(180).catch(() => 0);
    setBusy(null);
    toast.success(n ? `Archived ${n} audit entries` : "Nothing to archive");
    void load();
  };

  const filteredAudit = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return audit;
    return audit.filter((r) =>
      [r.action, r.summary, r.actor_role, r.actor_name, r.subject_id, r.actor_id]
        .some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [audit, search]);

  const acknowledge = async (rows: SecurityEventRow[]) => {
    if (!rows.length) return;
    await acknowledgeSecurityEvents(rows.map((r) => r.id), actor.id).catch(() => null);
    toast.success("Alerts acknowledged");
    void load();
  };

  const banUser = async (row: UserSecurityRow, kind: "lock" | "suspend7" | "restore") => {
    if (!canManage) { toast.error("You do not have permission to do this."); return; }
    setBusy(row.id);
    try {
      if (kind === "lock") await lockAccount(row.id, actor, "Locked from the security console");
      else if (kind === "suspend7") await suspendAccount(row.id, actor, "Suspended from the security console", 7);
      else await restoreAccount(row.id, actor);
      toast.success("Account updated");
      void load();
    } catch {
      toast.error("Could not update the account");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" /> Security &amp; audit
          </h1>
          <p className="text-xs text-muted-foreground">
            Signed in as {perms.roleLabel}. All actions on this page are audited.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" variant="secondary" onClick={scan} disabled={busy === "scan" || !perms.can("fraud.manage")}>
            {busy === "scan" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="mr-2 h-3.5 w-3.5" />}
            Scan
          </Button>
          <Button size="sm" onClick={fixAll} disabled={busy === "fix" || !perms.can("fraud.manage")}>
            {busy === "fix" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-2 h-3.5 w-3.5" />}
            Fix All
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ShieldAlert} label="Open alerts" value={overview?.openAlerts ?? 0}
          tone={(overview?.criticalAlerts ?? 0) > 0 ? "danger" : "default"} />
        <Stat icon={AlertTriangle} label="Failed logins (24h)" value={overview?.failedLogins24h ?? 0}
          tone={(overview?.failedLogins24h ?? 0) > 20 ? "warn" : "default"} />
        <Stat icon={Users} label="Active sessions" value={overview?.activeSessions ?? 0} />
        <Stat icon={Lock} label="Locked accounts" value={overview?.lockedAccounts ?? 0}
          tone={(overview?.lockedAccounts ?? 0) > 0 ? "warn" : "good"} />
        <Stat icon={Fingerprint} label="Known devices" value={overview?.deviceCount ?? 0} />
        <Stat icon={Ban} label="Blocked devices" value={overview?.blockedDevices ?? 0} />
        <Stat icon={Trash2} label="Deletion requests" value={overview?.pendingDeletions ?? 0} />
        <Stat icon={Activity} label="Audit entries (30d)" value={stats?.total ?? 0} />
      </div>

      <Tabs defaultValue="alerts">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="fraud">Fraud</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
          <TabsTrigger value="matrix">Permissions</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------- alerts */}
        <TabsContent value="alerts" className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{overview?.events.length ?? 0} unacknowledged</p>
            <Button size="sm" variant="outline" disabled={!overview?.events.length}
              onClick={() => void acknowledge(overview?.events ?? [])}>
              <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Acknowledge all
            </Button>
          </div>
          {(overview?.events ?? []).map((e: SecurityEventRow) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm text-foreground">
                  {severityBadge(e.severity)} {e.title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {e.type} · {e.detail ?? "—"} · {when(e.created_at)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void acknowledge([e])}>Dismiss</Button>
            </div>
          ))}
          {!loading && !overview?.events.length && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No open security alerts.
            </p>
          )}
        </TabsContent>

        {/* ----------------------------------------------------------- fraud */}
        <TabsContent value="fraud" className="mt-3 space-y-2">
          {fraud.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {severityBadge(f.severity)}
                  {FRAUD_LABEL[(f.kind ?? "") as keyof typeof FRAUD_LABEL] ?? f.kind}
                  <span className="text-xs font-normal text-muted-foreground">risk {f.risk_score ?? 0}</span>
                </p>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" disabled={!canManage}
                    onClick={() => void resolveFraudReport(f.id, "investigating", actor).then(load)}>
                    Investigate
                  </Button>
                  <Button size="sm" variant="destructive" disabled={!canManage}
                    onClick={() => void resolveFraudReport(f.id, "confirmed", actor).then(load)}>
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!canManage}
                    onClick={() => void resolveFraudReport(f.id, "dismissed", actor).then(load)}>
                    Dismiss
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {f.subject_type} · {f.subject_label ?? f.subject_id} · {when(f.detected_at)}
              </p>
              {f.evidence && (
                <div className="mt-2 rounded bg-muted/50 p-2 text-[10px] font-mono text-muted-foreground">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(f.evidence, null, 2)}</pre>
                </div>
              )}
              <ul className="mt-2 list-disc pl-5 text-[11px] text-muted-foreground">
                {(f.signals ?? []).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          ))}
          {!loading && !fraud.length && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No open fraud reports. Run a scan to check the latest activity.
            </p>
          )}
        </TabsContent>

        {/* -------------------------------------------------------- sessions */}
        <TabsContent value="sessions" className="mt-3 space-y-2">
          {(overview?.sessionList ?? []).map((s: SessionRow) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{s.device_label ?? "Unknown device"}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {s.role ?? "—"} · {s.app ?? "—"} · {s.ip ?? "no IP"} · active {when(s.last_seen_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="ghost" disabled={!perms.can("session.revoke.any")}
                  onClick={() => void revokeSession(s.id, actor, "admin_revoked").then(load)}>
                  Revoke
                </Button>
                <Button size="sm" variant="outline" disabled={!perms.can("session.revoke.any") || !s.user_id}
                  onClick={() => s.user_id && void revokeAllSessions(s.user_id, actor, { reason: "admin_revoked_all" }).then(load)}>
                  Revoke all
                </Button>
              </div>
            </div>
          ))}
          {!loading && !overview?.sessionList.length && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No active sessions.
            </p>
          )}
        </TabsContent>

        {/* --------------------------------------------------------- devices */}
        <TabsContent value="devices" className="mt-3 space-y-2">
          {(overview?.deviceList ?? []).map((d: DeviceRow) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm text-foreground">
                  {d.label ?? d.device_id}
                  {d.blocked && <Badge variant="destructive" className="text-[10px]">blocked</Badge>}
                  {d.trusted && <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px]">trusted</Badge>}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {d.platform ?? "—"} · {d.login_count ?? 0} logins · {d.last_ip ?? "no IP"} · seen {when(d.last_seen_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="ghost" disabled={!canManage}
                  onClick={() => void setDeviceFlags(d.id, { trusted: !d.trusted }).then(load)}>
                  {d.trusted ? "Untrust" : "Trust"}
                </Button>
                <Button size="sm" variant={d.blocked ? "outline" : "destructive"} disabled={!canManage}
                  onClick={() => void setDeviceFlags(d.id, { blocked: !d.blocked }).then(load)}>
                  {d.blocked ? "Unblock" : "Block"}
                </Button>
              </div>
            </div>
          ))}
          {!loading && !overview?.deviceList.length && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No devices registered yet.
            </p>
          )}
        </TabsContent>

        {/* -------------------------------------------------------- accounts */}
        <TabsContent value="accounts" className="mt-3 space-y-4">
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Locked &amp; suspended</h2>
            {(overview?.lockedUsers ?? []).map((u: UserSecurityRow) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{u.name ?? u.email ?? u.id}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {u.account_state ?? "locked"} · {u.lock_reason ?? u.suspension_reason ?? "—"} · {when(u.locked_at)}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={busy === u.id || !canManage}
                  onClick={() => void unlockAccount(u.id, actor).then(load)}>
                  <Unlock className="mr-2 h-3.5 w-3.5" /> Unlock
                </Button>
              </div>
            ))}
            {!loading && !overview?.lockedUsers.length && (
              <p className="text-xs text-muted-foreground">No locked accounts.</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deletion requests</h2>
            {(overview?.deletions ?? []).map((u: UserSecurityRow) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{u.name ?? u.email ?? u.id}</p>
                  <p className="text-[11px] text-muted-foreground">
                    requested {when(u.deletion_requested_at)} · scheduled{" "}
                    {u.deletion_scheduled_for ? new Date(u.deletion_scheduled_for).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" disabled={!canManage} onClick={() => void banUser(u, "restore")}>
                    Restore
                  </Button>
                  <Button size="sm" variant="destructive" disabled={!canManage} onClick={() => void banUser(u, "lock")}>
                    Lock now
                  </Button>
                </div>
              </div>
            ))}
            {!loading && !overview?.deletions.length && (
              <p className="text-xs text-muted-foreground">No pending deletion requests.</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent failed logins</h2>
            {(overview?.failedList ?? []).slice(0, 30).map((l: LoginRow) => (
              <div key={l.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-foreground">{l.email ?? l.user_id ?? "unknown"}</span>
                <span className="shrink-0 text-muted-foreground">
                  {l.device_label ?? l.browser ?? "—"} · {l.ip ?? "no IP"} · {when(l.created_at)}
                </span>
              </div>
            ))}
            {!loading && !overview?.failedList.length && (
              <p className="text-xs text-muted-foreground">No failed sign-ins in the last 24 hours.</p>
            )}
          </section>
        </TabsContent>

        {/* ----------------------------------------------------- audit trail */}
        <TabsContent value="audit" className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search action, actor or subject…" value={search}
              onChange={(e) => setSearch(e.target.value)} className="h-9 max-w-xs" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["all", "auth", "user", "restaurant", "rider", "manager", "admin", "support",
                  "wallet", "coupon", "reward", "subscription", "kyc", "settings", "security", "privacy"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {perms.can("audit.archive") && (
              <Button size="sm" variant="outline" onClick={archive} disabled={busy === "archive"}>
                Archive &gt; 180 days
              </Button>
            )}
          </div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {filteredAudit.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    {severityBadge(r.severity)}
                    <span className="font-medium">{r.action}</span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {r.summary} · {r.actor_role ?? "system"} {r.actor_name ? `(${r.actor_name})` : ""}
                    {r.subject_type ? ` → ${r.subject_type}:${String(r.subject_id ?? "").slice(0, 8)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{when(r.created_at)}</span>
              </div>
            ))}
            {!loading && !filteredAudit.length && (
              <p className="p-6 text-center text-xs text-muted-foreground">No audit entries match.</p>
            )}
          </div>
        </TabsContent>

        {/* ------------------------------------------------- permission matrix */}
        <TabsContent value="matrix" className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Effective base permissions per role. Per-user grants and denials override this matrix.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left font-medium text-muted-foreground">Permission</th>
                  {(Object.keys(PERMISSION_MATRIX) as SecurityRole[]).map((r) => (
                    <th key={r} className="p-2 text-center font-medium text-muted-foreground">{ROLE_LABEL[r]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <Fragment key={group.label}>
                    <tr className="bg-muted/40">
                      <td className="p-2 font-semibold text-foreground" colSpan={8}>{group.label}</td>
                    </tr>
                    {group.permissions.map((p) => (
                      <tr key={p} className="border-b border-border/60">
                        <td className="p-2 text-foreground">{p}</td>
                        {(Object.keys(PERMISSION_MATRIX) as SecurityRole[]).map((r) => (
                          <td key={r} className="p-2 text-center">
                            {PERMISSION_MATRIX[r].includes(p)
                              ? <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                              : <span className="text-muted-foreground">·</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
