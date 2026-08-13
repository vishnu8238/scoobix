import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, Ban, CheckCircle2, Fingerprint, Loader2, Lock,
  RefreshCw, ScanSearch, ShieldAlert, ShieldCheck, Trash2, Unlock, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/format";

export const Route = createFileRoute("/logistics/security")({
  head: () => ({
    meta: [
      { title: "Scoobix Logistics · Security & Audit" },
      { name: "description", content: "Security alerts, fraud reports, active sessions, and logistics audit trail." },
    ],
  }),
  component: LogisticsSecurity,
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

function LogisticsSecurity() {
  const { user } = useAuth();
  const perms = usePermissions();
  const actor = useMemo(() => ({ id: user?.id ?? "logistics", role: perms.role }), [user?.id, perms.role]);

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

  useEffect(() => { void load(); }, [load]);

  const canManage = perms.can("fraud.manage") || perms.can("user.ban");

  const scan = async () => {
    setBusy("scan");
    const res = await runFraudScan(actor).catch(() => null);
    setBusy(null);
    if (!res) { toast.error("Scan failed"); return; }
    toast.success(`${res.findings} findings`);
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

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" /> Security Console
          </h1>
          <p className="text-xs text-muted-foreground">Signed in as {perms.roleLabel}.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
          </Button>
          <Button size="sm" onClick={scan} disabled={busy === "scan" || !perms.can("fraud.manage")}>
            {busy === "scan" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="mr-2 h-3.5 w-3.5" />}
            Fraud scan
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ShieldAlert} label="Open alerts" value={overview?.openAlerts ?? 0}
          tone={(overview?.criticalAlerts ?? 0) > 0 ? "danger" : "default"} />
        <Stat icon={AlertTriangle} label="Failed logins (24h)" value={overview?.failedLogins24h ?? 0} />
        <Stat icon={Users} label="Active sessions" value={overview?.activeSessions ?? 0} />
        <Stat icon={Lock} label="Locked accounts" value={overview?.lockedAccounts ?? 0} />
      </div>

      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="fraud">Fraud</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-3 space-y-2">
          {(overview?.events ?? []).map((e: SecurityEventRow) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm text-foreground">
                  {severityBadge(e.severity)} {e.title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {e.type} · {when(e.created_at)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void acknowledge([e])}>Dismiss</Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="fraud" className="mt-3 space-y-2">
          {fraud.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {severityBadge(f.severity)}
                  {FRAUD_LABEL[(f.kind ?? "") as keyof typeof FRAUD_LABEL] ?? f.kind}
                </p>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" disabled={!canManage}
                    onClick={() => void resolveFraudReport(f.id, "confirmed", actor).then(load)}>
                    Confirm
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {f.subject_type} · {f.subject_label ?? f.subject_id} · {when(f.detected_at)}
              </p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="sessions" className="mt-3 space-y-2">
          {(overview?.sessionList ?? []).map((s: SessionRow) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{s.device_label ?? "Unknown device"}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {s.role ?? "—"} · {s.ip ?? "no IP"} · active {when(s.last_seen_at)}
                </p>
              </div>
              <Button size="sm" variant="ghost" disabled={!perms.can("session.revoke.any")}
                onClick={() => void revokeSession(s.id, actor, "admin_revoked").then(load)}>
                Revoke
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="mt-3 space-y-2">
           {filteredAudit.map((r) => (
             <div key={r.id} className="text-xs p-2 border-b border-border/40">
                <span className="font-bold">{r.actor_name || r.actor_role}</span> {r.action}: <span className="text-muted-foreground">{r.summary}</span>
             </div>
           ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
