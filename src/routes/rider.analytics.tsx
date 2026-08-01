import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { useDriver } from "@/lib/driver-store";
import { rangeDays, reportTables, useAnalytics } from "@/lib/analytics-api";
import { AnalyticsToolbar, EmptyState, InsightsCard, KpiGrid, TrendChart } from "@/components/analytics/AnalyticsKit";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/rider/analytics")({
  head: () => ({
    meta: [
      { title: "My performance · Scoobix Rider" },
      { name: "description", content: "Deliveries, earnings, acceptance rate and incentive progress for your rider account." },
      { property: "og:title", content: "My performance · Scoobix Rider" },
      { property: "og:description", content: "Track deliveries, earnings and bonus eligibility." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RiderAnalytics,
});

function RiderAnalytics() {
  const { driver } = useDriver();
  const [range, setRange] = useState(() => rangeDays(30, "30 days"));
  const { report, insights, loading, refresh } = useAnalytics("rider", driver?.id, range);

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="My performance" subtitle={range.label} />
      <div className="space-y-5 px-4 pt-4">
        <AnalyticsToolbar
          range={range} onRange={setRange} onRefresh={refresh} loading={loading}
          tables={report ? reportTables(report) : []} filename="scoobix-rider-performance"
        />
        {!driver?.id ? (
          <EmptyState label="No rider profile linked to this account" />
        ) : !report ? (
          <EmptyState label={loading ? "Loading performance…" : "No deliveries yet"} />
        ) : (
          <>
            <KpiGrid kpis={report.kpis} columns={2} />
            <InsightsCard insights={insights} />
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Acceptance", value: `${report.acceptanceRate}%` },
                { label: "Completion", value: `${report.completionRate}%` },
                { label: "Online hours", value: `${report.onlineHours}h` },
                { label: "Distance", value: `${report.distanceKm} km` },
                { label: "COD held", value: formatPrice(report.pocketBalance) },
                { label: "Tips", value: formatPrice(report.tips) },
                { label: "Bonuses", value: formatPrice(report.bonuses) },
                { label: "Available", value: formatPrice(report.availableBalance) },
                { label: "Rating", value: report.rating ? report.rating.toFixed(1) : "—" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
                  <p className="mt-1 font-display text-base font-extrabold">{s.value}</p>
                </div>
              ))}
            </div>
            <TrendChart title="Deliveries · last 8 weeks" data={report.weekly} kind="bar" />
            <TrendChart title="Monthly earnings" data={report.monthly} money />
          </>
        )}
      </div>
    </div>
  );
}
