import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function EmptyState({
  icon, title, description, action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center animate-fade-up">
      <div className="grid h-24 w-24 place-items-center rounded-full bg-primary-soft text-primary text-4xl shadow-soft">
        {icon}
      </div>
      <h3 className="mt-5 font-display text-xl font-bold">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action && (
        <Link
          to={action.to}
          className="mt-6 inline-flex items-center gap-2 rounded-full gradient-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-glow"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-muted ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent, color-mix(in oklab, white 60%, transparent), transparent)",
        backgroundSize: "1000px 100%",
        animation: "shimmer 1.6s infinite linear",
      }}
    />
  );
}
