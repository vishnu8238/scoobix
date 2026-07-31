/**
 * Shared AI result panel — used by every app so AI surfaces look identical.
 * Handles loading, graceful degradation, refresh and 👍/👎 feedback logging.
 */
import { Loader2, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/format";
import { submitAiFeedback, type AiResponse } from "@/lib/ai/client";

export function AiPanel({
  title,
  subtitle,
  loading,
  res,
  app,
  task,
  userId,
  onRefresh,
  children,
  className,
  compact,
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  res?: AiResponse<unknown> | null;
  app: string;
  task: string;
  userId?: string;
  onRefresh?: () => void;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const [rated, setRated] = useState<1 | -1 | null>(null);

  const rate = async (rating: 1 | -1) => {
    setRated(rating);
    await submitAiFeedback({ userId, app, task, logId: res?.logId, rating });
    toast.success(rating === 1 ? "Thanks — noted" : "Thanks, we'll improve this");
  };

  const degraded = res && !res.ok;

  return (
    <section className={cn("rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60", className)}>
      <header className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Sparkles className="h-4.5 w-4.5" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-tight">{title}</h3>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            aria-label="Regenerate"
            className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        )}
      </header>

      <div className={cn("mt-3", compact && "mt-2")}>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        ) : degraded ? (
          <p className="rounded-2xl bg-muted/50 px-3 py-3 text-xs text-muted-foreground">
            AI is unavailable right now — everything else keeps working. Try again in a moment.
          </p>
        ) : (
          children
        )}
      </div>

      {!loading && res?.ok && (
        <footer className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {res.cached ? "cached" : res.provider} · {Math.round(res.latencyMs)}ms
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => rate(1)}
              disabled={rated !== null}
              className={cn("grid h-7 w-7 place-items-center rounded-full transition", rated === 1 ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary")}
              aria-label="Helpful"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => rate(-1)}
              disabled={rated !== null}
              className={cn("grid h-7 w-7 place-items-center rounded-full transition", rated === -1 ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-secondary")}
              aria-label="Not helpful"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}

/** Renders plain-text AI output (bullet lists stay readable). */
export function AiText({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <div className="space-y-1.5">
      {lines.map((l, i) => (
        <p key={i} className="text-sm leading-relaxed text-foreground/90">
          {l.replace(/^[-•*]\s*/, "• ")}
        </p>
      ))}
    </div>
  );
}
