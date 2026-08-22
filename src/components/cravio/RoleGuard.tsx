import React, { ReactNode, useEffect, useState } from "react";
import { useAuth, Role, getRequestedPortal } from "@/lib/auth-store";
import { useNavigate } from "@tanstack/react-router";
import { ShieldCheck, AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalShellSkeleton, RiderSkeleton, DetailSkeleton, FormSkeleton, ListSkeleton } from "@/components/skeletons/PortalSkeletons";
import { isAuthResolving } from "@/lib/auth-utils";

/**
 * SCOOBIX — ROLE GUARD
 * Validates authentication and portal membership.
 */

interface RoleGuardProps {
  allow?: Role | Role[];
  children: ReactNode;
  loading?: ReactNode;
  fallback?: ReactNode;
  transitionLabel?: string;
  bypass?: boolean;
}

export function RoleGuard({ allow, children, fallback, bypass }: RoleGuardProps) {
  const { user, loading, authState } = useAuth();
  const navigate = useNavigate();
  const portal = getRequestedPortal();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading || isAuthResolving(authState)) {
        console.warn("[AUTH_GUARD] Watchdog timeout in RoleGuard. Portal:", portal);
        setTimedOut(true);
      }
    }, 10000);

    if (typeof window !== 'undefined') {
      (window as any).__LAST_ROLE_GUARD_PATH__ = pathname;
      console.log(`[AUTH_TRACE] RoleGuard Path: ${pathname}, User: ${user?.id}, Resolved: ${user?.membershipsResolved}, Portal: ${portal}, State: ${authState}, Loading: ${loading}, Roles: ${user?.roles?.join(",")}`);
    }

    return () => clearTimeout(timer);
  }, [pathname, user, loading, authState, portal]);

  useEffect(() => {
    
    // AUTH HYDRATION PROTECTION: 
    // Do NOT trigger any redirects if auth is still initializing or resolving, or if bypassed.
    if (loading || isAuthResolving(authState) || bypass) return;
    
    // 1. Not logged in? 
    if (!user) {
      if (pathname === "/login" || pathname.includes("/onboarding") || pathname.includes("/auth/callback")) return;
      
      // If we are strictly unauthenticated (no session), go to login
      const loginPath = `/login?portal=${portal}`;
      console.log("[AUTH_DEBUG] RoleGuard: Unauthenticated, redirecting to login:", loginPath);
      
      // Use router navigate for internal routes if possible, fallback to replace
      navigate({ to: "/login", search: { portal } });
      return;
    }

    // 2. Wait for membership resolution before making any access decisions
    if (!user.membershipsResolved) return;

    // 3. Membership Check
    const allowedRoles = Array.isArray(allow) ? allow : allow ? [allow] : [];
    
    if (allowedRoles.length > 0) {
      const hasAccess = allowedRoles.some(role => user.roles.includes(role));
      
      if (!hasAccess) {
        if (!pathname.includes("/login") && !pathname.includes("/onboarding")) {
           console.log(`[AUTH_DEBUG] RoleGuard: ${portal} unauthorized for user ${user.email}. Redirecting.`);
           window.location.replace(`/login?portal=${portal}&denied=${portal}`);
        }
      }
    }
  }, [user, loading, portal, allow, navigate, pathname]);

  if (!bypass && (loading || isAuthResolving(authState) || (user && !user.membershipsResolved))) {
    // If we are already on a login page, just show it.
    if (pathname.includes("/login")) {
      return <>{children}</>;
    }
    
    // Choose appropriate skeleton based on portal path
    let SkeletonView = <PortalShellSkeleton />;
    if (pathname.startsWith("/rider")) SkeletonView = <RiderSkeleton />;
    else if (pathname.includes("/checkout")) SkeletonView = <DetailSkeleton />;
    else if (pathname.includes("/onboarding") || pathname.includes("/profile")) SkeletonView = <FormSkeleton />;
    else if (pathname.endsWith("/orders") || pathname.includes("/list")) SkeletonView = <ListSkeleton />;
    
    return (
      <div className="min-h-svh bg-background">
        {timedOut ? (
          <div className="flex min-h-svh items-center justify-center p-6 text-center">
            <div className="space-y-4 animate-fade-up max-w-xs">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-3xl shadow-soft">
                <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <p className="text-[10px] text-destructive font-black uppercase tracking-[0.2em]">Connection Timeout</p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">Verification is taking longer than expected. The server might be under heavy load.</p>
              </div>
              <Button 
                onClick={() => window.location.reload()}
                className="w-full h-12 rounded-2xl font-bold gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                Retry Connection
              </Button>
            </div>
          </div>
        ) : (
          SkeletonView
        )}
      </div>
    );
  }

  // 4. Denied / Disabled state handling
  if (!bypass && (authState === "denied" || authState === "disabled")) {
     const portalLabel = portal.charAt(0).toUpperCase() + portal.slice(1);
     return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6 text-center animate-fade-up">
        <div className="mb-6 h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center ring-1 ring-destructive/20 shadow-soft">
          <ShieldCheck className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight mb-2 uppercase italic">Access Restricted</h1>
        <p className="text-sm text-muted-foreground max-w-xs mb-8">
          {authState === "disabled" 
            ? `Your access to the ${portalLabel} portal has been disabled by an administrator.`
            : `You do not have permission to access the ${portalLabel} portal with account ${user?.email}.`}
        </p>
        
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button 
            onClick={() => window.location.replace(`/login?portal=${portal}`)}
            className="h-12 rounded-2xl shadow-glow font-bold"
          >
            Try Another Account
          </Button>
          <Button 
            variant="ghost"
            onClick={() => window.location.replace("/")}
            className="h-12 rounded-2xl text-xs font-bold uppercase tracking-widest"
          >
            Back to Home
          </Button>
        </div>
        
        {/* Safe Diagnostics */}
        <div className="mt-12 pt-6 border-t border-border/40 w-full max-w-xs opacity-40">
           <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Authorization Details</p>
           <div className="text-[9px] font-mono text-left space-y-0.5">
             <p>Portal: {portal}</p>
             <p>Email: {user?.email?.toLowerCase()}</p>
             <p>Reason: {authState}</p>
             <p>Resolved: {String(user?.membershipsResolved)}</p>
           </div>
        </div>
      </div>
     );
  }

  // If not logged in and not on login/onboarding, we've triggered a redirect.
  if (!user && !pathname.includes("/login") && !pathname.includes("/onboarding")) {
    return <div className="min-h-svh bg-background" />;
  }

  return <>{children}</>;
}