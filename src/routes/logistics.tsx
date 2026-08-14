import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { 
  Tag, LayoutDashboard, Users, Store, Bike, ClipboardList, 
  CreditCard, BarChart3, Settings, Bell, Search, Sparkles, 
  Megaphone, Building2, Wallet, Gift, Compass, TrendingUp, 
  LifeBuoy, Copy, Gauge, ShieldCheck, Crown, Map as MapIcon, 
  Navigation, History, LogOut 
} from "lucide-react";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { useAuth } from "@/lib/auth-store";
import { APPS, appHead } from "@/lib/apps";
import { cn } from "@/lib/format";
import { ScoobixMark } from "@/components/cravio/ScoobixLogo";
import { getInitials } from "@/lib/identity-utils";

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
  const { user } = useAuth();
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

          <div className="mt-4 pt-4 border-t border-border/40">
             <div className="flex items-center gap-3 px-2 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-[12px] font-extrabold text-primary-foreground">
                  {getInitials(user?.name)}
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[12px] font-bold leading-none text-foreground truncate">{user?.name || "Logistics Operator"}</p>
                </div>
              </div>
            <SignOutButton />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col h-svh overflow-hidden">
          {/* Header */}
          <header className="mb-2 flex items-center justify-between px-5 pt-6 md:px-10 md:pt-8">
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search logistics…"
                className="h-11 w-full rounded-2xl bg-card pl-11 pr-4 text-sm font-medium shadow-soft outline-none ring-1 ring-border/60 transition focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-card shadow-soft ring-1 ring-border/60">
                <Bell className="h-4 w-4 text-foreground" />
              </button>
            </div>
          </header>
          
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
      className="inline-flex w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </button>
  );
}
