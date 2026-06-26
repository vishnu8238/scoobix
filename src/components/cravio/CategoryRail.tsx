import { Link } from "@tanstack/react-router";
import { categories } from "@/lib/mock-data";
import { quickOffers } from "@/lib/mock-data";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/format";

export function CategoryRail() {
  return (
    <div>
      <div className="flex items-center justify-between px-4">
        <h3 className="font-display text-lg font-bold">What's on your mind?</h3>
      </div>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
        {categories.map((c) => (
          <Link
            to="/app/search"
            search={{ q: c.name }}
            key={c.id}
            className="group shrink-0 text-center"
          >
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl shadow-soft ring-1 ring-border/60 transition-transform group-hover:scale-[1.03]">
              <img src={c.image} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              <span className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-bold text-white">
                {c.emoji}
              </span>
            </div>
            <span className="mt-1.5 block text-xs font-semibold text-foreground">{c.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function QuickOffers() {
  return (
    <div className="px-4">
      <div className="grid grid-cols-3 gap-2.5">
        {quickOffers.map((q) => (
          <div
            key={q.id}
            className={cn(
              "rounded-2xl p-3 shadow-soft transition hover:scale-[1.02]",
              q.tone === "primary" && "bg-primary-soft text-primary",
              q.tone === "warm" && "bg-[oklch(0.97_0.04_70)] text-[oklch(0.42_0.13_60)]",
              q.tone === "cool" && "bg-[oklch(0.96_0.04_220)] text-[oklch(0.4_0.12_240)]",
            )}
          >
            <div className="text-xl">{q.icon}</div>
            <div className="mt-1.5 text-[13px] font-bold leading-tight">{q.title}</div>
            <div className="text-[11px] opacity-80">{q.subtitle}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; to: string } }) {
  return (
    <div className="flex items-center justify-between px-4">
      <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
      {action && (
        <Link to={action.to} className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary">
          {action.label} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
