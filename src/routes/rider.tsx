import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Home, Inbox, Navigation, Wallet } from "lucide-react";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { APPS, appHead } from "@/lib/apps";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/rider")({
  head: () => appHead(APPS.rider),
  component: RiderLayout,
});

const NAV: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/rider", label: "Home", icon: Home, exact: true },
  { to: "/rider/requests", label: "Requests", icon: Inbox },
  { to: "/rider/active", label: "Active", icon: Navigation },
  { to: "/rider/earnings", label: "Earnings", icon: Wallet },
];

function RiderLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <RoleGuard allow="rider">
      <div className="relative pb-24">
        <Outlet />
        <nav className="glass fixed bottom-3 left-1/2 z-40 flex w-[min(440px,calc(100%-1.5rem))] -translate-x-1/2 items-center justify-between rounded-full px-2 py-2 shadow-float">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <n.icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2} />
                {n.label}
                {active && <span className="absolute -top-0.5 h-1 w-1 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </RoleGuard>
  );
}

