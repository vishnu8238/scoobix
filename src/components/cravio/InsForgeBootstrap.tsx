/**
 * Mounts once at app root, kicks off the InsForge fetch, and shows a slim
 * top-of-screen banner if the API fails — with a Retry button. On success
 * or empty backend it renders nothing (existing mock data shows through).
 */
import { useEffect, useState } from "react";
import { bootstrapInsForge, insforgeState } from "@/lib/insforge";

export function InsForgeBootstrap() {
  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState(insforgeState.status);

  useEffect(() => {
    let cancelled = false;
    bootstrapInsForge().then(() => {
      if (!cancelled) setStatus(insforgeState.status);
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  if (status !== "error") return null;

  return (
    <div className="fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[60] mx-auto flex max-w-[480px] items-center justify-between gap-3 rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground shadow-glow">
      <span>Couldn’t reach Scoobix backend — showing demo data.</span>
      <button
        onClick={() => {
          setStatus("loading");
          setTick((n) => n + 1);
        }}
        className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider hover:bg-white/30"
      >
        Retry
      </button>
    </div>
  );
}
