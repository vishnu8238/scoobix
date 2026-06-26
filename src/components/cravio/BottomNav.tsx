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
      <div className="glass border-t border-border/60 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <ul className="grid grid-cols-5 gap-1">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-all",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn(
                    "relative grid h-9 w-12 place-items-center rounded-full transition-all",
                    active && "bg-primary-soft",
                  )}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
                    {t.badge && totals.itemCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-soft animate-fade-up">
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
