import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Tag, LayoutDashboard, Users, Store, Bike, ClipboardList, CreditCard, BarChart3, Settings, Bell, Search, Sparkles, Megaphone, Building2, Wallet, Gift, Compass, TrendingUp, LifeBuoy, Copy, Gauge, ShieldCheck , Crown, Map as MapIcon } from "lucide-react";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { APPS, appHead } from "@/lib/apps";
import { useAuth } from "@/lib/auth-store";
import { LogOut } from "lucide-react";
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Heavy aggregation runs in the background, never during a user request.
  useEffect(() => { warmAnalytics(); }, []);

  // Public login page is isolated from the protected shell.
  if (pathname === "/admin/login") {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-svh bg-zinc-950 font-sans text-zinc-200">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[280px] flex-col border-r border-zinc-900 bg-zinc-950 md:flex">
        <div className="flex h-20 items-center gap-3 px-8">
          <ScoobixMark size={32} />
          <div className="flex flex-col">
            <span className="font-display text-lg font-black tracking-tight text-white uppercase">Scoobix</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500">Master Admin</span>
          </div>
        </div>

        <nav className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8 pt-2">
          <div className="space-y-1">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "group flex items-center gap-3.5 rounded-2xl px-4 py-3 text-[13px] font-bold transition-all duration-200",
                    active
                      ? "bg-zinc-100 text-black shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                      : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                  )}
                >
                  <n.icon className={cn("h-[18px] w-[18px]", active ? "text-black" : "text-zinc-600 group-hover:text-zinc-400")} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-zinc-900 p-6">
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:pl-[280px]">
        <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-zinc-900 bg-zinc-950/80 px-8 backdrop-blur-xl">
          <div className="flex-1 max-w-xl">
            <div className="group relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" />
              <input
                type="text"
                placeholder="Search global records..."
                className="h-11 w-full rounded-2xl border border-zinc-900 bg-zinc-900/50 pl-11 pr-4 text-[13px] font-medium text-zinc-200 placeholder:text-zinc-600 outline-none transition-all focus:border-zinc-800 focus:bg-zinc-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-900 bg-zinc-900/50 text-zinc-400 hover:text-white transition-colors">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-3.5 top-3.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
            <div className="flex items-center gap-3 rounded-2xl border border-zinc-900 bg-zinc-900/50 p-1.5 pl-3">
              <div className="flex flex-col text-right">
                <span className="text-[11px] font-bold text-white">Anika D.</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Operator</span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-[11px] font-black text-black">AD</div>
            </div>
          </div>
        </header>

        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button
      onClick={() => signOut()}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[13px] font-bold text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-white"
    >
      <LogOut className="h-[18px] w-[18px]" />
      Sign Out
    </button>
  );
}
