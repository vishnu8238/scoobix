import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PortalShellSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading Scoobix portal...</span>
      {/* Sidebar placeholder */}
      <div className="w-64 border-r border-border bg-card p-6 hidden md:flex flex-col gap-6" aria-hidden="true">
        <Skeleton className="h-10 w-32" />
        <div className="space-y-4 pt-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card px-8 flex items-center justify-between" aria-hidden="true">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </header>
        <div className="flex-1 overflow-auto p-8">
          {children || <DashboardSkeleton />}
        </div>
      </main>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500" aria-hidden="true">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-3xl w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-500" aria-hidden="true">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="bg-muted/50 p-4 border-b border-border">
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500" aria-hidden="true">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Skeleton className="h-64 rounded-3xl w-full" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 rounded-2xl w-full" />
          </div>
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-3xl w-full" />
          <Skeleton className="h-64 rounded-3xl w-full" />
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-6 p-8 rounded-3xl border border-border bg-card">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ))}
        <div className="pt-4 flex gap-3">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function RiderSkeleton() {
  return (
    <div className="min-h-svh bg-background flex flex-col animate-in fade-in duration-500" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading delivery tasks...</span>
      <div className="h-48 bg-muted animate-pulse relative" aria-hidden="true">
        <div className="absolute bottom-6 left-6 space-y-3">
          <Skeleton className="h-4 w-24 bg-white/20" />
          <Skeleton className="h-8 w-48 bg-white/20" />
        </div>
      </div>
      <div className="flex-1 -mt-6 rounded-t-[2.5rem] bg-background p-6 space-y-6" aria-hidden="true">
        <Skeleton className="h-64 rounded-[2rem] w-full shadow-lg" />
        <Skeleton className="h-48 rounded-[2rem] w-full shadow-lg" />
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-card border border-border p-4 flex gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Bottom Nav placeholder */}
      <div className="h-20 border-t border-border bg-card px-8 flex items-center justify-around" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-10 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
