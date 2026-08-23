import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Bike, ClipboardList, Navigation, Map as MapIcon, Sparkles, Layers,
  Wallet, ShieldCheck, Star, LifeBuoy, Megaphone, Tag, Gift, Trash2,
  Loader2, Radio, AlertTriangle,
} from "lucide-react";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/logistics")({
  head: () => ({
    meta: [
      { title: "Logistics Control · Scoobix Master Admin" },
      { name: "description", content: "Unified Master Admin access to delivery partners, dispatch, live tracking, gigs, zones, payouts and rider support workflows." },
      { property: "og:title", content: "Logistics Control · Scoobix Master Admin" },
      { property: "og:description", content: "Unified Master Admin access to delivery partners, dispatch, live tracking, gigs, zones, payouts and rider support workflows." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLogisticsControl,
});

type Counts = Record<string, number>;

const ACTIVE_ORDER_EXCLUDED = ["DELIVERED", "CANCELLED"];
const PING_FRESH_MS = 15 * 60 * 1000;

function AdminLogisticsControl() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts>({});
  const [freshPings, setFreshPings] = useState(0);
  const version = useTableVersion([
    "drivers", "orders", "driver_tracking", "gigs", "rider_gig_enrollments",
    "logistics_zones", "subzones", "driver_payout_periods", "support_tickets",
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    const num = (rows: unknown[]) => rows.length;
    try {
      const [
        drivers, orders, tracking, gigs, enrollments, zones, subzones,
        payoutPeriods, kyc, loyalty, tickets, campaigns, coupons, referrals,
        zoneAssignments,
      ] = await Promise.all([
        listTable<any>("drivers", { limit: 200 }).catch(() => []),
        listTable<any>("orders", { order: "created_at.desc", limit: 200 }).catch(() => []),
        listTable<any>("driver_tracking", { limit: 200 }).catch(() => []),
        listTable<any>("gigs", { limit: 200 }).catch(() => []),
        listTable<any>("rider_gig_enrollments", { limit: 200 }).catch(() => []),
        listTable<any>("logistics_zones", { limit: 200 }).catch(() => []),
        listTable<any>("subzones", { limit: 200 }).catch(() => []),
        listTable<any>("driver_payout_periods", { limit: 200 }).catch(() => []),
        listTable<any>("restaurant_kyc", { limit: 200 }).catch(() => []),
        listTable<any>("loyalty_accounts", { limit: 200 }).catch(() => []),
        listTable<any>("support_tickets", { limit: 200 }).catch(() => []),
        listTable<any>("marketing_campaigns", { limit: 200 }).catch(() => []),
        listTable<any>("coupons", { limit: 200 }).catch(() => []),
        listTable<any>("referrals", { limit: 200 }).catch(() => []),
        listTable<any>("rider_zone_assignments", { limit: 200 }).catch(() => []),
      ]);

      const now = Date.now();
      const latestByDriver = new Map<string, any>();
      for (const row of tracking) {
        const id = String(row?.driver_id ?? "");
        if (!id) continue;
        latestByDriver.set(id, row);
      }
      let fresh = 0;
      for (const row of latestByDriver.values()) {
        const stamp = row?.updated_at ?? row?.created_at ?? row?.recorded_at;
        const lat = Number(row?.lat ?? row?.latitude);
        const lng = Number(row?.lng ?? row?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (!stamp) continue;
        if (now - new Date(String(stamp)).getTime() <= PING_FRESH_MS) fresh += 1;
      }
      setFreshPings(fresh);

      setCounts({
        drivers: num(drivers),
        activeOrders: orders.filter((o: any) => !ACTIVE_ORDER_EXCLUDED.includes(String(o?.status ?? ""))).length,
        unassignedOrders: orders.filter((o: any) => !o?.driver_id && !ACTIVE_ORDER_EXCLUDED.includes(String(o?.status ?? ""))).length,
        tracking: latestByDriver.size,
        gigs: num(gigs),
        enrollments: num(enrollments),
        zones: num(zones),
        subzones: num(subzones),
        payoutPeriods: num(payoutPeriods),
        kyc: num(kyc),
        loyalty: num(loyalty),
        tickets: tickets.filter((t: any) => !["closed", "resolved"].includes(String(t?.status ?? "").toLowerCase())).length,
        campaigns: num(campaigns),
        coupons: num(coupons),
        referrals: num(referrals),
        zoneAssignments: num(zoneAssignments),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [load, user, version]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-3xl bg-card p-16 text-sm text-muted-foreground shadow-card ring-1 ring-border/60">
        <Loader2 className="h-4 w-4 animate-spin" /> Preparing logistics control…
      </div>
    );
  }

  const groups: {
    title: string;
    description: string;
    items: { to: string; label: string; icon: any; metric?: string; note?: string }[];
  }[] = [
    {
      title: "Fleet & Delivery Partners",
      description: "Authoritative partner records, profiles and payout ledgers.",
      items: [
        { to: "/admin/drivers", label: "Delivery Partners & Driver Profiles", icon: Bike, metric: `${counts.drivers ?? 0} partners` },
        { to: "/admin/drivers", label: "Driver Payouts (profile ledger)", icon: Wallet, metric: `${counts.payoutPeriods ?? 0} payout periods` },
        { to: "/admin/verification", label: "KYC & Verification", icon: ShieldCheck, metric: `${counts.kyc ?? 0} documents` },
        { to: "/admin/drivers", label: "Karma / Loyalty", icon: Star, metric: `${counts.loyalty ?? 0} loyalty accounts` },
      ],
    },
    {
      title: "Dispatch & Live Operations",
      description: "Order flow, assignment and driver location signals.",
      items: [
        { to: "/admin/orders", label: "Orders & Order Tracking", icon: ClipboardList, metric: `${counts.activeOrders ?? 0} active` },
        { to: "/admin/dispatch", label: "Manual Dispatch & Assignment", icon: Navigation, metric: `${counts.unassignedOrders ?? 0} unassigned` },
        { to: "/admin/live", label: "Live Tracking Map", icon: MapIcon, metric: freshPings > 0 ? `${freshPings} live pings` : "No live locations" },
        { to: "/admin/operations", label: "Live Operations Console", icon: Radio },
      ],
    },
    {
      title: "Supply, Gigs & Coverage",
      description: "Gig capacity, rider enrollment history and zone coverage.",
      items: [
        { to: "/admin/gigs", label: "Gigs & Enrollment History", icon: Sparkles, metric: `${counts.gigs ?? 0} gigs · ${counts.enrollments ?? 0} enrollments` },
        { to: "/admin/zones", label: "Zones & Delivery Coverage", icon: MapIcon, metric: `${counts.zones ?? 0} zones · ${counts.zoneAssignments ?? 0} rider assignments` },
        { to: "/admin/subzones", label: "Subzones", icon: Layers, metric: `${counts.subzones ?? 0} subzones` },
      ],
    },
    {
      title: "Partner Support & Growth",
      description: "Tickets, offers and referral programmes serving the fleet.",
      items: [
        { to: "/admin/support", label: "Support Tickets", icon: LifeBuoy, metric: `${counts.tickets ?? 0} open` },
        { to: "/admin/campaigns", label: "Offers & Campaigns", icon: Megaphone, metric: `${counts.campaigns ?? 0} campaigns` },
        { to: "/admin/coupons", label: "Coupons & Promotions", icon: Tag, metric: `${counts.coupons ?? 0} coupons` },
        { to: "/admin/referrals", label: "Referrals", icon: Gift, metric: `${counts.referrals ?? 0} referrals` },
        { to: "/admin/security", label: "Account Deletion Requests", icon: Trash2 },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Logistics Control</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">Logistics control center</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every logistics workflow a Master Admin can operate here, without a separate Logistics sign-in. Counts read live from the platform database and show zero when there is nothing recorded.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-2xl bg-card px-4 py-2.5 text-sm font-bold shadow-soft ring-1 ring-border"
        >
          Refresh counts
        </button>
      </header>

      {loading && (
        <div className="flex items-center gap-2 rounded-3xl bg-card p-6 text-sm text-muted-foreground shadow-card ring-1 ring-border/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading live logistics counts…
        </div>
      )}

      {!loading && freshPings === 0 && (
        <div className="flex items-start gap-3 rounded-3xl border border-dashed border-border bg-card/60 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <div>
            <p className="text-sm font-bold">No live driver locations</p>
            <p className="text-xs text-muted-foreground">No recent driver location pings are recorded, so the live map has no positions to plot.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <h2 className="font-display text-xl font-extrabold">{g.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>
            <ul className="mt-4 space-y-2">
              {g.items.map((item) => (
                <li key={`${g.title}-${item.label}`}>
                  <Link
                    to={item.to}
                    className="flex items-center gap-3 rounded-2xl bg-muted/30 px-4 py-3 transition hover:bg-muted/60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <item.icon className="h-4 w-4" strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground">{item.label}</span>
                      {item.metric && (
                        <span className="block truncate text-[11px] font-medium text-muted-foreground">{item.metric}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="rounded-3xl border border-dashed border-border bg-card/60 p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-extrabold">Not available on this platform</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Attendance / shift clock-in and cash-on-delivery ledgers have no canonical data source, so they stay unavailable in driver profiles instead of showing placeholder panels.
          </p>
        </section>
      </div>
    </div>
  );
}
