/**
 * Shared duplicate-detection UI (Merchant Manager + Restaurant apps).
 *
 * `useDuplicateCheck` runs server-side detection; `DuplicateDialog` renders the
 * result with the resolution options: view, cancel, continue with
 * justification, request ownership transfer, report as duplicate, or continue
 * as a branch of the matched restaurant.
 */
import { useCallback, useState } from "react";
import { AlertTriangle, ShieldCheck, ExternalLink, ArrowLeftRight, Flag, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/format";
import {
  detectDuplicates,
  isHighPriority,
  blocksWithoutAdmin,
  LEVEL_LABEL,
  LEVEL_TONE,
  REASON_LABEL,
  type DuplicateCandidate,
  type DuplicateMatch,
  type DuplicateResult,
} from "@/lib/duplicate-api";

export type DuplicateChoice =
  | { kind: "continue"; justification: string; match?: DuplicateMatch }
  | { kind: "cancel" }
  | { kind: "transfer"; match: DuplicateMatch; reason: string }
  | { kind: "report"; match: DuplicateMatch; reason: string }
  | { kind: "branch"; match: DuplicateMatch; justification: string };

export function useDuplicateCheck() {
  const [result, setResult] = useState<DuplicateResult | null>(null);
  const [checking, setChecking] = useState(false);

  const run = useCallback(async (candidate: DuplicateCandidate) => {
    setChecking(true);
    const r = await detectDuplicates(candidate);
    setResult(r);
    setChecking(false);
    return r;
  }, []);

  return { result, checking, run, clear: () => setResult(null) };
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function MatchCard({
  match,
  selected,
  onSelect,
  onView,
}: {
  match: DuplicateMatch;
  selected?: boolean;
  onSelect?: () => void;
  onView?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl bg-secondary/40 p-3 text-left ring-1 transition",
        selected ? "ring-2 ring-primary" : "ring-border/60",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{match.name}</p>
          <p className="text-[11px] font-semibold text-muted-foreground">
            {match.rst_code ?? match.code ?? "—"} · {match.owner_name ?? "Owner not set"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {match.manager_name ? `Manager: ${match.manager_name}` : match.manager_id ? "Manager assigned" : "Unassigned"}
            {" · "}Created {fmtDate(match.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", LEVEL_TONE[match.level])}>
            {LEVEL_LABEL[match.level]}
          </span>
          <span className="rounded-full bg-card px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground ring-1 ring-border/60">
            {match.is_live ? "Live" : match.status}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {match.reasons.map((r) => (
          <span key={r} className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border/60">
            {REASON_LABEL[r]}
            {r === "geo" && match.distance_m != null ? ` · ${Math.round(match.distance_m)} m` : ""}
          </span>
        ))}
      </div>
      {onView && (
        <span
          role="link"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onView(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onView(); } }}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary"
        >
          <ExternalLink className="h-3 w-3" /> View existing restaurant
        </span>
      )}
    </button>
  );
}

export function DuplicateDialog({
  open,
  onOpenChange,
  result,
  allowBranch = true,
  onView,
  onResolve,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: DuplicateResult | null;
  allowBranch?: boolean;
  onView?: (m: DuplicateMatch) => void;
  onResolve: (choice: DuplicateChoice) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!result) return null;
  const match = result.matches.find((m) => m.id === selected) ?? result.matches[0];
  const high = isHighPriority(result);
  const locked = blocksWithoutAdmin(result);

  const fire = async (choice: DuplicateChoice) => {
    setBusy(true);
    await onResolve(choice);
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] max-w-[520px] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-extrabold">
            {result.level === "none" ? (
              <><ShieldCheck className="h-5 w-5 text-emerald-600" /> No match found</>
            ) : (
              <><AlertTriangle className="h-5 w-5 text-amber-600" /> {LEVEL_LABEL[result.level]}</>
            )}
          </DialogTitle>
        </DialogHeader>

        {result.level === "none" ? (
          <p className="text-[13px] text-muted-foreground">
            No existing Scoobix restaurant matches this name, contact, licence or location
            (within {Math.round(result.radiusM)} m). You can continue onboarding.
          </p>
        ) : (
          <>
            {high && (
              <p className="rounded-2xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                High priority · the GST or FSSAI number is already registered on Scoobix.
              </p>
            )}
            {locked && (
              <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
                A live restaurant matched. Continuing sends the application to admin for a
                duplicate decision before it can go live.
              </p>
            )}
            <div className="space-y-2">
              {result.matches.slice(0, 8).map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  selected={match?.id === m.id}
                  onSelect={() => setSelected(m.id)}
                  onView={onView ? () => onView(m) : undefined}
                />
              ))}
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Justification / reason (required to continue, transfer or report)"
              className="min-h-[76px] rounded-2xl bg-secondary/50 text-[13px]"
            />
          </>
        )}

        <div className="mt-1 grid gap-2">
          {result.level !== "none" && match && (
            <>
              {allowBranch && (
                <Button
                  variant="outline"
                  className="justify-start rounded-2xl"
                  disabled={busy || !note.trim()}
                  onClick={() => void fire({ kind: "branch", match, justification: note.trim() })}
                >
                  <GitBranch className="mr-2 h-4 w-4" /> This is a new branch of {match.name}
                </Button>
              )}
              <Button
                variant="outline"
                className="justify-start rounded-2xl"
                disabled={busy || !note.trim()}
                onClick={() => void fire({ kind: "transfer", match, reason: note.trim() })}
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" /> Request ownership transfer
              </Button>
              <Button
                variant="outline"
                className="justify-start rounded-2xl"
                disabled={busy || !note.trim()}
                onClick={() => void fire({ kind: "report", match, reason: note.trim() })}
              >
                <Flag className="mr-2 h-4 w-4" /> Report duplicate listing
              </Button>
            </>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="rounded-full"
              disabled={busy}
              onClick={() => void fire({ kind: "cancel" })}
            >
              Cancel onboarding
            </Button>
            <Button
              className="ml-auto h-11 rounded-full gradient-primary px-5 text-sm font-bold text-primary-foreground shadow-glow"
              disabled={busy || (result.level !== "none" && !note.trim())}
              onClick={() => void fire({ kind: "continue", justification: note.trim(), match })}
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
