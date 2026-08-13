import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { 
  LayoutDashboard, Users, Bike, ClipboardList, 
  Sparkles, Map as MapIcon, 
  Navigation, History, LogOut, Search, Bell, Gauge
} from "lucide-react";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { APPS, appHead } from "@/lib/apps";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/format";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/logistics")({
  head: () => appHead(APPS.logistics),
  component: LogisticsLayoutGuard,
});

function LogisticsLayoutGuard() {
  return (
    <RoleGuard allow={["logistics", "admin"]}>
      <LogisticsLayout />
    </RoleGuard>
  );
}

const NAV: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/logistics", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/logistics/drivers", label: "Drivers", icon: Bike },
  { to: "/logistics/live", label: "Live Operations", icon: Gauge },
  { to: "/logistics/map", label: "Logistics Map", icon: MapIcon },
  { to: "/logistics/dispatch", label: "Manual Dispatch", icon: Navigation },
  { to: "/logistics/gigs", label: "Gig Management", icon: Sparkles },
  { to: "/logistics/orders", label: "Orders", icon: ClipboardList },
  { to: "/logistics/zones", label: "Zones & Delivery", icon: MapIcon },
  { to: "/logistics/subzones", label: "Subzones", icon: MapIcon },
  { to: "/logistics/audit", label: "Audit Logs", icon: History },
];

function LogisticsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Public login page is isolated from the protected shell.
  if (pathname === "/login") {
    return <Outlet />;
  }

  return (
    <div className="min-h-svh w-full bg-[radial-gradient(circle_at_top_left,_oklch(0.96_0.04_148_/_0.4),_oklch(0.99_0.005_120)_45%)] font-sans">
      <div className="mx-auto flex min-h-svh max-w-[1600px]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-svh w-64 flex-col gap-1 border-r border-border/60 bg-card/60 p-5 backdrop-blur-md md:flex">
          <div className="mb-6 flex items-center gap-3">
            <ScoobixMark size={36} />
            <div>
              <p className="font-display text-lg font-extrabold leading-none tracking-tight text-foreground">Scoobix</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Logistics Ops</p>
            </div>
          </div>
          <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                    active 
                      ? "bg-primary text-primary-foreground shadow-glow" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <n.icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 pt-4 border-t border-border/40">
            <SignOutButton />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-5 py-6 md:px-10 md:py-8">
          {/* Mobile top */}
          <div className="mb-6 flex items-center justify-between md:hidden">
            <div className="flex items-center gap-2">
              <ScoobixMark size={28} />
              <p className="font-display text-base font-extrabold text-foreground">Logistics</p>
            </div>
            <SignOutButton />
          </div>

          {/* Desktop top bar */}
          <header className="mb-8 hidden items-center justify-between md:flex">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search drivers, orders, zones…"
                className="h-11 w-full rounded-2xl bg-card pl-11 pr-4 text-sm font-medium shadow-soft outline-none ring-1 ring-border/60 transition focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-soft ring-1 ring-border/60">
                <Bell className="h-4 w-4 text-foreground" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
              </button>
              <div className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2 shadow-soft ring-1 ring-border/60">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-[12px] font-extrabold text-primary-foreground">LO</div>
                <div className="text-left">
                  <p className="text-[12px] font-bold leading-none text-foreground">Logistics Ops</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manager</p>
                </div>
              </div>
            </div>
          </header>

          {/* Mobile nav scroll */}
          <nav className="no-scrollbar mb-6 flex gap-2 overflow-x-auto md:hidden">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold transition",
                    active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button
      onClick={() => signOut()}
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </button>
  );
}
