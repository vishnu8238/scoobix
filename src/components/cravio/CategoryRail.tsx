import { Link, useRouterState } from "@tanstack/react-router";
import { categories } from "@/lib/mock-data";
import { quickOffers } from "@/lib/mock-data";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/format";

export function CategoryRail() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // first category is "active" highlight on home for a hint of motion
  return (
    <div>
      <div className="flex items-center justify-between px-5">
        <h3 className="font-display text-[20px] font-extrabold tracking-tight">Explore flavors</h3>
        <Link to="/app/search" className="text-[11px] font-extrabold uppercase tracking-widest text-primary">View all</Link>
      </div>
      <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto px-5 pb-1.5">
        {categories.map((c, i) => {
          const active = i === 0 && pathname === "/app";
          return (
            <Link
              to="/app/search"
              search={{ q: c.name }}
              key={c.id}
              className="group flex shrink-0 flex-col items-center gap-2.5"
            >
              <div className={cn(
                "relative grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-[24px] transition-all duration-300",
                active
                  ? "bg-surface ring-2 ring-primary shadow-[0_8px_20px_-4px_color-mix(in_oklab,var(--primary)_30%,transparent)]"
                  : "bg-surface ring-1 ring-border shadow-soft group-hover:ring-primary/40",
              )}>
                <img src={c.image} alt={c.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                <span className="absolute bottom-1 right-1 text-[14px]">{c.emoji}</span>
              </div>
              <span className={cn(
                "text-[11px] font-bold uppercase tracking-widest transition-colors",
                active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}>{c.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function QuickOffers() {
  return (
    <div className="px-5">
      <div className="grid grid-cols-3 gap-3">
        {quickOffers.map((q) => (
          <div
            key={q.id}
            className={cn(
              "rounded-[20px] p-3.5 shadow-soft ring-1 ring-border/60 transition-all duration-300 hover:-translate-y-0.5",
              q.tone === "primary" && "bg-primary-soft text-primary-strong",
              q.tone === "warm" && "bg-[oklch(0.97_0.04_70)] text-[oklch(0.36_0.13_60)]",
              q.tone === "cool" && "bg-[oklch(0.96_0.04_220)] text-[oklch(0.34_0.12_240)]",
            )}
          >
            <div className="text-xl">{q.icon}</div>
            <div className="mt-2 font-display text-[13px] font-extrabold leading-tight tracking-tight">{q.title}</div>
            <div className="mt-0.5 text-[11px] font-medium opacity-75">{q.subtitle}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; to: string } }) {
  return (
    <div className="flex items-end justify-between px-5">
      <h3 className="font-display text-[22px] font-extrabold tracking-tight">{title}</h3>
      {action && (
        <Link to={action.to} className="inline-flex items-center gap-0.5 text-[11px] font-extrabold uppercase tracking-widest text-primary">
          {action.label} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
