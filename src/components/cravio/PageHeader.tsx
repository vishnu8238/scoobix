import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  right,
  back = true,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  back?: boolean;
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        {back ? (
          <button
            onClick={() => (onBack ? onBack() : history.length > 1 ? history.back() : navigate({ to: "/app" }))}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-full bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <span />
        )}
        <div className="min-w-0 text-center">
          <h1 className="truncate font-display text-base font-bold">{title}</h1>
          {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="min-w-[40px] text-right">{right}</div>
      </div>
    </header>
  );
}
