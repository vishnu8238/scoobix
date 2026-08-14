import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { rangeDays, reportTables, useAnalytics } from "@/lib/analytics-api";
import {
  AnalyticsToolbar, EmptyState, Heatmap, InsightsCard, KpiGrid, Leaderboard, TrendChart,
} from "@/components/analytics/AnalyticsKit";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/logistics/reports")({
  head: () => ({
    meta: [
      { title: "Logistics Intelligence · Scoobix" },
      { name: "description", content: "Platform revenue, orders, city performance, SLA health and demand forecasting for Scoobix." },
    ],
  }),
  component: LogisticsReports,
});

function LogisticsReports() {
  const [range, setRange] = useState(() => rangeDays(30, "30 days"));
  const { report, insights, loading, refresh } = useAnalytics("admin", "platform", range);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Reports</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Business intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live platform analytics · {range.label}</p>
        </div>
      </header>

      <AnalyticsToolbar
        range={range} onRange={setRange} onRefresh={refresh} loading={loading}
        tables={report ? reportTables(report) : []} filename="scoobix-logistics-report"
      />

      {!report ? (
        <EmptyState label={loading ? "Aggregating platform data…" : "No report data available for this selection."} />
      ) : (
        <>
          <KpiGrid kpis={report.kpis} />
          <InsightsCard insights={insights} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Subscription revenue", value: formatPrice(report.subscriptionRevenue) },
              { label: "Coupon discount", value: formatPrice(report.couponDiscount) },
              { label: "Wallet liability", value: formatPrice(report.walletBalance) },
              { label: "Active restaurants", value: String(report.activeRestaurants) },
              { label: "Active riders", value: String(report.activeRiders) },
              { label: "Active managers", value: String(report.activeManagers) },
              { label: "Cancellation rate", value: `${report.cancellationRate}%` },
              { label: "Avg delivery", value: `${Math.round(report.avgDeliveryMins)} min` },
              { label: "Open tickets", value: String(report.tickets.open) },
              { label: "SLA breaches", value: String(report.tickets.breached) },
              { label: "Referrals", value: String(report.referrals) },
              { label: "Peak hour", value: `${String(report.peakHour).padStart(2, "0")}:00` },
            ].map((s) => (
              <div key={s.label} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{s.label}</p>
                <p className="mt-2 font-display text-xl font-extrabold">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TrendChart title="Daily revenue" data={report.daily} money />
            <TrendChart title="Weekly revenue" data={report.weekly} kind="bar" money />
            <TrendChart title="Monthly revenue" data={report.monthly} kind="bar" money />
            <TrendChart title="Revenue forecast · next 3 months" data={report.forecast} kind="line" money />
            <TrendChart title="Orders by hour" data={report.hourly} kind="bar" />
            <TrendChart title="Restaurants going live" data={report.restaurantGrowth} kind="bar" />
          </div>

          <Heatmap title="Demand heatmap" data={report.heatmap} />

          <div className="grid gap-6 lg:grid-cols-3">
            <Leaderboard title="Top restaurants" rows={report.topRestaurants} money />
            <Leaderboard title="City performance" rows={report.cityPerformance} money />
            <Leaderboard title="Top riders" rows={report.topRiders} />
          </div>

          <Leaderboard title="Risk & fraud signals" rows={report.fraudReports} />
        </>
      )}
    </div>
  );
}
