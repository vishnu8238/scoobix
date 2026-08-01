import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { useAuth } from "@/lib/auth-store";
import { rangeDays, reportTables, useAnalytics } from "@/lib/analytics-api";
import {
  AnalyticsToolbar, EmptyState, Heatmap, InsightsCard, KpiGrid, Leaderboard, TrendChart,
} from "@/components/analytics/AnalyticsKit";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/app/insights")({
  head: () => ({
    meta: [
      { title: "Your food insights · Scoobix" },
      { name: "description", content: "See your Scoobix ordering habits, favourite restaurants, dishes and total savings." },
      { property: "og:title", content: "Your food insights · Scoobix" },
      { property: "og:description", content: "Spending, savings and ordering trends from your Scoobix account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerInsights,
});

function CustomerInsights() {
  const { user } = useAuth();
  const [range, setRange] = useState(() => rangeDays(90, "90 days"));
  const { report, insights, loading, refresh } = useAnalytics("customer", user?.id, range);

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Your insights" subtitle={range.label} />

      <div className="space-y-5 px-4 pt-4">
        <AnalyticsToolbar
          range={range} onRange={setRange} onRefresh={refresh} loading={loading}
          tables={report ? reportTables(report) : []} filename="scoobix-my-insights"
        />

        {!user?.id ? (
          <EmptyState label="Sign in to see your insights" />
        ) : !report ? (
          <EmptyState label={loading ? "Crunching your orders…" : "No orders yet"} />
        ) : (
          <>
            <KpiGrid kpis={report.kpis} columns={2} />
            <InsightsCard insights={insights} />

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Coupon savings", value: formatPrice(report.couponSavings) },
                { label: "Wallet used", value: formatPrice(report.walletUsed) },
                { label: "Points earned", value: String(report.pointsEarned) },
                { label: "Referral earnings", value: formatPrice(report.referralEarnings) },
                { label: "Plus savings", value: formatPrice(report.membershipSavings) },
                { label: "Cancelled", value: String(report.cancelled) },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
                  <p className="mt-1 font-display text-base font-extrabold">{s.value}</p>
                </div>
              ))}
            </div>

            <TrendChart title="Orders per month" data={report.monthly} kind="bar" />
            <TrendChart title="Spending by year" data={report.yearly} kind="line" money />
            <Leaderboard title="Favourite restaurants" rows={report.favoriteRestaurants} secondaryLabel="" />
            <Leaderboard title="Most ordered dishes" rows={report.favoriteFoods} />
            <Leaderboard title="Top categories" rows={report.favoriteCategories} />
            <Heatmap title="When you order" data={report.heatmap} />
          </>
        )}
      </div>
    </div>
  );
}
