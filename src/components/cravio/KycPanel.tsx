import { useCallback, useEffect, useState } from "react";
import { FileCheck2, History, Loader2, ShieldCheck, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "@/components/cravio/ImageUploader";
import {
  KYC_STATUS_LABEL,
  KYC_STATUS_TONE,
  fetchKyc,
  fetchKycLogs,
  mergeDocs,
  normalizeStatus,
  reviewKycDoc,
  submitKycDoc,
  summarizeKyc,
  type Actor,
  type KycAuditRow,
  type KycDocDef,
  type KycRow,
  type KycStatus,
  type KycSummary,
} from "@/lib/kyc-api";

/** Loads KYC rows + summary for a restaurant. */
export function useKyc(restaurantId?: string | null) {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const rid = restaurantId ?? "";

  const reload = useCallback(async () => {
    if (!rid) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setRows(await fetchKyc(rid));
    setLoading(false);
  }, [rid]);

  useEffect(() => { void reload(); }, [reload]);

  return { rows, setRows, loading, reload, summary: summarizeKyc(rows), docs: mergeDocs(rows) };
}

export function KycStatusPill({ status }: { status: KycStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${KYC_STATUS_TONE[status]}`}>
      {KYC_STATUS_LABEL[status]}
    </span>
  );
}

export function KycProgress({ summary }: { summary: KycSummary }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">KYC verification</span>
        <span className="font-display text-lg font-extrabold tabular-nums">{summary.percent}% verified</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${summary.percent}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {summary.mandatoryVerified}/{summary.mandatoryTotal} mandatory documents verified
        {summary.blocked ? ` · ${summary.blocked} need attention` : ""}
      </p>
    </div>
  );
}

/* ------------------------------- Partner ------------------------------- */

export function KycUploadCard({ restaurantId, actor }: { restaurantId?: string | null; actor?: Actor }) {
  const { docs, loading, reload, summary } = useKyc(restaurantId);
  const [busy, setBusy] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<Record<string, string>>({});

  const save = async (def: KycDocDef, row: KycRow | null, fileUrl?: string | null) => {
    if (!restaurantId) return;
    setBusy(def.type);
    await submitKycDoc(
      restaurantId,
      def,
      { doc_number: numbers[def.type] ?? row?.doc_number ?? null, file_url: fileUrl ?? row?.file_url ?? null },
      row,
      actor,
    );
    await reload();
    setBusy(null);
    toast.success(`${def.label} submitted for verification`);
  };

  return (
    <section className="space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-base font-extrabold">
          <ShieldCheck className="h-4 w-4 text-primary" /> KYC documents
        </p>
        {summary.complete && <KycStatusPill status="verified" />}
      </div>
      <KycProgress summary={summary} />

      {loading ? (
        <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <ul className="space-y-3">
          {docs.map(({ def, row }) => {
            const status = normalizeStatus(row?.status);
            const locked = status === "verified";
            return (
              <li key={def.type} className="rounded-2xl bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {def.label}
                      {!def.mandatory && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Optional</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{def.hint}</p>
                  </div>
                  <KycStatusPill status={status} />
                </div>

                {row?.remarks && (
                  <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
                    Admin note: {row.remarks}
                  </p>
                )}

                {!locked && (
                  <div className="mt-3 space-y-2">
                    <input
                      value={numbers[def.type] ?? row?.doc_number ?? ""}
                      onChange={(e) => setNumbers((p) => ({ ...p, [def.type]: e.target.value }))}
                      placeholder={def.numberLabel}
                      className="w-full rounded-2xl bg-background px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:ring-primary/40"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-28">
                        <ImageUploader
                          type="banner"
                          aspect="aspect-[4/3]"
                          label="Upload"
                          value={row?.file_url ? { image_url: row.file_url } : null}
                          onChange={(ref) => void save(def, row, ref?.image_url ?? null)}
                        />
                      </div>
                      <button
                        onClick={() => void save(def, row)}
                        disabled={busy === def.type}
                        className="flex items-center gap-1.5 rounded-2xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60"
                      >
                        {busy === def.type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Submit
                      </button>
                    </div>
                  </div>
                )}

                {locked && row?.doc_number && (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">{row.doc_number}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!summary.complete && (
        <p className="text-[12px] text-muted-foreground">
          Your restaurant stays offline until every mandatory document is verified by Scoobix.
        </p>
      )}
    </section>
  );
}

/* -------------------------------- Admin -------------------------------- */

export function AdminKycPanel({ restaurantId, actor }: { restaurantId: string; actor?: Actor }) {
  const { docs, loading, reload, summary } = useKyc(restaurantId);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [logs, setLogs] = useState<KycAuditRow[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const loadLogs = useCallback(async () => setLogs(await fetchKycLogs(restaurantId)), [restaurantId]);
  useEffect(() => { if (showLogs) void loadLogs(); }, [showLogs, loadLogs]);

  const decide = async (def: KycDocDef, row: KycRow | null, status: KycStatus) => {
    setBusy(def.type + status);
    await reviewKycDoc(restaurantId, def, row, status, remarks[def.type] ?? null, actor);
    await reload();
    if (showLogs) await loadLogs();
    setBusy(null);
    toast.success(`${def.label} → ${KYC_STATUS_LABEL[status]}`);
  };

  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-sm font-bold">
          <FileCheck2 className="h-4 w-4 text-primary" /> KYC verification
        </p>
        <button
          onClick={() => setShowLogs((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground ring-1 ring-border/60"
        >
          <History className="h-3 w-3" /> {showLogs ? "Hide audit log" : "Audit log"}
        </button>
      </div>

      <div className="mt-3"><KycProgress summary={summary} /></div>

      {loading ? (
        <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <ul className="mt-3 space-y-2">
          {docs.map(({ def, row }) => {
            const status = normalizeStatus(row?.status);
            return (
              <li key={def.type} className="rounded-2xl bg-card p-3 ring-1 ring-border/60">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {def.label}
                      {!def.mandatory && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Optional</span>}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{row?.doc_number || "No number submitted"}</p>
                    {row?.reviewed_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Reviewed {new Date(row.reviewed_at).toLocaleString()} by {row.reviewed_by ?? "admin"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {row?.file_url && (
                      <a href={row.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        <ExternalLink className="h-3 w-3" /> Doc
                      </a>
                    )}
                    <KycStatusPill status={status} />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={remarks[def.type] ?? ""}
                    onChange={(e) => setRemarks((p) => ({ ...p, [def.type]: e.target.value }))}
                    placeholder="Remarks (optional)"
                    className="min-w-[160px] flex-1 rounded-xl bg-background px-3 py-2 text-xs outline-none ring-1 ring-border/60 focus:ring-primary/40"
                  />
                  {(["verified", "reupload", "rejected"] as KycStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => void decide(def, row, s)}
                      disabled={busy === def.type + s}
                      className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition active:scale-95 disabled:opacity-60 ${KYC_STATUS_TONE[s]}`}
                    >
                      {KYC_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showLogs && (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Verification history</p>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {logs.map((l) => (
                <li key={l.id} className="rounded-xl bg-card px-3 py-2 text-[11px] ring-1 ring-border/60">
                  <span className="font-bold">{l.doc_type}</span>{" "}
                  <span className="text-muted-foreground">
                    {l.from_status ? `${l.from_status} → ` : ""}{l.to_status} · {l.actor_name ?? l.actor_role ?? "system"} ·{" "}
                    {l.created_at ? new Date(l.created_at).toLocaleString() : ""}
                  </span>
                  {l.remarks && <p className="text-muted-foreground">“{l.remarks}”</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
