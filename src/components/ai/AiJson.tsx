/**
 * Generic renderer for structured AI output.
 * Keeps AI panels visually consistent without bespoke markup per task.
 */
import { cn } from "@/lib/format";

function label(k: string) {
  return k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function Scalar({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">
            {String(v)}
          </span>
        ))}
      </span>
    );
  }
  return <span>{String(value)}</span>;
}

export function AiJson({ data, className }: { data: unknown; className?: string }) {
  if (data === null || data === undefined) return null;

  if (typeof data === "string") return <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", className)}>{data}</p>;

  if (Array.isArray(data)) {
    return (
      <ul className={cn("space-y-2", className)}>
        {data.map((row, i) => (
          <li key={i} className="rounded-2xl bg-secondary/50 p-3 ring-1 ring-border/40">
            <AiJson data={row} />
          </li>
        ))}
      </ul>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <div className={cn("space-y-2", className)}>
        {entries.map(([k, v]) => {
          const nested = v && typeof v === "object";
          return (
            <div key={k} className={nested ? "space-y-1" : "flex items-start justify-between gap-3"}>
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label(k)}</span>
              <div className={cn("text-sm", nested ? "" : "text-right font-semibold")}>
                {nested ? <AiJson data={v} /> : <Scalar value={v} />}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return <Scalar value={data} />;
}
