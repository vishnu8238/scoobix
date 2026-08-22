import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { useRouterState } from "@tanstack/react-router";
import { ShieldCheck, Mail, AlertTriangle, RefreshCcw } from "lucide-react";
import { loginWithGoogle } from "@/lib/insforge-auth";
import { isAuthResolving } from "@/lib/auth-utils";

/**
 * P0.1: Authoritative Admin Guard
 * Uses AuthStore state and exclusive portal_access admission.
 */

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading: authLoading, authState } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (authLoading || isAuthResolving(authState)) {
        setTimedOut(true);
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, [authLoading, authState]);

  // Auth Hydration / Resolution State
  if ((authLoading || isAuthResolving(authState)) && pathname !== "/login") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          {timedOut ? (
            <div className="text-center space-y-4 animate-fade-up max-w-xs">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl shadow-soft">
                <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-[10px] text-destructive font-black uppercase tracking-[0.2em]">Security Timeout</p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">Verification is taking longer than expected. The server might be under heavy load.</p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="w-full h-12 rounded-2xl bg-white text-black font-bold flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <RefreshCcw className="h-4 w-4" />
                Retry Connection
              </button>
            </div>
          ) : (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 animate-pulse">
                Security Verification...
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Signed out?
  if (!user && pathname !== "/login") {
    // Already handled by RoleGuard if nested, but this provides a fallback
    window.location.replace(`/login?portal=admin`);
    return <div className="min-h-svh bg-zinc-950" />;
  }

  // Denied / Not Admin?
  const isAdmin = user?.roles?.includes("admin");
  if (user && !isAdmin && pathname !== "/login") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-950 px-6 text-center animate-fade-up">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-zinc-900 shadow-[0_0_50px_rgba(255,255,255,0.05)] ring-1 ring-zinc-800">
          <ShieldCheck className="h-10 w-10 text-white" strokeWidth={1.5} />
        </div>
        
        <div className="mb-6 w-full max-w-[320px] overflow-hidden rounded-2xl bg-destructive/10 ring-1 ring-destructive/20 text-left">
          <div className="p-4 border-b border-destructive/10">
            <p className="text-xs font-bold text-destructive uppercase tracking-wider">Access Restricted</p>
            <p className="mt-1 text-[13px] font-medium text-destructive/90">
              This account is not authorized for Scoobix Admin.
            </p>
          </div>
          
          <div className="bg-zinc-900/50 p-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
              <Mail className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Current Account</span>
              <span className="text-xs font-medium text-zinc-300 truncate">{user.email}</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[320px] space-y-4">
          <button
            onClick={() => loginWithGoogle("admin", { prompt: "select_account" })}
            className="h-14 w-full rounded-2xl bg-white text-black shadow-lg hover:bg-zinc-200 font-bold transition-all active:scale-95"
          >
            Sign in with another account
          </button>
          
          <button
            onClick={() => window.location.replace("/login?portal=admin")}
            className="block w-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
