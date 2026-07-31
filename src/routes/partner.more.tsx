import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight, Store, Clock, Compass, Tag, Megaphone, CreditCard, FileText, LifeBuoy, Settings,
  LogOut, Sparkles, Layers, Bell, Utensils, Building2, Shield, GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { useAuth } from "@/lib/auth-store";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { RestaurantIdBadge } from "@/components/cravio/RestaurantIdBadge";
import { RelationshipManagerCard } from "@/components/cravio/RelationshipManagerCard";

export const Route = createFileRoute("/partner/more")({
  head: () => ({ meta: [{ title: "Scoobix Partner · More" }] }),
  component: PartnerMore,
});

type Item = { to: string; icon: any; label: string; desc: string };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Restaurant",
    items: [
      { to: "/partner/profile",      icon: Store,     label: "Profile",           desc: "Restaurant details & gallery" },
      { to: "/partner/hours",        icon: Clock,     label: "Restaurant hours",  desc: "When you accept orders" },
      { to: "/partner/collections",  icon: Compass,   label: "Collections",       desc: "Curated listing requests" },
      { to: "/partner/addons",       icon: Layers,    label: "Add-ons & variants",desc: "Sizes, toppings, choices" },
      { to: "/partner/branches",     icon: GitBranch, label: "Branches & ownership", desc: "Outlets, duplicate checks, transfers" },
    ],
  },
  {
    title: "Growth",
    items: [
      { to: "/partner/coupons",      icon: Tag,       label: "Coupons",           desc: "Offers for your customers" },
      { to: "/partner/ads",          icon: Megaphone, label: "Advertisements",    desc: "Sponsored placements" },
      { to: "/partner/subscription", icon: CreditCard,label: "Subscription",      desc: "Your Scoobix plan" },
      { to: "/partner/meals",        icon: Utensils,  label: "Meal plans",        desc: "Daily meal subscriptions" },
      { to: "/partner/bulk",         icon: Building2, label: "Bulk orders",       desc: "Corporate & catering" },
    ],
  },
  {
    title: "Money & help",
    items: [
      { to: "/partner/invoice",       icon: FileText,  label: "Invoices",         desc: "Tax breakdowns, payouts" },
      { to: "/partner/notifications", icon: Bell,      label: "Order alerts",     desc: "Accept · reject with reason" },
      { to: "/partner/support",       icon: LifeBuoy,  label: "Support",          desc: "Raise & track tickets" },
      { to: "/partner/settings",      icon: Settings,  label: "Settings",         desc: "Store controls & account" },
    ],
  },
  {
    title: "Legal",
    items: [
      { to: "/partner/onboarding", icon: Sparkles, label: "Onboarding",     desc: "Get listed in 4 steps" },
      { to: "/terms",              icon: FileText, label: "Partner terms",  desc: "Legal" },
      { to: "/privacy",            icon: Shield,   label: "Privacy policy", desc: "Data handling" },
    ],
  },
];

function PartnerMore() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { restaurant } = usePartnerRestaurant();

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-28">
      <PageHeader title="More" subtitle="Setup, growth & operations" />

      <section className="mx-4 mt-4 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <p className="font-display text-lg font-extrabold">{restaurant?.name ?? user?.name ?? "Your restaurant"}</p>
        <div className="mt-2"><RestaurantIdBadge restaurant={restaurant} /></div>
      </section>

      <div className="mx-4 mt-4">
        <RelationshipManagerCard restaurant={restaurant} />
      </div>

      {SECTIONS.map((s) => (
        <section key={s.title} className="mt-5">
          <p className="px-6 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{s.title}</p>
          <ul className="mx-4 mt-2 divide-y divide-border/60 rounded-3xl bg-card shadow-soft ring-1 ring-border/60">
            {s.items.map((i) => (
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
          </ul>
        </section>
      ))}

      <button
        onClick={() => { signOut(); toast.success("Signed out"); navigate({ to: "/auth/login" }); }}
        className="mx-4 mt-5 flex w-[calc(100%-2rem)] items-center gap-3 rounded-3xl bg-card px-4 py-3.5 text-left shadow-soft ring-1 ring-border/60 transition active:bg-muted/40"
      >
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-100 text-rose-700"><LogOut className="h-5 w-5" strokeWidth={2.4} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Logout</div>
          <div className="truncate text-xs text-muted-foreground">{user?.email ?? "Signed out"}</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
