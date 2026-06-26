import { useEffect, useState } from "react";
import { offers } from "@/lib/mock-data";
import burger from "@/assets/hero-burger.jpg";
import biryani from "@/assets/food-biryani.jpg";
import sushi from "@/assets/food-sushi.jpg";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/format";

const IMAGES = [burger, biryani, sushi];

export function HeroCarousel() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % offers.length), 4500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="px-5">
      <div className="relative h-60 overflow-hidden rounded-[32px] shadow-pop">
        {offers.map((o, i) => (
          <div
            key={o.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700",
              i === idx ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            <div className="relative h-full w-full gradient-hero">
              <img
                src={IMAGES[i % IMAGES.length]}
                alt=""
                className={cn(
                  "absolute inset-0 h-full w-full object-cover mix-blend-overlay opacity-70 transition-transform duration-[1600ms]",
                  i === idx ? "scale-105" : "scale-100",
                )}
                loading={i === 0 ? "eager" : "lazy"}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
              <div className="relative flex h-full flex-col justify-end p-7 text-primary-foreground">
                <span className="w-fit rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] shadow-glow">
                  Limited Offer
                </span>
                <h2 className="mt-3 font-display text-[28px] font-extrabold leading-[0.95] tracking-tight">
                  {o.title}
                </h2>
                <p className="mt-1.5 text-[13px] font-medium text-white/80">
                  {o.subtitle} {o.code && <span className="text-white/95">· {o.code}</span>}
                </p>
                <button
                  onClick={() => toast.success(`Code ${o.code} applied at checkout`, { description: o.title })}
                  className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-2xl bg-white px-5 py-2.5 text-[13px] font-bold text-primary-strong shadow-card transition active:scale-95"
                >
                  {o.cta} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3.5 flex justify-center gap-1.5">
        {offers.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIdx(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === idx ? "w-7 bg-primary" : "w-1.5 bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}
