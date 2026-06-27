import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";

type Conn = { effectiveType?: string; saveData?: boolean };

function getConnection(): Conn | undefined {
  if (typeof navigator === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (navigator as any).connection;
}

/**
 * Tiny top-of-screen banner for offline / slow-network / failed-refresh states.
 * - Offline: shows "You're offline — showing cached content"
 * - Slow link (2g / save-data): shows lightweight notice
 * - Any background query errored: shows Retry button that re-fetches all queries
 *
 * Renders nothing in the happy path, so it never affects layout.
 */
export function NetworkBanner() {
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const [online, setOnline] = useState(true);
  const [slow, setSlow] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    const conn = getConnection();
    const checkSlow = () => {
      const c = getConnection();
      const et = c?.effectiveType ?? "";
      setSlow(Boolean(c?.saveData) || et === "slow-2g" || et === "2g");
    };
    checkSlow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (conn as any)?.addEventListener?.("change", checkSlow);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (conn as any)?.removeEventListener?.("change", checkSlow);
    };
  }, []);

  // Surface error state from the query cache without re-rendering on every fetch tick.
  useEffect(() => {
    const cache = qc.getQueryCache();
    const recompute = () => {
      setHasError(cache.getAll().some((q) => q.state.status === "error"));
    };
    recompute();
    return cache.subscribe(recompute);
  }, [qc]);

  if (online && !slow && !hasError) return null;

  const retry = () => {
    void qc.refetchQueries({ stale: true });
    void qc.invalidateQueries();
  };

  const message = !online
    ? "You're offline — showing saved content"
    : hasError
      ? "Couldn't refresh latest data"
      : "Slow connection — using lighter data";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex max-w-[440px] items-center gap-2 rounded-full bg-foreground/90 px-3.5 py-2 text-[11.5px] font-semibold text-background shadow-pop backdrop-blur">
        <WifiOff className="h-3.5 w-3.5 opacity-80" />
        <span className="truncate">{message}</span>
        {(hasError || !online) && (
          <button
            onClick={retry}
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-widest text-primary-foreground active:scale-95"
          >
            <RefreshCw className={`h-3 w-3 ${fetching ? "animate-spin" : ""}`} />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
