import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";
import { SupportTickets } from "@/components/cravio/SupportTickets";

export const Route = createFileRoute("/app/support")({
  head: () => ({
    meta: [
      { title: "Scoobix · Help & Support" },
      { name: "description", content: "Raise a support ticket about an order, refund or payment and track replies." },
      { property: "og:title", content: "Scoobix · Help & Support" },
      { property: "og:description", content: "Raise a support ticket about an order, refund or payment and track replies." },
    ],
  }),
  component: CustomerSupport,
});

function CustomerSupport() {
  return (
    <div className="min-h-svh pb-24">
      <PageHeader title="Help & support" subtitle="Tickets & replies" />
      <SupportTickets role="customer" intro="Order issues, refunds, payments or account help — we reply inside the ticket." />
    </div>
  );
}
