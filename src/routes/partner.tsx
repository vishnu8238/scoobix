import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, UtensilsCrossed, BarChart3, MoreHorizontal } from "lucide-react";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { APPS, appHead } from "@/lib/apps";
import { cn } from "@/lib/format";
import { usePartnerRestaurant } from "@/lib/partner-store";

export const Route = createFileRoute("/partner")({
  head: () => appHead(APPS.partner),
  component: PartnerLayout,
});

/** Exactly five primary tabs — everything else lives in the More hub. */
const NAV: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/partner", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/partner/orders", label: "Orders", icon: ClipboardList },
  { to: "/partner/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/partner/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/partner/more", label: "More", icon: MoreHorizontal },
];

const PRIMARY = new Set(NAV.map((n) => n.to));

function PartnerLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Resolves the signed-in owner's restaurant and publishes it app-wide.
  usePartnerRestaurant();

  // Secondary pages are reached through More, so keep that tab highlighted.
  const secondary = pathname.startsWith("/partner/") && !PRIMARY.has(pathname);

  return (
    <RoleGuard allow="partner" transitionLabel="Accessing Merchant Portal..." requireAccess>
      <div className="relative pb-24">
        <Outlet />
        <nav className="glass fixed bottom-3 left-1/2 z-40 flex w-[min(440px,calc(100%-1.5rem))] -translate-x-1/2 items-center justify-between rounded-full px-2 py-2 shadow-float">
          {NAV.map((n) => {
            const active = n.to === "/partner/more"
              ? pathname === "/partner/more" || secondary
              : n.exact
                ? pathname === n.to
                : pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-2 text-[10px] font-bold uppercase tracking-wider transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <n.icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.6 : 2} />
                <span className="w-full truncate text-center">{n.label}</span>
                {active && <span className="absolute -top-0.5 h-1 w-1 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </RoleGuard>
  );
}
