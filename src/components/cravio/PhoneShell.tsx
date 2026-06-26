import type { ReactNode } from "react";

/**
 * Centers the app in a phone-shaped frame on desktop while staying
 * edge-to-edge on actual mobile devices. Provides the ambient gradient.
 */
export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh w-full bg-[radial-gradient(circle_at_top,_oklch(0.96_0.04_148),_oklch(0.99_0.005_120)_60%)] md:py-8">
      <div className="relative mx-auto w-full max-w-[480px] min-h-svh md:min-h-[calc(100svh-4rem)] bg-background md:rounded-[2.25rem] md:shadow-float md:overflow-hidden md:ring-1 md:ring-border/60 isolate">
        {children}
      </div>
    </div>
  );
}
