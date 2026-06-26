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
    <div className="px-4">
      <div className="relative overflow-hidden rounded-3xl shadow-card">
        {offers.map((o, i) => (
          <div
            key={o.id}
            className={cn(
              "transition-opacity duration-700",
              i === idx ? "opacity-100" : "absolute inset-0 opacity-0 pointer-events-none",
            )}
          >
            <div className="relative gradient-hero text-primary-foreground">
              <img
                src={IMAGES[i % IMAGES.length]}
                alt=""
                className="absolute inset-y-0 right-0 h-full w-[55%] object-cover opacity-90 [mask-image:linear-gradient(to_left,black_40%,transparent)]"
                loading={i === 0 ? "eager" : "lazy"}
              />
              <div className="relative grid gap-3 p-5 pr-[40%]">
                <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                  Limited time
                </span>
                <h2 className="font-display text-[22px] font-extrabold leading-tight">
                  {o.title}
                </h2>
                <p className="text-sm text-white/85">{o.subtitle}</p>
                <button
                  onClick={() => toast.success(`Code ${o.code} applied at checkout`, { description: o.title })}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary shadow-soft transition hover:scale-[1.02]"
                >
                  {o.cta} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {offers.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIdx(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === idx ? "w-6 bg-primary" : "w-1.5 bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}
