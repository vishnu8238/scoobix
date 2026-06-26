import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, ShoppingBag, ReceiptText, User } from "lucide-react";
import { useCart } from "@/lib/stores";
import { cn } from "@/lib/format";

type Tab = { to: string; label: string; icon: typeof Home; exact?: boolean; badge?: boolean };
const tabs: Tab[] = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/search", label: "Search", icon: Search },
  { to: "/app/cart", label: "Cart", icon: ShoppingBag, badge: true },
  { to: "/app/orders", label: "Orders", icon: ReceiptText },
  { to: "/app/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { totals } = useCart();
  return (
    <nav className="sticky bottom-0 left-0 right-0 z-40 mt-auto">
      <div className="glass border-t border-border/60 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <ul className="grid grid-cols-5 gap-1">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] transition-all",
                    active ? "text-primary" : "text-muted-foreground/70 hover:text-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute -top-0.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                  <span className="relative grid h-9 w-9 place-items-center">
                    <Icon
                      className={cn("transition-all", active ? "h-[22px] w-[22px]" : "h-[20px] w-[20px]")}
                      strokeWidth={active ? 2.6 : 2}
                      fill={active && t.to === "/app" ? "currentColor" : "none"}
                    />
                    {t.badge && totals.itemCount > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-primary-foreground ring-2 ring-surface animate-fade-up">
                        {totals.itemCount}
                      </span>
                    )}
                  </span>
                  <span>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
