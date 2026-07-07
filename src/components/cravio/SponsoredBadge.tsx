import { Megaphone } from "lucide-react";
import { cn } from "@/lib/format";

/** Small "Sponsored" pill used on restaurant/dish cards. Reuses Scoobix glass styling. */
export function SponsoredBadge({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest shadow-soft",
        dark ? "glass-dark" : "bg-foreground/85 text-white",
        className,
      )}
    >
      <Megaphone className="h-3 w-3" strokeWidth={2.6} />
      Sponsored
    </span>
  );
}
