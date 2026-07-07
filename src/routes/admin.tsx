import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Store, Bike, ClipboardList, CreditCard, BarChart3, Settings, Repeat, Bell, Search, Sparkles, Megaphone, Building2 } from "lucide-react";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Operations" }] }),
  component: AdminLayout,
});

const NAV: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/cms", label: "CMS Studio", icon: Sparkles },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/restaurants", label: "Restaurants", icon: Store },
  { to: "/admin/drivers", label: "Drivers", icon: Bike },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/ads", label: "Ads", icon: Megaphone },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <RoleGuard allow="admin">
    <div className="min-h-svh w-full bg-[radial-gradient(circle_at_top_left,_oklch(0.96_0.04_148_/_0.4),_oklch(0.99_0.005_120)_45%)]">
      <div className="mx-auto flex min-h-svh max-w-[1600px]">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-svh w-64 flex-col gap-1 border-r border-border/60 bg-card/60 p-5 backdrop-blur-md md:flex">
          <div className="mb-6 flex items-center gap-3">
            <ScoobixMark size={36} />
            <div>
              <p className="font-display text-lg font-extrabold leading-none tracking-tight">Scoobix</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Master Admin</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                    active ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <n.icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Link to="/portal" className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition hover:bg-foreground/5">
            <Repeat className="h-3.5 w-3.5" />
            Switch role
          </Link>
        </aside>

        {/* Main */}
        <main className="flex-1 px-5 py-6 md:px-10 md:py-8">
          {/* Mobile top */}
          <div className="mb-6 flex items-center justify-between md:hidden">
            <div className="flex items-center gap-2">
              <ScoobixMark size={28} />
              <p className="font-display text-base font-extrabold">Admin</p>
            </div>
            <Link to="/portal" className="rounded-full bg-muted px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Switch
            </Link>
          </div>

          {/* Desktop top bar */}
          <header className="mb-8 hidden items-center justify-between md:flex">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search users, orders, restaurants…"
                className="h-11 w-full rounded-2xl bg-card pl-11 pr-4 text-sm font-medium shadow-soft outline-none ring-1 ring-border/60 transition focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-soft ring-1 ring-border/60">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
              </button>
              <div className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2 shadow-soft ring-1 ring-border/60">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-[12px] font-extrabold text-primary-foreground">AD</div>
                <div className="text-left">
                  <p className="text-[12px] font-bold leading-none">Anika D.</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operator</p>
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
    </RoleGuard>
  );
}

