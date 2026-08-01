import { useEffect, useState } from "react";
import { Download, ExternalLink, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { KYC_STATUS_LABEL, KYC_STATUS_TONE, effectiveStatus, type KycAuditRow, type KycRow } from "@/lib/verification-api";

/**
 * Secure-ish document viewer: full-screen preview with zoom + rotate, a
 * download/open escape hatch, and the document's own review history.
 */
export function DocumentViewer({
  row,
  label,
  logs = [],
  onClose,
}: {
  row: KycRow;
  label: string;
  logs?: KycAuditRow[];
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const url = row.file_url ?? "";
  const isPdf = /\.pdf($|\?)/i.test(url);
  const status = effectiveStatus(row);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const history = logs.filter((l) => (l.doc_type ?? "") === (row.doc_type ?? ""));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-foreground/90 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-extrabold text-background">{label}</p>
          <p className="truncate text-[11px] text-background/70">{row.doc_number || row.file_name || "No number submitted"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${KYC_STATUS_TONE[status]}`}>
            {KYC_STATUS_LABEL[status]}
          </span>
          <button onClick={onClose} aria-label="Close document" className="grid h-9 w-9 place-items-center rounded-full bg-background/15 text-background">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4">
        {!url ? (
          <div className="grid h-full place-items-center text-sm text-background/70">No file uploaded yet.</div>
        ) : isPdf ? (
          <iframe title={label} src={url} className="h-full min-h-[60svh] w-full rounded-2xl bg-background" />
        ) : (
          <div className="grid min-h-[60svh] place-items-center">
            <img
              src={url}
              alt={label}
              className="max-w-none rounded-2xl bg-background shadow-soft transition-transform"
              style={{ transform: `scale(${zoom}) rotate(${rot}deg)`, maxHeight: "70svh" }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3">
        {!isPdf && url && (
          <>
            <ViewerBtn onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}><ZoomOut className="h-4 w-4" /> Out</ViewerBtn>
            <ViewerBtn onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}><ZoomIn className="h-4 w-4" /> In</ViewerBtn>
            <ViewerBtn onClick={() => setRot((r) => (r + 90) % 360)}><RotateCw className="h-4 w-4" /> Rotate</ViewerBtn>
          </>
        )}
        {url && (
          <>
            <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-background/15 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-background">
              <ExternalLink className="h-4 w-4" /> Open
            </a>
            <a href={url} download className="flex items-center gap-1.5 rounded-full bg-background/15 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-background">
              <Download className="h-4 w-4" /> Download
            </a>
          </>
        )}
      </div>

      {history.length > 0 && (
        <div className="max-h-[26svh] overflow-auto border-t border-background/15 px-4 py-3">
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-background/70">Document history</p>
          <ul className="space-y-1.5">
            {history.map((l) => (
              <li key={l.id} className="rounded-xl bg-background/10 px-3 py-2 text-[11px] text-background">
                {l.from_status ? `${l.from_status} → ` : ""}{l.to_status} · {l.actor_name ?? l.actor_role ?? "system"} ·{" "}
                {l.created_at ? new Date(l.created_at).toLocaleString() : ""}
                {l.remarks && <span className="block text-background/70">“{l.remarks}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ViewerBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full bg-background/15 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-background active:scale-95"
    >
      {children}
    </button>
  );
}
