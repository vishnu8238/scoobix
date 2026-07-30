import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Lock, Rocket } from "lucide-react";
import {
  buildChecklist,
  canGoLive,
  checklistPercent,
  isChecklistComplete,
  loadChecklistContext,
  type ChecklistContext,
  type ChecklistItem,
  type GoLiveRow,
} from "@/lib/go-live";

/** Loads menu count + owner status and derives the checklist. */
export function useGoLiveChecklist(restaurant: GoLiveRow | null) {
  const [ctx, setCtx] = useState<ChecklistContext>({ menuCount: 0, ownerActive: false });
  const [loading, setLoading] = useState(true);

  const rid = restaurant?.id ?? "";
  const ownerId = restaurant?.owner_id ?? "";

  useEffect(() => {
    let cancelled = false;
    if (!rid) { setLoading(false); return; }
    setLoading(true);
    void loadChecklistContext(restaurant).then((c) => {
      if (cancelled) return;
      setCtx(c);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid, ownerId]);

  const items = buildChecklist(restaurant, ctx);
  return {
    items,
    percent: checklistPercent(items),
    complete: isChecklistComplete(items),
    eligible: canGoLive(restaurant, items),
    loading,
  };
}

export function ChecklistProgress({ percent, tone = "primary" }: { percent: number; tone?: "primary" | "muted" }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Go-live readiness</span>
        <span className="font-display text-lg font-extrabold tabular-nums">{percent}% complete</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${tone === "primary" ? "bg-primary" : "bg-emerald-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function ChecklistList({
  items,
  onToggleAdmin,
}: {
  items: ChecklistItem[];
  onToggleAdmin?: (item: ChecklistItem) => void;
}) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.key} className="flex items-start gap-3 rounded-2xl bg-muted/40 px-3 py-2.5">
          {it.done ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${it.done ? "" : "text-muted-foreground"}`}>{it.label}</p>
            <p className="text-[11px] text-muted-foreground">{it.hint}</p>
          </div>
          {it.adminOnly && (
            onToggleAdmin ? (
              <button
                onClick={() => onToggleAdmin(it)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider transition active:scale-95 ${it.done ? "bg-emerald-100 text-emerald-700" : "bg-primary-soft text-primary"}`}
              >
                {it.done ? "Verified" : "Verify"}
              </button>
            ) : (
              <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Lock className="h-3 w-3" /> Admin
              </span>
            )
          )}
        </li>
      ))}
    </ul>
  );
}

export function GoLiveCard({
  restaurant,
  items,
  percent,
  eligible,
  isLive,
}: {
  restaurant: GoLiveRow | null;
  items: ChecklistItem[];
  percent: number;
  eligible: boolean;
  isLive: boolean;
}) {
  return (
    <section className="space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-base font-extrabold">
          <Rocket className="h-4 w-4 text-primary" /> Go-live checklist
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${isLive ? "bg-emerald-100 text-emerald-700" : eligible ? "bg-primary-soft text-primary" : "bg-amber-100 text-amber-700"}`}
        >
          {isLive ? "Live" : eligible ? "Ready" : "Not live"}
        </span>
      </div>
      <ChecklistProgress percent={percent} />
      <ChecklistList items={items} />
      {!isLive && (
        <p className="text-[12px] text-muted-foreground">
          {eligible
            ? "Everything is done — Scoobix admin will switch you live shortly."
            : "Complete every item above. Admin verification is required for bank and GST/FSSAI."}
        </p>
      )}
      {restaurant?.go_live_override && (
        <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
          Admin override active — this store can go live without a full checklist.
        </p>
      )}
    </section>
  );
}
