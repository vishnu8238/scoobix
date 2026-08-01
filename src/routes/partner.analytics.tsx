import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { rangeDays, reportTables, useAnalytics } from "@/lib/analytics-api";
import {
  AnalyticsToolbar, DataTable, EmptyState, InsightsCard, KpiGrid, Leaderboard, TrendChart,
} from "@/components/analytics/AnalyticsKit";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/partner/analytics")({
  head: () => ({
    meta: [
      { title: "Sales analytics · Scoobix Partner" },
      { name: "description", content: "Live revenue, order volume, menu performance and customer retention for your restaurant." },
      { property: "og:title", content: "Sales analytics · Scoobix Partner" },
      { property: "og:description", content: "Revenue, peak hours, menu performance and ratings in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnerAnalytics,
});

function PartnerAnalytics() {
  const { restaurant } = usePartnerRestaurant();
  const [range, setRange] = useState(() => rangeDays(30, "30 days"));
  const { report, insights, loading, refresh } = useAnalytics("restaurant", restaurant?.id, range);

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Sales analytics" subtitle={range.label} />

      <div className="space-y-5 px-4 pt-4">
        <AnalyticsToolbar
          range={range} onRange={setRange} onRefresh={refresh} loading={loading}
          tables={report ? reportTables(report) : []} filename="scoobix-restaurant-analytics"
        />

        {!restaurant?.id ? (
          <EmptyState label="No restaurant linked to this account yet" />
        ) : !report ? (
          <EmptyState label={loading ? "Loading analytics…" : "No data yet"} />
        ) : (
          <>
            <KpiGrid kpis={report.kpis} columns={2} />
            <InsightsCard insights={insights} />

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Acceptance", value: `${report.acceptanceRate}%` },
                { label: "Cancellations", value: `${report.cancellationRate}%` },
                { label: "Avg fulfilment", value: `${Math.round(report.avgPrepMins)}m` },
                { label: "Repeat rate", value: `${report.repeatRate}%` },
                { label: "Commission paid", value: formatPrice(report.commissionPaid) },
                { label: "Payout", value: formatPrice(report.payout) },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
                  <p className="mt-1 font-display text-base font-extrabold">{s.value}</p>
                </div>
              ))}
            </div>

            <TrendChart title="Revenue · last 14 days" data={report.daily} money />
            <TrendChart title="Peak hours" data={report.peakHours} kind="bar" />
            <TrendChart title="Monthly revenue" data={report.monthly} kind="bar" money />
            <TrendChart title="Rating trend" data={report.reviewTrend} kind="line" />
            <Leaderboard title="Best sellers" rows={report.topItems} secondaryLabel="" />
            <Leaderboard title="Slow movers" rows={report.leastItems} />
            <DataTable
              title="Menu performance"
              columns={[{ key: "label", label: "Item" }, { key: "value", label: "Revenue" }]}
              rows={report.menuPerformance.map((r) => ({ label: r.label, value: formatPrice(r.value) }))}
            />
            <Leaderboard title="Coupon impact" rows={report.coupons} money />
            <Leaderboard title="Campaign performance" rows={report.campaigns} money secondaryLabel="uses" />
          </>
        )}
      </div>
    </div>
  );
}
