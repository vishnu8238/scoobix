import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, UtensilsCrossed, Store } from "lucide-react";
import { RoleSwitch } from "@/components/cravio/RoleSwitch";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/partner")({
  head: () => ({ meta: [{ title: "Cravio Partner · Restaurant" }] }),
  component: PartnerLayout,
});

const NAV: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/partner", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/partner/orders", label: "Orders", icon: ClipboardList },
  { to: "/partner/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/partner/profile", label: "Profile", icon: Store },
];

function PartnerLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="relative pb-24">
      <Outlet />
      <nav className="glass fixed bottom-3 left-1/2 z-40 flex w-[min(440px,calc(100%-1.5rem))] -translate-x-1/2 items-center justify-between rounded-full px-2 py-2 shadow-float">
        {NAV.map((n) => {
          const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <n.icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2} />
              {n.label}
              {active && <span className="absolute -top-0.5 h-1 w-1 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>
      <RoleSwitch label="Switch role" />
    </div>
  );
}
