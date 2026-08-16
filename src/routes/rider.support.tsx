import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";
import { SupportTickets } from "@/components/cravio/SupportTickets";

export const Route = createFileRoute("/rider/support")({
  head: () => ({
    meta: [
      { title: "Scoobix Rider · Support" },
      { name: "description", content: "Raise delivery, earnings or app tickets and track the support team's replies." },
      { property: "og:title", content: "Scoobix Rider · Support" },
      { property: "og:description", content: "Raise delivery, earnings or app tickets and track the support team's replies." },
    ],
  }),
  component: RiderSupport,
});

function RiderSupport() {
  return (
    <div className="w-full min-h-svh pb-8">
      <PageHeader title="Support" subtitle="Tickets & help" />
      <SupportTickets role="driver" intro="Trip problems, payouts or app issues — the rider support team replies here." />
    </div>
  );
}
