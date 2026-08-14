import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { 
  Tag, LayoutDashboard, Users, Store, Bike, ClipboardList, 
  CreditCard, BarChart3, Settings, Bell, Search, Sparkles, 
  Megaphone, Building2, Wallet, Gift, Compass, TrendingUp, 
  LifeBuoy, Copy, Gauge, ShieldCheck, Crown, Map as MapIcon, 
  Navigation, History, LogOut, ChevronLeft, ChevronRight,
  MessageSquare, ShieldAlert, AlertTriangle
} from "lucide-react";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { useAuth } from "@/lib/auth-store";
import { APPS, appHead } from "@/lib/apps";
import { cn } from "@/lib/format";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { getInitials } from "@/lib/identity-utils";
import { useState } from "react";

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
  { to: "/logistics/operations", label: "Live Operations", icon: Gauge },
  { to: "/logistics/map", label: "Logistics Map", icon: MapIcon },
  { to: "/logistics/gigs", label: "Gig Management", icon: Sparkles },
  { to: "/logistics/verification", label: "Verification & KYC", icon: ShieldCheck },
  { to: "/logistics/support", label: "Support Desk", icon: LifeBuoy },
  { to: "/logistics/disputes", label: "Disputes", icon: AlertTriangle },
  { to: "/logistics/cms", label: "CMS Studio", icon: Sparkles },
  
  { to: "/logistics/drivers", label: "Drivers", icon: Bike, section: "Fleet" },
  { to: "/logistics/orders", label: "Orders", icon: ClipboardList, section: "Fleet" },
  { to: "/logistics/dispatch", label: "Manual Dispatch", icon: Navigation, section: "Fleet" },
  { to: "/logistics/zones", label: "Zones & Delivery", icon: MapIcon, section: "Fleet" },
  { to: "/logistics/subzones", label: "Subzones", icon: MapIcon, section: "Fleet" },

  { to: "/logistics/restaurants", label: "Restaurants", icon: Store, section: "Merchant" },
  { to: "/logistics/managers", label: "Merchant Managers", icon: Building2, section: "Merchant" },
  { to: "/logistics/bulk-orders", label: "Bulk Orders", icon: Building2, section: "Merchant" },

  { to: "/logistics/access", label: "Access Management", icon: ShieldCheck, section: "Admin" },
  { to: "/logistics/audit", label: "Audit Logs", icon: History, section: "Admin" },
  { to: "/logistics/users", label: "Users", icon: Users, section: "Admin" },
  { to: "/logistics/security", label: "Security & Audit", icon: ShieldCheck, section: "Admin" },
  
  { to: "/logistics/marketing", label: "Marketing", icon: Megaphone, section: "Growth" },
  { to: "/logistics/coupons", label: "Coupons", icon: Tag, section: "Growth" },
  { to: "/logistics/ads", label: "Ads", icon: Megaphone, section: "Growth" },
  
  { to: "/logistics/payments", label: "Payments", icon: CreditCard, section: "FinOps" },
  { to: "/logistics/wallets", label: "Wallets", icon: Wallet, section: "FinOps" },
  { to: "/logistics/reports", label: "Reports", icon: BarChart3, section: "FinOps" },
  { to: "/logistics/performance", label: "Performance", icon: Gauge, section: "Admin" },
];

function LogisticsLayout() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  const sections = Array.from(new Set(NAV.map(n => n.section || "General")));

  return (
    <div className="min-h-svh w-full bg-[radial-gradient(circle_at_top_left,_oklch(0.96_0.04_148_/_0.4),_oklch(0.99_0.005_120)_45%)] font-sans">
      <div className="mx-auto flex min-h-svh max-w-full">
        {/* Sidebar */}
        <aside className={cn(
          "sticky top-0 hidden h-svh flex-col gap-1 border-r border-border/60 bg-card/60 p-5 backdrop-blur-md transition-all duration-300 md:flex",
          collapsed ? "w-20" : "w-64"
        )}>
          <div className="mb-6 flex items-center justify-between">
            <div className={cn("flex items-center gap-3 overflow-hidden", collapsed && "w-0 opacity-0")}>
              <ScoobixMark size={36} />
              <div>
                <p className="font-display text-lg font-extrabold leading-none tracking-tight text-foreground">Scoobix</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Logistics</p>
              </div>
            </div>
            <button 
              onClick={() => setCollapsed(!collapsed)}
              className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground transition hover:bg-primary-soft hover:text-primary active:scale-90"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <nav className="no-scrollbar flex-1 space-y-6 overflow-y-auto">
            {sections.map(section => (
              <div key={section} className="space-y-1">
                {!collapsed && (
                  <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                    {section}
                  </p>
                )}
                {NAV.filter(n => (n.section || "General") === section).map((n) => {
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
                        collapsed && "justify-center px-0"
                      )}
                      title={collapsed ? n.label : undefined}
                    >
                      <n.icon className={cn("h-4 w-4 shrink-0", active ? "stroke-[2.5px]" : "stroke-[2px]")} />
                      {!collapsed && <span>{n.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="mt-4 pt-4 border-t border-border/40">
             <div className={cn("flex items-center gap-3 px-2 py-2 mb-2", collapsed && "justify-center px-0")}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-[12px] font-extrabold text-primary-foreground">
                  {getInitials(user?.name) || "L"}
                </div>
                {!collapsed && (
                  <div className="text-left min-w-0">
                    <p 
                      data-testid="sidebar-user-name"
                      className="text-[12px] font-bold leading-none text-foreground truncate"
                    >
                      {user?.name || "..."}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">{user?.email}</p>
                  </div>
                )}
              </div>
            <SignOutButton collapsed={collapsed} />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col h-svh overflow-hidden">
          {/* Header */}
          <header className="mb-2 flex items-center justify-between px-5 pt-6 md:px-10 md:pt-8">
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search global logistics…"
                className="h-11 w-full rounded-2xl bg-card pl-11 pr-4 text-sm font-medium shadow-soft outline-none ring-1 ring-border/60 transition focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-soft ring-1 ring-border/60 transition hover:bg-muted">
                <Bell className="h-4 w-4 text-foreground" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-card" />
              </button>
            </div>
          </header>
          
          <div className="flex-1 min-h-0 animate-fade-up px-5 py-6 md:px-10 md:py-8 has-[.h-full]:p-0 overflow-y-auto no-scrollbar">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SignOutButton({ collapsed }: { collapsed?: boolean }) {
  const { signOut } = useAuth();
  return (
    <button
      onClick={() => signOut()}
      className={cn(
        "inline-flex w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition hover:bg-muted/80 hover:text-foreground",
        collapsed && "justify-center"
      )}
    >
      <LogOut className="h-3.5 w-3.5" />
      {!collapsed && <span>Sign out</span>}
    </button>
  );
}
