import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Heart, Bell, MapPin, Tag, Clock, FileText, Shield, Sparkles, AlertOctagon, ShoppingBag, LogIn, LogOut, CheckCircle2, Utensils, Building2, Wallet, Gift , LifeBuoy , Crown }
from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

export const Route = createFileRoute("/app/more")({
  head: () => ({ meta: [{ title: "Scoobix · More" }] }),
  component: MoreHub,
});

const ITEMS = [
  { to: "/app/membership", icon: Crown,      label: "Scoobix Plus",          desc: "Membership, benefits & savings" },
  { to: "/app/wallet",     icon: Wallet,     label: "Scoobix Wallet",        desc: "Balance, cashback & refunds" },
  { to: "/app/referral",   icon: Gift,       label: "Invite & earn",         desc: "Share your code, earn credit" },
  { to: "/app/meal",       icon: Utensils,   label: "Scoobix Daily Meal",    desc: "Weekly & monthly meal plans" },
  { to: "/app/bulk",       icon: Building2,  label: "Corporate & Bulk",      desc: "Catering & office orders" },
  { to: "/app/location",   icon: MapPin,   label: "Delivery location",     desc: "Manage saved places" },
  { to: "/app/favorites",  icon: Heart,    label: "Favorites",             desc: "Restaurants & dishes you love" },
  { to: "/app/recent",     icon: Clock,    label: "Recently viewed",       desc: "Quick reorder & history" },
  { to: "/app/notifications", icon: Bell,  label: "Notifications",         desc: "Order updates and offers" },
  { to: "/app/coupons",    icon: Tag,      label: "Coupons & offers",      desc: "Active promo codes" },
  { to: "/app/cart",       icon: ShoppingBag, label: "Your cart",          desc: "Review items before checkout" },
  { to: "/app/support",    icon: LifeBuoy, label: "Help & support",        desc: "Raise a ticket, track replies" },
  { to: "/terms",          icon: FileText, label: "Terms of service",      desc: "Legal · last updated 2026" },
  { to: "/privacy",        icon: Shield,   label: "Privacy policy",        desc: "How we handle your data" },
] as const;

function MoreHub() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-svh pb-24">
      <PageHeader title="More" subtitle="Account, preferences & legal" />

      <ul className="mt-3 divide-y divide-border/60 rounded-3xl bg-card mx-4 shadow-soft ring-1 ring-border/60">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="flex items-center gap-3 px-4 py-3.5 transition active:bg-muted/40">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary"><i.icon className="h-5 w-5" strokeWidth={2.4} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{i.label}</div>
                <div className="truncate text-xs text-muted-foreground">{i.desc}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
        <li>
          {user ? (
            <button
              onClick={() => { signOut(); toast.success("Signed out"); navigate({ to: "/" }); }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-muted/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-100 text-rose-700"><LogOut className="h-5 w-5" strokeWidth={2.4} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">Sign out</div>
                <div className="truncate text-xs text-muted-foreground">{user.name} · {user.email}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-3 px-4 py-3.5 transition active:bg-muted/40">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary"><LogIn className="h-5 w-5" strokeWidth={2.4} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">Sign in</div>
                <div className="truncate text-xs text-muted-foreground">Customer, partner, rider or admin</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          )}
        </li>
      </ul>

      <p className="mt-6 px-6 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Scoobix v1.0 · Crave it. Get it.</p>
    </div>
  );
}
