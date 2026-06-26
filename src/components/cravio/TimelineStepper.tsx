import { STATUS_FLOW, STATUS_LABEL, type OrderStatus } from "@/lib/stores";
import { Check } from "lucide-react";
import { cn } from "@/lib/format";

export function TimelineStepper({ status }: { status: OrderStatus }) {
  const currentIdx = STATUS_FLOW.indexOf(status);
  return (
    <ol className="relative space-y-5 pl-7">
      <span className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" aria-hidden />
      <span
        className="absolute left-3 top-2 w-0.5 bg-primary transition-all duration-700"
        style={{ height: `${Math.max(0, currentIdx) / Math.max(1, STATUS_FLOW.length - 1) * 100}%` }}
        aria-hidden
      />
      {STATUS_FLOW.map((s, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s} className="relative">
            <span className={cn(
              "absolute -left-7 top-0 grid h-6 w-6 place-items-center rounded-full ring-4 ring-background transition-all",
              done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              active && "animate-pulse-soft",
            )}>
              {done ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <div>
              <div className={cn("text-sm font-semibold", done ? "text-foreground" : "text-muted-foreground")}>
                {STATUS_LABEL[s]}
              </div>
              <div className="text-xs text-muted-foreground">
                {active ? "In progress" : done ? "Done" : "Pending"}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
