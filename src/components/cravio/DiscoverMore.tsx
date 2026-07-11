import { Link } from "@tanstack/react-router";
import { useVisibleDiscoverCards, useVisibleTrendingChips } from "@/lib/discover-store";
import { TrendingUp } from "lucide-react";

/** Horizontal shortcut rail — admin-managed. */
export function DiscoverMore() {
  const cards = useVisibleDiscoverCards();
  if (cards.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between px-5">
        <h3 className="font-display text-[20px] font-extrabold tracking-tight">Discover more</h3>
      </div>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5 pb-1.5">
        {cards.map((c) => (
          <Link
            key={c.id}
            to="/app/search"
            search={{ q: c.query || c.title }}
            className="group flex w-[92px] shrink-0 flex-col items-center gap-2"
          >
            <div
              className="grid h-[68px] w-[68px] place-items-center overflow-hidden rounded-[22px] bg-surface shadow-soft ring-2 transition-all group-hover:-translate-y-0.5"
              style={{ borderColor: "transparent", boxShadow: c.color ? `inset 0 0 0 2px ${c.color}` : undefined }}
            >
              {c.image ? (
                <img src={c.image} alt={c.title} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="text-2xl">{c.icon}</span>
              )}
            </div>
            <span className="text-center text-[11px] font-bold leading-tight text-foreground/90">{c.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Trending Now chip row — admin-managed. */
export function TrendingNow() {
  const chips = useVisibleTrendingChips();
  if (chips.length === 0) return null;
  return (
    <section className="mt-3">
      <div className="flex items-center gap-1.5 px-5">
        <TrendingUp className="h-3.5 w-3.5 text-primary" strokeWidth={2.6} />
        <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-primary">Trending now</h3>
      </div>
      <div className="no-scrollbar mt-2 flex gap-2.5 overflow-x-auto px-5 pb-1.5">
        {chips.map((c) => (
          <Link
            key={c.id}
            to="/app/search"
            search={{ q: c.name }}
            className="group flex shrink-0 items-center gap-2 rounded-full bg-card px-2 py-1.5 pr-3.5 shadow-soft ring-1 ring-border/60 transition active:scale-95 hover:ring-primary/40"
          >
            <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-secondary">
              {c.image ? (
                <img src={c.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : null}
              <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-primary text-[8px] text-primary-foreground">↑</span>
            </span>
            <span className="text-[12px] font-bold">{c.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
