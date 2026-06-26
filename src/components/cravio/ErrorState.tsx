import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

export function ErrorState({
  title = "Something went wrong",
  description = "Please try again in a moment.",
  action,
  icon,
}: {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center animate-fade-up">
      <div className="relative">
        <span className="absolute inset-0 -m-3 rounded-full bg-destructive/10 blur-2xl" />
        <div className="relative grid h-24 w-24 place-items-center rounded-full bg-destructive/10 text-destructive shadow-soft ring-1 ring-destructive/20">
          {icon ?? <AlertTriangle className="h-8 w-8" />}
        </div>
      </div>
      <h3 className="mt-5 font-display text-[20px] font-extrabold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[13px] font-medium text-muted-foreground">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-[12px] font-extrabold uppercase tracking-widest text-primary-foreground shadow-glow transition active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
