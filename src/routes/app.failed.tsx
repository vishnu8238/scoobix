import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertOctagon } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { ErrorState } from "@/components/cravio/ErrorState";

export const Route = createFileRoute("/app/failed")({
  head: () => ({ meta: [{ title: "Cravio · Order failed" }] }),
  component: FailedPage,
});

function FailedPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-svh">
      <PageHeader title="Order status" />
      <ErrorState
        icon={<AlertOctagon className="h-9 w-9" />}
        title="Order couldn't be placed"
        description="Your card was declined. No charges were made. Try a different payment method or contact support."
        action={{ label: "Try again", onClick: () => navigate({ to: "/app/checkout" }) }}
      />
      <div className="mx-auto mt-4 max-w-sm px-6 text-center">
        <button onClick={() => navigate({ to: "/app" })} className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Back to home</button>
      </div>
    </div>
  );
}
