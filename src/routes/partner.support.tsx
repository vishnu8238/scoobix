import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";
import { SupportTickets } from "@/components/cravio/SupportTickets";

export const Route = createFileRoute("/partner/support")({
  head: () => ({
    meta: [
      { title: "Scoobix Partner · Support" },
      { name: "description", content: "Raise and track restaurant support tickets with the Scoobix team." },
      { property: "og:title", content: "Scoobix Partner · Support" },
      { property: "og:description", content: "Raise and track restaurant support tickets with the Scoobix team." },
    ],
  }),
  component: PartnerSupport,
});

function PartnerSupport() {
  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Support" subtitle="Tickets & help" />
      <SupportTickets role="restaurant" intro="Payouts, orders, menu or app issues — our partner team replies here." />
    </div>
  );
}
