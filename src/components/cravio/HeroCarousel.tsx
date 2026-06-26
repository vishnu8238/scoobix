import { useEffect, useState } from "react";
import { offers } from "@/lib/mock-data";
import burger from "@/assets/hero-burger.jpg";
import biryani from "@/assets/food-biryani.jpg";
import sushi from "@/assets/food-sushi.jpg";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/format";

const SLIDES = [
  { img: burger, position: "object-center", badge: "-40%" },
  { img: biryani, position: "object-[center_60%]", badge: "FREE" },
  { img: sushi, position: "object-center", badge: "2 FOR 1" },
];

export function HeroCarousel() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % offers.length), 4500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="px-5">
      <div className="relative h-60 overflow-hidden rounded-[32px] shadow-pop bg-foreground/10">
        {offers.map((o, i) => {
          const slide = SLIDES[i % SLIDES.length];
          const active = i === idx;
          return (
            <div
              key={o.id}
              className={cn(
                "absolute inset-0 transition-opacity duration-700",
                active ? "opacity-100" : "opacity-0 pointer-events-none",
              )}
            >
              {/* Food photo — full opacity, Ken Burns on active */}
              <img
                src={slide.img}
                alt=""
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-transform ease-out",
                  slide.position,
                  active ? "scale-110 duration-[6000ms]" : "scale-100 duration-700",
                )}
                loading={i === 0 ? "eager" : "lazy"}
              />

              {/* Bottom scrim for legibility */}
              <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
              {/* Left scrim behind headline */}
              <div className="absolute inset-y-0 left-0 w-3/5 bg-gradient-to-r from-black/45 to-transparent" />

              {/* Glass offer pill */}
              <div className="absolute left-6 top-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white ring-1 ring-white/30 backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
                  Limited Offer
                </span>
              </div>

              {/* Discount chip bottom-right */}
              <div className="absolute right-5 bottom-5">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-[11px] font-extrabold uppercase tracking-tight text-primary-foreground shadow-glow ring-4 ring-white/20">
                  {slide.badge}
                </span>
              </div>

              {/* Headline + CTA */}
              <div className="relative flex h-full flex-col justify-end p-7 pr-24">
                <h2 className="font-display text-[28px] font-extrabold leading-[0.95] tracking-tight text-white drop-shadow-sm">
                  {o.title}
                </h2>
                <p className="mt-1.5 text-[13px] font-medium text-white/85">
                  {o.subtitle} {o.code && <span className="text-white">· {o.code}</span>}
                </p>
                <button
                  onClick={() => toast.success(`Code ${o.code} applied at checkout`, { description: o.title })}
                  className="group/cta mt-4 inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-[13px] font-bold text-primary-strong shadow-card transition active:scale-95"
                >
                  {o.cta}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3.5 flex justify-center gap-1.5">
        {offers.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIdx(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === idx ? "w-7 bg-primary" : "w-1.5 bg-foreground/20",
            )}
          />
        ))}
      </div>
    </div>
  );
}
