import { cn } from "@/lib/format";

export function CravioLogo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="grid place-items-center rounded-2xl gradient-primary text-primary-foreground font-bold shadow-glow"
        style={{ width: size, height: size, fontSize: size * 0.55 }}
        aria-hidden
      >
        c
      </span>
      <span className="font-display text-2xl font-extrabold tracking-tight text-foreground">
        Cravio
      </span>
    </div>
  );
}

export function CravioMark({ size = 56 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-[28%] gradient-primary text-primary-foreground font-bold shadow-glow"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-hidden
    >
      c
    </span>
  );
}
