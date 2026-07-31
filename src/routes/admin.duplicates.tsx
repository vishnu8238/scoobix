import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert, ArrowLeftRight, GitMerge, Archive, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/format";
import { useAuth } from "@/lib/auth-store";
import { patchAppSettings, useAppSettings } from "@/lib/app-settings";
import {
  listDuplicateChecks,
  resolveDuplicate,
  duplicateStats,
  LEVEL_LABEL,
  LEVEL_TONE,
  REASON_LABEL,
  type AdminDuplicateAction,
  type DuplicateCheckRow,
  type DuplicateReason,
} from "@/lib/duplicate-api";
import {
  listTransfers,
  setTransferStatus,
  transferStatus,
  TRANSFER_LABEL,
  TRANSFER_TONE,
  type TransferRow,
} from "@/lib/transfers-api";

export const Route = createFileRoute("/admin/duplicates")({
  head: () => ({
    meta: [
      { title: "Scoobix Admin · Duplicate management" },
      { name: "description", content: "Review duplicate restaurant alerts, merge records and approve ownership transfers." },
      { property: "og:title", content: "Scoobix Admin · Duplicate management" },
      { property: "og:description", content: "Duplicate detection alerts, merges, branches and ownership transfers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDuplicates,
});

type MatchLite = {
  id: string;
  rst_code?: string | null;
  name?: string | null;
  owner_name?: string | null;
  status?: string | null;
  manager_name?: string | null;
  created_at?: string | null;
  reasons?: string[];
  level?: string | null;
  distance_m?: number | null;
};

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString() : "—");

function AdminDuplicates() {
  const { user } = useAuth();
  const settings = useAppSettings();
  const [rows, setRows] = useState<DuplicateCheckRow[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "exact" | "possible" | "transfers" | "merged" | "log">("pending");
  const [radius, setRadius] = useState(String((settings as unknown as Record<string, number>).duplicate_radius_m ?? 300));

  const refresh = useCallback(async () => {
    setLoading(true);
    const [checks, tr] = await Promise.all([listDuplicateChecks({ limit: 300 }), listTransfers({ limit: 200 })]);
    setRows(checks);
    setTransfers(tr);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const stats = useMemo(() => duplicateStats(rows), [rows]);
  const alerts = useMemo(() => rows.filter((r) => r.level === "exact" || r.level === "possible"), [rows]);

  const visible = useMemo(() => {
    if (tab === "pending") return alerts.filter((r) => (r.decision ?? "pending") === "pending");
    if (tab === "exact") return alerts.filter((r) => r.level === "exact");
    if (tab === "possible") return alerts.filter((r) => r.level === "possible");
    if (tab === "merged") return rows.filter((r) => r.decision === "merge" || r.decision === "approve_branch");
    if (tab === "log") return rows;
    return [];
  }, [tab, alerts, rows]);

  const saveRadius = async () => {
    const n = Number(radius);
    if (!Number.isFinite(n) || n <= 0) { toast.error("Enter a radius in metres"); return; }
    await patchAppSettings({ duplicate_radius_m: n } as never);
    toast.success(`Duplicate GPS radius set to ${n} m`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Duplicate management</h1>
          <p className="text-[13px] text-muted-foreground">
            Detection alerts, merges, branch approvals and ownership transfers — permanent audit trail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="h-10 w-28 rounded-2xl bg-card text-sm"
            aria-label="Duplicate GPS radius in metres"
          />
          <Button variant="outline" className="rounded-full" onClick={() => void saveRadius()}>
            Save radius (m)
          </Button>
          <Button variant="ghost" className="rounded-full" onClick={() => void refresh()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Exact duplicates" value={stats.exact} tone="text-rose-600" />
        <Stat label="Possible" value={stats.possible} tone="text-amber-600" />
        <Stat label="Awaiting decision" value={stats.pending} tone="text-violet-600" />
        <Stat label="High priority" value={stats.highPriority} tone="text-rose-600" />
        <Stat label="Merged" value={stats.merged} tone="text-emerald-600" />
        <Stat label="Pending transfers" value={transfers.filter((t) => transferStatus(t) === "pending").length} tone="text-sky-600" />
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {([
          ["pending", "Needs decision"],
          ["exact", "Exact duplicates"],
          ["possible", "Possible duplicates"],
          ["transfers", "Ownership transfers"],
          ["merged", "Merged & branches"],
          ["log", "Full audit log"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold transition",
              tab === k ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-muted/60" />
      ) : tab === "transfers" ? (
        <TransferList transfers={transfers} adminId={user?.id ?? null} onDone={refresh} />
      ) : visible.length === 0 ? (
        <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft ring-1 ring-border/60">
          Nothing here yet.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <CheckCard key={r.id} row={r} adminId={user?.id ?? null} adminName={user?.name ?? null} onDone={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <p className={cn("font-display text-2xl font-extrabold", tone)}>{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function CheckCard({
  row, adminId, adminName, onDone,
}: { row: DuplicateCheckRow; adminId: string | null; adminName: string | null; onDone: () => void | Promise<void> }) {
  const matches = (Array.isArray(row.matches) ? row.matches : []) as MatchLite[];
  const reasons = (Array.isArray(row.reasons) ? row.reasons : []) as DuplicateReason[];
  const candidate = (row.candidate ?? {}) as Record<string, unknown>;
  const [target, setTarget] = useState<string | null>(matches[0]?.id ?? null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const decided = (row.decision ?? "pending") !== "pending";

  const act = async (action: AdminDuplicateAction) => {
    setBusy(true);
    await resolveDuplicate({ check: row, action, targetRestaurantId: target, remarks, adminId, adminName });
    setBusy(false);
    toast.success(`Duplicate ${action.replace("_", " ")} recorded`);
    await onDone();
  };

  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="font-display text-base font-extrabold">{String(candidate.name ?? "Untitled restaurant")}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", LEVEL_TONE[(row.level as "exact") ?? "possible"])}>
              {LEVEL_LABEL[(row.level as "exact") ?? "possible"]}
            </span>
            {(reasons.includes("gst") || reasons.includes("fssai")) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-700">
                <ShieldAlert className="h-3 w-3" /> High priority
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Attempted by {row.attempted_by_name ?? "—"} ({row.attempted_by_role ?? "manager"}) · {fmt(row.created_at)} · action: {row.action ?? "—"}
          </p>
          {row.justification && (
            <p className="mt-1 text-[12px] italic text-muted-foreground">“{row.justification}”</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {reasons.map((r) => (
              <span key={r} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {REASON_LABEL[r] ?? r}
              </span>
            ))}
          </div>
        </div>
        {decided && (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {row.outcome ?? row.decision} · {fmt(row.decided_at)}
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => setTarget(m.id)}
            className={cn(
              "rounded-2xl bg-secondary/40 p-3 text-left ring-1 transition",
              target === m.id ? "ring-2 ring-primary" : "ring-border/60",
            )}
          >
            <p className="truncate text-sm font-bold">{m.name}</p>
            <p className="text-[11px] font-semibold text-muted-foreground">
              {m.rst_code ?? "—"} · {m.owner_name ?? "Owner not set"} · {m.status ?? "pending"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {m.manager_name ? `Manager: ${m.manager_name}` : "Unassigned"} · created{" "}
              {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(m.reasons ?? []).map((r) => (
                <span key={r} className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border/60">
                  {REASON_LABEL[r as DuplicateReason] ?? r}
                  {r === "geo" && m.distance_m != null ? ` · ${Math.round(m.distance_m)} m` : ""}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {!decided && (
        <>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Admin remarks (stored in the audit trail)"
            className="mt-3 min-h-[64px] rounded-2xl bg-secondary/50 text-[13px]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" disabled={busy || !target} onClick={() => void act("merge")}>
              <GitMerge className="mr-1.5 h-4 w-4" /> Merge into selected
            </Button>
            <Button variant="outline" className="rounded-full" disabled={busy || !target} onClick={() => void act("approve_branch")}>
              Approve as branch
            </Button>
            <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => void act("reject")}>
              Reject onboarding
            </Button>
            <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => void act("archive")}>
              <Archive className="mr-1.5 h-4 w-4" /> Archive record
            </Button>
            <Button variant="ghost" className="rounded-full" disabled={busy} onClick={() => void act("dismiss")}>
              Not a duplicate
            </Button>
          </div>
        </>
      )}
      {decided && row.admin_remarks && (
        <p className="mt-2 text-[12px] text-muted-foreground">Admin: {row.admin_remarks}</p>
      )}
    </div>
  );
}

function TransferList({
  transfers, adminId, onDone,
}: { transfers: TransferRow[]; adminId: string | null; onDone: () => void | Promise<void> }) {
  if (!transfers.length) {
    return (
      <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft ring-1 ring-border/60">
        No ownership transfer requests yet.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {transfers.map((t) => (
        <TransferCard key={t.id} transfer={t} adminId={adminId} onDone={onDone} />
      ))}
    </div>
  );
}

function TransferCard({
  transfer, adminId, onDone,
}: { transfer: TransferRow; adminId: string | null; onDone: () => void | Promise<void> }) {
  const [remarks, setRemarks] = useState(transfer.admin_remarks ?? "");
  const [busy, setBusy] = useState(false);
  const status = transferStatus(transfer);
  const open = status === "pending" || status === "under_review";

  const decide = async (next: "under_review" | "approved" | "rejected") => {
    setBusy(true);
    await setTransferStatus({ transfer, status: next, remarks, adminId });
    setBusy(false);
    toast.success(`Transfer ${TRANSFER_LABEL[next].toLowerCase()}`);
    await onDone();
  };

  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
      <div className="flex flex-wrap items-center gap-2">
        <ArrowLeftRight className="h-4 w-4 text-primary" />
        <p className="font-display text-base font-extrabold">{transfer.restaurant_name ?? "Restaurant"}</p>
        <span className="text-[11px] font-semibold text-muted-foreground">{transfer.rst_code ?? "—"}</span>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", TRANSFER_TONE[status])}>
          {TRANSFER_LABEL[status]}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {transfer.from_manager_name ?? "Unassigned"} → {transfer.to_manager_name ?? "—"} · requested by{" "}
        {transfer.requested_by_name ?? "—"} · {fmt(transfer.created_at)}
      </p>
      {transfer.reason && <p className="mt-1 text-[12px] italic text-muted-foreground">“{transfer.reason}”</p>}
      {open ? (
        <>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Admin remarks"
            className="mt-3 min-h-[60px] rounded-2xl bg-secondary/50 text-[13px]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {status === "pending" && (
              <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => void decide("under_review")}>
                Mark under review
              </Button>
            )}
            <Button
              className="rounded-full gradient-primary text-primary-foreground"
              disabled={busy || !transfer.to_manager_id}
              onClick={() => void decide("approved")}
            >
              Approve transfer
            </Button>
            <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => void decide("rejected")}>
              Reject
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Decided {fmt(transfer.decided_at)}{transfer.admin_remarks ? ` · ${transfer.admin_remarks}` : ""}
        </p>
      )}
    </div>
  );
}
