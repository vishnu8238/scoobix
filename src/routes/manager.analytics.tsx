import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { useManager } from "@/lib/manager-api";
import { rangeDays, reportTables, useAnalytics } from "@/lib/analytics-api";
import { AnalyticsToolbar, EmptyState, InsightsCard, KpiGrid, Leaderboard, TrendChart } from "@/components/analytics/AnalyticsKit";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/manager/analytics")({
  head: () => ({
    meta: [
      { title: "My analytics · Scoobix Manager" },
      { name: "description", content: "Onboarding, verification, lead conversion and revenue performance for your assigned restaurants." },
      { property: "og:title", content: "My analytics · Scoobix Manager" },
      { property: "og:description", content: "Targets, conversion and revenue for your portfolio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagerAnalytics,
});

function ManagerAnalytics() {
  const { manager } = useManager();
  const [range, setRange] = useState(() => rangeDays(90, "90 days"));
  const { report, insights, loading, refresh } = useAnalytics("manager", manager?.id, range);

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="My analytics" subtitle={range.label} />
      <div className="space-y-5 px-4 pt-4">
        <AnalyticsToolbar
          range={range} onRange={setRange} onRefresh={refresh} loading={loading}
          tables={report ? reportTables(report) : []} filename="scoobix-manager-analytics"
        />
        {!manager?.id ? (
          <EmptyState label="No manager profile linked to this account" />
        ) : !report ? (
          <EmptyState label={loading ? "Loading analytics…" : "No portfolio data yet"} />
        ) : (
          <>
            <KpiGrid kpis={report.kpis} columns={2} />
            <InsightsCard insights={insights} />
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Onboarded", value: String(report.onboarded) },
                { label: "KYC done", value: `${report.verificationProgress}%` },
                { label: "Conversion", value: `${report.conversionRate}%` },
                { label: "Commission", value: formatPrice(report.commission) },
                { label: "Bonus", value: formatPrice(report.bonus) },
                { label: "Growth", value: `${report.growth}%` },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
                  <p className="mt-1 font-display text-base font-extrabold">{s.value}</p>
                </div>
              ))}
            </div>
            <TrendChart title="Restaurants going live" data={report.restaurantGrowth} kind="bar" />
            <Leaderboard title="Area performance" rows={report.regionPerformance} />
            <Leaderboard title="Lead pipeline" rows={report.pipeline} />
          </>
        )}
      </div>
    </div>
  );
}
