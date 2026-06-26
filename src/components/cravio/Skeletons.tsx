import { Skeleton } from "./EmptyState";

export function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60">
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60">
          <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-3 h-6 w-3/4" />
        </div>
      ))}
    </div>
  );
}
