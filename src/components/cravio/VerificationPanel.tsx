import { useCallback, useEffect, useState } from "react";
import { Eye, FileCheck2, History, Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "@/components/cravio/ImageUploader";
import { DocumentViewer } from "@/components/cravio/DocumentViewer";
import { useTableVersion } from "@/lib/realtime-hooks";
import {
  DOC_CATALOG,
  KYC_STATUS_LABEL,
  KYC_STATUS_TONE,
  REVIEW_ACTIONS,
  effectiveStatus,
  fetchDocs,
  fetchLogs,
  isExpired,
  mergeDocs,
  reviewDoc,
  submitDoc,
  summarize,
  type Actor,
  type KycAuditRow,
  type KycDocDef,
  type KycRow,
  type KycStatus,
  type KycSummary,
  type VerifySubject,
} from "@/lib/verification-api";

/** Live documents + summary for any verification subject. */
export function useVerification(subject: VerifySubject, subjectId?: string | null) {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const sid = subjectId ?? "";
  // Realtime: any KYC write anywhere refreshes this panel.
  const version = useTableVersion(["restaurant_kyc", "kyc_audit_logs"]);

  const reload = useCallback(async () => {
    if (!sid) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setRows(await fetchDocs(subject, sid));
    // Immediately invalidate the table to ensure subsequent loads are fresh
    // since KYC updates are critical.
    import("@/lib/insforge-crud").then(m => m.invalidateTable("restaurant_kyc"));
    setLoading(false);
  }, [subject, sid]);

  useEffect(() => { void reload(); }, [reload, version]);

  return { rows, loading, reload, summary: summarize(subject, rows), docs: mergeDocs(subject, rows) };
}

export function StatusPill({ status }: { status: KycStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${KYC_STATUS_TONE[status]}`}>
      {KYC_STATUS_LABEL[status]}
    </span>
  );
}

export function VerificationProgress({ summary }: { summary: KycSummary }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Verification</span>
        <span className="font-display text-lg font-extrabold tabular-nums">{summary.percent}% verified</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${summary.percent}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {summary.mandatoryVerified}/{summary.mandatoryTotal} mandatory documents approved
        {summary.underReview ? ` · ${summary.underReview} under review` : ""}
        {summary.blocked ? ` · ${summary.blocked} need attention` : ""}
        {summary.expiringSoon ? ` · ${summary.expiringSoon} expiring soon` : ""}
      </p>
    </div>
  );
}

/* ------------------------------ Uploader ------------------------------- */

export function VerificationUploadCard({
  subject,
  subjectId,
  actor,
  title,
  note,
}: {
  subject: VerifySubject;
  subjectId?: string | null;
  actor?: Actor;
  title?: string;
  note?: string;
}) {
  const { docs, loading, reload, summary } = useVerification(subject, subjectId);
  const [busy, setBusy] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<{ row: KycRow; label: string } | null>(null);

  const save = async (def: KycDocDef, row: KycRow | null, fileUrl?: string | null) => {
    if (!subjectId) return;
    setBusy(def.type);
    await submitDoc(
      subject,
      subjectId,
      def,
      {
        doc_number: numbers[def.type] ?? row?.doc_number ?? null,
        file_url: fileUrl ?? row?.file_url ?? null,
        expires_at: expiry[def.type] ? new Date(expiry[def.type]).toISOString() : (row?.expires_at ?? null),
      },
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
          <ShieldCheck className="h-4 w-4 text-primary" /> {title ?? "KYC documents"}
        </p>
        {summary.complete && <StatusPill status="verified" />}
      </div>
      <VerificationProgress summary={summary} />

      {loading ? (
        <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <ul className="space-y-3">
          {docs.map(({ def, row }) => {
            const status = effectiveStatus(row);
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
                  <div className="flex items-center gap-2">
                    {row?.file_url && (
                      <button
                        onClick={() => setViewing({ row, label: def.label })}
                        className="grid h-7 w-7 place-items-center rounded-full bg-card text-muted-foreground ring-1 ring-border/60"
                        aria-label={`View ${def.label}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <StatusPill status={status} />
                  </div>
                </div>

                {row?.remarks && (
                  <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
                    Reviewer note: {row.remarks}
                  </p>
                )}
                {row?.expires_at && (
                  <p className={`mt-2 text-[11px] font-semibold ${isExpired(row) ? "text-rose-600" : "text-muted-foreground"}`}>
                    {isExpired(row) ? "Expired on " : "Valid until "}
                    {new Date(row.expires_at).toLocaleDateString()}
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
                    {def.expiry && (
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expiry date</span>
                        <input
                          type="date"
                          value={expiry[def.type] ?? (row?.expires_at ? row.expires_at.slice(0, 10) : "")}
                          onChange={(e) => setExpiry((p) => ({ ...p, [def.type]: e.target.value }))}
                          className="mt-1 w-full rounded-2xl bg-background px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:ring-primary/40"
                        />
                      </label>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-28">
                        <ImageUploader
                          type="license"
                          aspect="aspect-[4/3]"
                          label="Upload"
                          value={row?.file_url ? { image_url: row.file_url, image_type: "license" as const } : null}
                          onChange={(ref) => {
                            if (ref) {
                              void save(def, row, ref.image_url);
                            }
                          }}
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
          {note ?? "You stay offline until every mandatory document is verified by Scoobix."}
        </p>
      )}

      {viewing && <DocumentViewer row={viewing.row} label={viewing.label} onClose={() => setViewing(null)} />}
    </section>
  );
}

/* ------------------------------- Reviewer ------------------------------- */

export function VerificationReviewPanel({
  subject,
  subjectId,
  actor,
  readOnly = false,
}: {
  subject: VerifySubject;
  subjectId: string;
  actor?: Actor;
  readOnly?: boolean;
}) {
  const { docs, loading, reload, summary } = useVerification(subject, subjectId);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [logs, setLogs] = useState<KycAuditRow[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [viewing, setViewing] = useState<{ row: KycRow; label: string } | null>(null);

  const loadLogs = useCallback(async () => setLogs(await fetchLogs(subject, subjectId)), [subject, subjectId]);
  useEffect(() => { void loadLogs(); }, [loadLogs]);

  const decide = async (def: KycDocDef, row: KycRow | null, status: KycStatus) => {
    if (readOnly) return;
    setBusy(def.type + status);
    await reviewDoc(subject, subjectId, def, row, status, remarks[def.type] ?? null, actor);
    await reload();
    await loadLogs();
    setBusy(null);
    toast.success(`${def.label} → ${KYC_STATUS_LABEL[status]}`);
  };

  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-sm font-bold">
          <FileCheck2 className="h-4 w-4 text-primary" /> {DOC_CATALOG[subject].length} document checks
        </p>
        <button
          onClick={() => setShowLogs((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground ring-1 ring-border/60"
        >
          <History className="h-3 w-3" /> {showLogs ? "Hide audit log" : "Audit log"}
        </button>
      </div>

      <div className="mt-3"><VerificationProgress summary={summary} /></div>

      {loading ? (
        <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <ul className="mt-3 space-y-2">
          {docs.map(({ def, row }) => {
            const status = effectiveStatus(row);
            return (
              <li key={def.type} className="rounded-2xl bg-card p-3 ring-1 ring-border/60">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {def.label}
                      {!def.mandatory && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Optional</span>}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{row?.doc_number || "No number submitted"}</p>
                    {row?.expires_at && (
                      <p className={`text-[10px] font-semibold ${isExpired(row) ? "text-rose-600" : "text-muted-foreground"}`}>
                        {isExpired(row) ? "Expired " : "Valid until "}{new Date(row.expires_at).toLocaleDateString()}
                      </p>
                    )}
                    {row?.reviewed_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Reviewed {new Date(row.reviewed_at).toLocaleString()} by {row.reviewed_by ?? "admin"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {row?.file_url && (
                      <button
                        onClick={() => setViewing({ row, label: def.label })}
                        className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground"
                      >
                        <Eye className="h-3 w-3" /> View
                      </button>
                    )}
                    <StatusPill status={status} />
                  </div>
                </div>

                {!readOnly && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={remarks[def.type] ?? ""}
                      onChange={(e) => setRemarks((p) => ({ ...p, [def.type]: e.target.value }))}
                      placeholder="Remarks (shared with the applicant)"
                      className="min-w-[160px] flex-1 rounded-xl bg-background px-3 py-2 text-xs outline-none ring-1 ring-border/60 focus:ring-primary/40"
                    />
                    {REVIEW_ACTIONS.map((s) => (
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
                )}
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

      {viewing && <DocumentViewer row={viewing.row} label={viewing.label} logs={logs} onClose={() => setViewing(null)} />}
    </div>
  );
}
