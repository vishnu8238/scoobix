import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Truck, MapPin, Users, Package, Zap, Settings, MoreHorizontal } from "lucide-react";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { APPS, appHead } from "@/lib/apps";
import { cn } from "@/lib/format";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";

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

const NAV = [
  { to: "/logistics", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/logistics/drivers", label: "Drivers", icon: Users },
  { to: "/logistics/orders", label: "Orders", icon: Package },
  { to: "/logistics/live", label: "Live Ops", icon: Zap },
  { to: "/logistics/map", label: "Map", icon: MapPin },
  { to: "/logistics/dispatch", label: "Dispatch", icon: Truck },
  { to: "/logistics/zones", label: "Zones", icon: MapPin },
  { to: "/logistics/subzones", label: "Subzones", icon: MapPin },
  { to: "/logistics/gigs", label: "Gigs", icon: Package },
  { to: "/logistics/audit", label: "Audit Logs", icon: History },
  { to: "/logistics/settings", label: "Settings", icon: Settings },
];

function LogisticsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-svh bg-background font-sans">
      {/* DESKTOP SIDEBAR */}
      <aside className="sticky top-0 hidden h-svh w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-full flex-col p-6">
          {/* Logo */}
          <div className="mb-8 flex items-center gap-3">
            <ScoobixMark size={32} />
            <span className="font-display text-xl font-extrabold tracking-tight">Logistics</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                    active 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="mx-auto max-w-7xl animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
