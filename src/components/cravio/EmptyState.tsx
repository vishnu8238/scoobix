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
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center animate-fade-up">
      <div className="relative">
        <span className="absolute inset-0 -m-3 rounded-full bg-primary-soft/50 blur-2xl" />
        <div className="relative grid h-28 w-28 place-items-center rounded-full bg-primary-soft text-primary text-5xl shadow-soft ring-1 ring-primary/10">
          {icon}
        </div>
      </div>
      <h3 className="mt-6 font-display text-[22px] font-extrabold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-xs text-[13.5px] font-medium text-muted-foreground">{description}</p>
      {action && (
        <Link
          to={action.to}
          className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-[13px] font-extrabold uppercase tracking-widest text-primary-foreground shadow-glow transition active:scale-95"
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
      className={`relative overflow-hidden rounded-2xl bg-muted ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent, color-mix(in oklab, white 70%, transparent), transparent)",
        backgroundSize: "1000px 100%",
        animation: "shimmer 1.6s infinite linear",
      }}
    />
  );
}
