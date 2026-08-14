import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Store, PlusCircle, Users, MoreHorizontal } from "lucide-react";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { APPS, appHead } from "@/lib/apps";
import { cn } from "@/lib/format";
import { useManager } from "@/lib/manager-api";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { getInitials } from "@/lib/identity-utils";

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
  
  return (
    <RoleGuard allow="manager">
      <ManagerShell pathname={pathname} />
    </RoleGuard>
  );
}

function ManagerShell({ pathname }: { pathname: string }) {
  const { manager, loading } = useManager();
  const secondary = pathname.startsWith("/manager/") && !PRIMARY.has(pathname);
  
  // Admission is based solely on Manager membership (manager record existence and active status).
  // Restaurant onboarding status is a feature, not a blocker.

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
      <header className="px-5 pt-6 pb-2 flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-[12px] font-extrabold text-primary-foreground mr-1">
            {getInitials(manager?.name) || "M"}
          </div>
          <div className="text-left">
            <p className="text-[12px] font-bold leading-none text-foreground">{manager?.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Scoobix Manager</p>
          </div>
        </div>
      </header>
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
