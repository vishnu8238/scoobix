import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { 
  Tag, LayoutDashboard, Users, Store, Bike, ClipboardList, 
  CreditCard, BarChart3, Settings, Bell, Search, Sparkles, 
  Megaphone, Building2, Wallet, Gift, Compass, TrendingUp, 
  LifeBuoy, Copy, Gauge, ShieldCheck, Crown, Map as MapIcon, 
  Navigation, History, LogOut 
} from "lucide-react";
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
  { to: "/logistics/operations", label: "Live Operations", icon: Gauge },
  { to: "/logistics/live", label: "Logistics Map", icon: MapIcon },
  { to: "/logistics/cms", label: "CMS Studio", icon: Sparkles },
  { to: "/logistics/access", label: "Access Management", icon: ShieldCheck },
  { to: "/logistics/dispatch", label: "Manual Dispatch", icon: Navigation },
  { to: "/logistics/gigs", label: "Gig Management", icon: Sparkles },
  { to: "/logistics/audit", label: "Audit Logs", icon: History },
  { to: "/logistics/users", label: "Users", icon: Users },

  { to: "/logistics/restaurants", label: "Restaurants", icon: Store },
  { to: "/logistics/managers", label: "Merchant Managers", icon: Building2 },
  { to: "/logistics/verification", label: "Verification & KYC", icon: ShieldCheck },
  { to: "/logistics/duplicates", label: "Duplicates & Transfers", icon: Copy },
  { to: "/logistics/drivers", label: "Drivers", icon: Bike },
  { to: "/logistics/orders", label: "Orders", icon: ClipboardList },
  { to: "/logistics/zones", label: "Zones & Delivery", icon: MapIcon },
  { to: "/logistics/subzones", label: "Subzones", icon: MapIcon },
  { to: "/logistics/scratch-cards", label: "Scratch Cards", icon: Gift },

  { to: "/logistics/campaigns", label: "Marketing Campaigns", icon: Megaphone },
  { to: "/logistics/coupons", label: "Coupons & Promotions", icon: Tag },
  { to: "/logistics/subscriptions", label: "Subscriptions & Plans", icon: Crown },
  { to: "/logistics/ads", label: "Ads", icon: Megaphone },
  { to: "/logistics/spotlight", label: "Spotlight", icon: Sparkles },
  { to: "/logistics/discover", label: "Discover More", icon: Compass },
  { to: "/logistics/trending", label: "Trending Now", icon: TrendingUp },
  { to: "/logistics/bulk", label: "Bulk Orders", icon: Building2 },
  { to: "/logistics/wallet", label: "Wallets", icon: Wallet },
  { to: "/logistics/referrals", label: "Referrals", icon: Gift },

  { to: "/logistics/payments", label: "Payments", icon: CreditCard },
  { to: "/logistics/reports", label: "Reports", icon: BarChart3 },
  { to: "/logistics/support", label: "Support", icon: LifeBuoy },
  { to: "/logistics/performance", label: "Infrastructure", icon: Gauge },
  { to: "/logistics/security", label: "Security & Audit", icon: ShieldCheck },
  { to: "/logistics/settings", label: "Settings", icon: Settings },
];

function LogisticsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-svh w-full bg-[radial-gradient(circle_at_top_left,_oklch(0.96_0.04_148_/_0.4),_oklch(0.99_0.005_120)_45%)] font-sans">
      <div className="mx-auto flex min-h-svh max-w-full">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-svh w-64 flex-col gap-1 border-r border-border/60 bg-card/60 p-5 backdrop-blur-md md:flex">
          <div className="mb-6 flex items-center gap-3">
            <ScoobixMark size={36} />
            <div>
              <p className="font-display text-lg font-extrabold leading-none tracking-tight text-foreground">Scoobix</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Logistics</p>
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
        </aside>

        {/* Main content */}
        <main className="flex-1 px-5 py-6 md:px-10 md:py-8">
          <div className="animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
