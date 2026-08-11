import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  Truck, 
  ClipboardList, 
  Bike, 
  Navigation, 
  AlertTriangle, 
  BarChart3, 
  History, 
  Settings, 
  LogOut,
  Bell,
  Search
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
    <RoleGuard allow="logistics">
      <LogisticsLayout />
    </RoleGuard>
  );
}

const NAV = [
  { to: "/logistics", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/logistics/live", label: "Live Map", icon: MapIcon },
  { to: "/logistics/dispatch", label: "Dispatch", icon: Navigation },
  { to: "/logistics/orders", label: "Orders", icon: ClipboardList },
  { to: "/logistics/riders", label: "Riders", icon: Bike },
  { to: "/logistics/zones", label: "Zones", icon: MapIcon },
  { to: "/logistics/subzones", label: "Subzones", icon: MapIcon },
  { to: "/logistics/tracking", label: "Tracking", icon: Truck },
  { to: "/logistics/exceptions", label: "Exceptions", icon: AlertTriangle },
  { to: "/logistics/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/logistics/audit", label: "Audit Log", icon: History },
  { to: "/logistics/settings", label: "Settings", icon: Settings },
];

function LogisticsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();

  if (pathname === "/logistics/login") {
    return <Outlet />;
  }

  return (
    <div className="min-h-svh w-full bg-[radial-gradient(circle_at_top_left,_oklch(0.96_0.02_200_/_0.3),_oklch(0.99_0.005_200)_45%)] font-sans">
      <div className="mx-auto flex min-h-svh max-w-[1600px]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-svh w-64 flex-col gap-1 border-r border-border/60 bg-card/60 p-5 backdrop-blur-md md:flex">
          <div className="mb-6 flex items-center gap-3">
            <ScoobixMark size={36} />
            <div>
              <p className="font-display text-lg font-extrabold leading-none tracking-tight text-foreground">Scoobix</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-600">Logistics Portal</p>
            </div>
          </div>
          <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to as any}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                    active 
                      ? "bg-sky-600 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)]" 
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
                placeholder="Search riders, orders, zones…"
                className="h-11 w-full rounded-2xl bg-card pl-11 pr-4 text-sm font-medium shadow-soft ring-1 ring-border/60 transition focus:ring-2 focus:ring-sky-500/40"
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-soft ring-1 ring-border/60">
                <Bell className="h-4 w-4 text-foreground" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-sky-600 ring-2 ring-card" />
              </button>
              <div className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2 shadow-soft ring-1 ring-border/60">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-[12px] font-extrabold text-white">
                  {user?.name?.slice(0, 2).toUpperCase() || "OP"}
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-bold leading-none text-foreground">{user?.name || "Operator"}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Logistics Staff</p>
                </div>
              </div>
            </div>
          </header>

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
