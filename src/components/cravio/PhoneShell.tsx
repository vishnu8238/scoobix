import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

/**
 * Centers the app in a phone-shaped frame on desktop while staying
 * edge-to-edge on actual mobile devices. Provides the ambient gradient.
 *
 * Adds a native-feeling left-edge swipe-back gesture: drag from the left
 * edge of the screen to navigate to the previous page.
 */
export function PhoneShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(0);
  const stateRef = useRef<{ active: boolean; startX: number; startY: number }>({
    active: false, startX: 0, startY: 0,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const EDGE = 24;            // px from left where gesture can begin
    const TRIGGER = 90;         // px drag to commit navigation
    const MAX = 140;            // visual cap

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const rect = el.getBoundingClientRect();
      if (t.clientX - rect.left > EDGE) return;
      stateRef.current = { active: true, startX: t.clientX, startY: t.clientY };
    };
    const onMove = (e: TouchEvent) => {
      const s = stateRef.current;
      if (!s.active) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - s.startX;
      const dy = Math.abs(t.clientY - s.startY);
      if (dx < 0 || dy > Math.abs(dx)) { // not a horizontal-right drag
        if (drag !== 0) setDrag(0);
        return;
      }
      setDrag(Math.min(dx, MAX));
    };
    const onEnd = () => {
      const s = stateRef.current;
      if (!s.active) return;
      stateRef.current = { active: false, startX: 0, startY: 0 };
      const committed = drag >= TRIGGER;
      setDrag(0);
      if (committed) {
        try { router.history.back(); } catch { /* noop */ }
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [router, drag]);

  const progress = Math.min(drag / 90, 1);

  return (
    <div className="min-h-svh w-full bg-[radial-gradient(circle_at_top,_oklch(0.96_0.04_148),_oklch(0.99_0.005_120)_60%)] md:py-8">
      <div
        ref={ref}
        className="relative mx-auto w-full max-w-[480px] min-h-svh md:min-h-[calc(100svh-4rem)] bg-background md:rounded-[2.25rem] md:shadow-float md:overflow-hidden md:ring-1 md:ring-border/60 isolate touch-pan-y"
        style={{
          transform: drag ? `translate3d(${drag * 0.35}px,0,0)` : undefined,
          transition: drag ? "none" : "transform 220ms cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* Native-style edge-swipe affordance — only visible while dragging */}
        {drag > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-2 top-1/2 z-50 -translate-y-1/2"
            style={{ opacity: progress }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/85 text-background shadow-pop backdrop-blur"
              style={{ transform: `scale(${0.6 + progress * 0.4})` }}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
