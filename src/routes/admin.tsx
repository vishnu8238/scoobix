import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { 
  Tag, LayoutDashboard, Users, Store, Bike, ClipboardList, 
  CreditCard, BarChart3, Settings, Bell, Search, Sparkles, 
  Megaphone, Building2, Wallet, Gift, Compass, TrendingUp, 
  LifeBuoy, Copy, Gauge, ShieldCheck, Crown, Map as MapIcon, 
  Navigation, History, LogOut 
} from "lucide-react";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { APPS, appHead } from "@/lib/apps";
import { useAuth, getRequestedPortal } from "@/lib/auth-store";
import { getInitials } from "@/lib/identity-utils";

import { cn } from "@/lib/format";
import { warmAnalytics } from "@/lib/analytics-jobs";
import { useEffect } from "react";
import { AdminGuard } from "@/components/cravio/AdminGuard";

export const Route = createFileRoute("/admin")({
  head: () => appHead(APPS.admin),
  component: AdminLayoutGuard,
});

function AdminLayoutGuard() {
  return (
    <AdminGuard>
      <AdminLayout />
    </AdminGuard>
  );
}

const NAV: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/operations", label: "Live Operations", icon: Gauge },
  { to: "/admin/live", label: "Logistics Map", icon: MapIcon },
  { to: "/admin/cms", label: "CMS Studio", icon: Sparkles },
  { to: "/admin/access", label: "Access Management", icon: ShieldCheck },
  { to: "/admin/dispatch", label: "Manual Dispatch", icon: Navigation },
  { to: "/admin/gigs", label: "Gig Management", icon: Sparkles },
  { to: "/admin/audit", label: "Audit Logs", icon: History },
  { to: "/admin/users", label: "Users", icon: Users },

  { to: "/admin/restaurants", label: "Restaurants", icon: Store },
  { to: "/admin/managers", label: "Merchant Managers", icon: Building2 },
  { to: "/admin/verification", label: "Verification & KYC", icon: ShieldCheck },
  { to: "/admin/duplicates", label: "Duplicates & Transfers", icon: Copy },
  { to: "/admin/drivers", label: "Drivers", icon: Bike },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/zones", label: "Zones & Delivery", icon: MapIcon },
  { to: "/admin/subzones", label: "Subzones", icon: MapIcon },
  { to: "/admin/scratch-cards", label: "Scratch Cards", icon: Gift },

  { to: "/admin/campaigns", label: "Marketing Campaigns", icon: Megaphone },
  { to: "/admin/coupons", label: "Coupons & Promotions", icon: Tag },
  { to: "/admin/subscriptions", label: "Subscriptions & Plans", icon: Crown },
  { to: "/admin/ads", label: "Ads", icon: Megaphone },
  { to: "/admin/spotlight", label: "Spotlight", icon: Sparkles },
  { to: "/admin/discover", label: "Discover More", icon: Compass },
  { to: "/admin/trending", label: "Trending Now", icon: TrendingUp },
  { to: "/admin/bulk", label: "Bulk Orders", icon: Building2 },
  { to: "/admin/wallet", label: "Wallets", icon: Wallet },
  { to: "/admin/referrals", label: "Referrals", icon: Gift },

  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/support", label: "Support", icon: LifeBuoy },
  { to: "/admin/performance", label: "Infrastructure", icon: Gauge },
  { to: "/admin/security", label: "Security & Audit", icon: ShieldCheck },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayout() {
  const { user, loading, authState } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Heavy aggregation runs in the background, never during a user request.
  useEffect(() => { warmAnalytics(); }, []);

  const portal = getRequestedPortal();

  // Admission and auth redirects are handled strictly by AdminGuard/RoleGuard.
  // The redundant useEffect here was removed to prevent race conditions and loops.

  // Show nothing if unauthenticated to prevent layout flash before redirect
  if (!user && pathname !== "/login") {
    return null;
  }

  // Public login page is isolated from the protected shell.
  if (pathname === "/login") {
    return <Outlet />;
  }

  return (
    <div className="min-h-svh w-full bg-[radial-gradient(circle_at_top_left,_oklch(0.96_0.04_148_/_0.4),_oklch(0.99_0.005_120)_45%)] font-sans">
      <div className="mx-auto flex min-h-svh max-w-full">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-svh w-64 flex-col gap-1 border-r border-border/60 bg-card/60 p-5 backdrop-blur-md md:flex">
          <div className="mb-6 flex items-center gap-3">
            <ScoobixMark size={36} />
            <div>
              <p className="font-display text-lg font-extrabold leading-none tracking-tight text-foreground">Scoobix</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Master Admin</p>
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
        <main className="flex-1 flex flex-col h-svh overflow-hidden">
          {/* Mobile top */}
          <div className="mb-6 flex items-center justify-between md:hidden">
            <div className="flex items-center gap-2">
              <ScoobixMark size={28} />
              <p className="font-display text-base font-extrabold text-foreground">Admin</p>
            </div>
            <SignOutButton />
          </div>

          {/* Desktop top bar */}
          <header className="mb-8 hidden items-center justify-between md:flex px-5 pt-6 md:px-10 md:pt-8">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search users, orders, restaurants…"
                className="h-11 w-full rounded-2xl bg-card pl-11 pr-4 text-sm font-medium shadow-soft outline-none ring-1 ring-border/60 transition focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-soft ring-1 ring-border/60">
                <Bell className="h-4 w-4 text-foreground" />
                {/* Notification indicator logic could go here */}
              </button>
              <div className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2 shadow-soft ring-1 ring-border/60">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-[12px] font-extrabold text-primary-foreground">
                  {getInitials(user?.name) || "A"}
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-bold leading-none text-foreground">{user?.name || "Administrator"}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{user?.role === 'admin' ? 'Master Admin' : 'Operator'}</p>
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

          <div className="flex-1 min-h-0 animate-fade-up px-5 py-6 md:px-10 md:py-8 has-[.h-full]:p-0">
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
