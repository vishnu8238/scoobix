/**
 * Rider AI — route & traffic advice, earnings prediction, COD summary,
 * peak-hour planning and acceptance-rate coaching. All via the AI gateway.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { AiPanel, AiText } from "@/components/ai/AiPanel";
import { AiJson } from "@/components/ai/AiJson";
import { useAuth } from "@/lib/auth-store";
import { useDriver } from "@/lib/driver-store";
import { useAiTask } from "@/lib/ai/client";
import { listTable } from "@/lib/insforge-crud";

export const Route = createFileRoute("/rider/ai")({
  head: () => ({
    meta: [
      { title: "Scoobix Rider · AI Coach" },
      { name: "description", content: "Route advice, earnings forecasts, COD summary and peak-hour tips for Scoobix delivery riders." },
      { property: "og:title", content: "Scoobix Rider · AI Coach" },
      { property: "og:description", content: "Smarter routes, better earnings — AI guidance for every trip." },
    ],
  }),
  component: RiderAi,
});

type Trip = { id: string; status?: string; total?: number; payment_method?: string; created_at?: string };

function RiderAi() {
  const { user } = useAuth();
  const { driver } = useDriver() as any;
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    if (!driver?.id) return;
    void listTable<Trip>("orders", { driver_id: `eq.${driver.id}`, order: "-created_at", limit: 60 }).then(setTrips);
  }, [driver?.id]);

  const stats = useMemo(() => {
    const delivered = trips.filter((t) => (t.status ?? "").toUpperCase() === "DELIVERED");
    const cod = delivered.filter((t) => (t.payment_method ?? "").toLowerCase().includes("cod"));
    const today = new Date().toDateString();
    return {
      totalTrips: trips.length,
      delivered: delivered.length,
      cancelled: trips.filter((t) => (t.status ?? "").toUpperCase() === "CANCELLED").length,
      deliveredToday: delivered.filter((t) => t.created_at && new Date(t.created_at).toDateString() === today).length,
      codCollected: cod.reduce((s, t) => s + Number(t.total ?? 0), 0),
      codOrders: cod.length,
      hours: delivered.map((t) => (t.created_at ? new Date(t.created_at).getHours() : null)).filter((h) => h !== null),
      city: "Vadodara",
      now: new Date().toISOString(),
    };
  }, [trips]);

  const earnings = useAiTask<any>("earnings_predict", stats, { app: "rider", userId: user?.id });
  const cod = useAiTask<string>("cod_summary", stats, { app: "rider", userId: user?.id });
  const peak = useAiTask<any>("peak_hours", stats, { app: "rider", userId: user?.id });
  const acc = useAiTask<string>("acceptance_insights", stats, { app: "rider", userId: user?.id });
  const route = useAiTask<any>(
    "route_suggest",
    { city: "Vadodara", now: new Date().toISOString(), recentTrips: stats.totalTrips },
    { app: "rider", userId: user?.id },
  );

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="AI Coach" subtitle="Routes · earnings · peak hours" />
      <div className="space-y-4 px-4 py-4">
        <AiPanel title="Earnings prediction" app="rider" task="earnings_predict" userId={user?.id} loading={earnings.loading} res={earnings.res} onRefresh={earnings.refresh}>
          <AiJson data={earnings.data} />
        </AiPanel>
        <AiPanel title="Peak hours & zones today" app="rider" task="peak_hours" userId={user?.id} loading={peak.loading} res={peak.res} onRefresh={peak.refresh}>
          <AiJson data={peak.data?.slots ?? peak.data} />
        </AiPanel>
        <AiPanel title="Route & traffic advice" app="rider" task="route_suggest" userId={user?.id} loading={route.loading} res={route.res} onRefresh={route.refresh}>
          <AiJson data={route.data} />
        </AiPanel>
        <AiPanel title="COD collection summary" app="rider" task="cod_summary" userId={user?.id} loading={cod.loading} res={cod.res} onRefresh={cod.refresh}>
          <AiText text={typeof cod.data === "string" ? cod.data : ""} />
        </AiPanel>
        <AiPanel title="Acceptance rate insights" app="rider" task="acceptance_insights" userId={user?.id} loading={acc.loading} res={acc.res} onRefresh={acc.refresh}>
          <AiText text={typeof acc.data === "string" ? acc.data : ""} />
        </AiPanel>
      </div>
    </div>
  );
}
