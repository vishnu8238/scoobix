import { cn } from "@/lib/format";
import logo from "@/assets/scoobix-logo.png.asset.json";

const LOGO_URL = logo.url;

/**
 * Brand lockup: square logo mark + "Scoobix" wordmark.
 * The uploaded logo already contains the wordmark inside a green tile, so
 * we only render the wordmark beside the mark on larger lockups when the
 * caller asks for it via `showWordmark`.
 */
export function ScoobixLogo({
  className,
  size = 32,
  showWordmark = true,
}: {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <img
        src={LOGO_URL}
        alt="Scoobix"
        width={size}
        height={size}
        className="rounded-2xl object-contain shadow-glow"
        style={{ width: size, height: size }}
      />
      {showWordmark && (
        <span className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          Scoobix
        </span>
      )}
    </div>
  );
}

/** Square logo mark only, used as an app icon / standalone brand badge. */
export function ScoobixMark({
  size = 56,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={LOGO_URL}
      alt="Scoobix"
      width={size}
      height={size}
      className={cn("rounded-[28%] object-contain shadow-glow", className)}
      style={{ width: size, height: size }}
    />
  );
}
