import React from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-store";
import { getDisplayName, getInitials } from "@/lib/identity-utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  back?: boolean | string; // Compatibility
  right?: React.ReactNode;
  showProfile?: boolean;
}

export function PageHeader({ title, subtitle, backTo, back, right, showProfile = true }: PageHeaderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);

  const backPath = backTo || (typeof back === 'string' ? back : back === true ? -1 : undefined);

  return (
    <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md px-5 py-4 flex items-center justify-between border-b border-border/40">
      <div className="flex items-center gap-3">
        {backPath && (
          <button 
            onClick={() => backPath === -1 ? window.history.back() : navigate({ to: backPath as any })}
            className="p-2 -ml-2 rounded-full hover:bg-secondary/50 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="font-display text-lg font-extrabold tracking-tight uppercase italic leading-none">{title}</h1>
          {subtitle && <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {right}
        {showProfile && user && (
          <button 
            onClick={() => navigate({ to: "/manager/profile" as any })}
            className="group flex items-center gap-2 text-left"
          >
            <div className="hidden sm:block text-right">
              <p className="text-[10px] font-extrabold uppercase tracking-tighter leading-none group-hover:text-primary transition-colors">
                {displayName}
              </p>
              <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Manager</p>
            </div>
            <div className="h-8 w-8 rounded-xl bg-primary-soft flex items-center justify-center text-[10px] font-bold text-primary ring-1 ring-primary/10 group-hover:ring-primary/30 transition-all">
              {user.avatar ? (
                <img src={user.avatar} alt={displayName} className="h-full w-full rounded-xl object-cover" />
              ) : (
                initials
              )}
            </div>
          </button>
        )}
      </div>
    </header>
  );
}
