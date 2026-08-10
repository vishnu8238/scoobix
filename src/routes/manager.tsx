import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Store, PlusCircle, Users, MoreHorizontal, LogIn } from "lucide-react";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { APPS, appHead } from "@/lib/apps";
import { cn } from "@/lib/format";
import { useManager } from "@/lib/manager-api";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/manager")({
  head: () => appHead(APPS.manager),
  component: ManagerLayout,
});

const NAV: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/manager", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/manager/leads", label: "Leads", icon: Users },
  { to: "/manager/restaurants", label: "Restaurants", icon: Store },
  { to: "/manager/onboarding", label: "Onboard", icon: PlusCircle },
  { to: "/manager/more", label: "More", icon: MoreHorizontal },
];


const PRIMARY = new Set(NAV.map((n) => n.to));

function ManagerLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, login } = useAuth();
  
  if (!user && pathname === "/manager") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center animate-fade-up">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#0f766e] shadow-glow">
          <LogIn className="h-10 w-10 text-white" strokeWidth={2.5} />
        </div>
        
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Manager Portal</h1>
        <p className="mt-2 text-muted-foreground max-w-[280px]">Sign in to manage your merchant operations</p>

        <div className="mt-10 w-full space-y-4 max-w-[320px]">
          <Button 
            onClick={(e) => {
              console.log("[GOOGLE_OAUTH] BUTTON_CLICKED - UI (Manager)");
              e.preventDefault();
              e.stopPropagation();
              login('google', 'manager').catch(err => {
                console.error("[GOOGLE_OAUTH] UI_ERROR:", err);
              });
            }}
            className="h-14 w-full rounded-2xl bg-white text-black ring-1 ring-border shadow-soft hover:bg-zinc-50 font-bold"
          >
            <img src="https://www.google.com/favicon.ico" className="mr-3 h-5 w-5" alt="" />
            Continue with Google
          </Button>

          <Button 
            onClick={(e) => {
              console.log("[APPLE_OAUTH] BUTTON_CLICKED - UI (Manager)");
              e.preventDefault();
              e.stopPropagation();
              login('apple', 'manager').catch(err => {
                console.error("[APPLE_OAUTH] UI_ERROR:", err);
              });
            }}
            className="h-14 w-full rounded-2xl bg-black text-white shadow-pop hover:bg-zinc-900 font-bold"
          >
            <img src="https://appleid.cdn-apple.com/appleauth/static/bin/cb126075202/images/favicon.ico" className="mr-3 h-5 w-5 invert" alt="" />
            Continue with Apple
          </Button>
        </div>
      </div>
    );
  }

  return (
    <RoleGuard allow="manager" transitionLabel="Accessing Manager Portal...">
      <ManagerShell pathname={pathname} />
    </RoleGuard>
  );
}

function ManagerShell({ pathname }: { pathname: string }) {
  const { manager, loading } = useManager();
  const secondary = pathname.startsWith("/manager/") && !PRIMARY.has(pathname);

  if (!loading && manager && manager.status !== "active") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-8 text-center">
        <ScoobixMark size={56} />
        <h1 className="font-display text-xl font-extrabold">Account deactivated</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your merchant manager access has been paused by the Scoobix admin team. Contact
          support to have it reactivated.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pb-24">
      <Outlet />
      <nav className="glass fixed bottom-3 left-1/2 z-40 flex w-[min(440px,calc(100%-1.5rem))] -translate-x-1/2 items-center justify-between rounded-full px-2 py-2 shadow-float">
        {NAV.map((n) => {
          const active =
            n.to === "/manager/more"
              ? pathname === "/manager/more" || secondary
              : n.exact
                ? pathname === n.to
                : pathname === n.to || pathname.startsWith(n.to + "/");
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-2 text-[10px] font-bold uppercase tracking-wider transition",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <n.icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.6 : 2} />
              <span className="w-full truncate text-center">{n.label}</span>
              {active && <span className="absolute -top-0.5 h-1 w-1 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
