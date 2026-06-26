import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ShoppingBag, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrders } from "@/lib/stores";

export const Route = createFileRoute("/app/success")({
  head: () => ({ meta: [{ title: "Cravio · Payment successful" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  const navigate = useNavigate();
  const { orders } = useOrders();
  const latest = orders[0];

  return (
    <div className="min-h-svh px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-24 text-center">
      <div className="mx-auto flex max-w-sm flex-col items-center">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-primary-soft text-primary animate-fade-up">
          <CheckCircle2 className="h-14 w-14" strokeWidth={2.2} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">Payment successful</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {latest ? `Order ${latest.id} confirmed · ${latest.restaurantName}` : "Your order has been placed."}
        </p>

        <div className="mt-8 w-full space-y-3">
          {latest && (
            <Button onClick={() => navigate({ to: "/track/$orderId", params: { orderId: latest.id } })}
              className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow">
              <ReceiptText className="mr-2 h-4 w-4" /> Track order
            </Button>
          )}
          <Link to="/app" className="block">
            <Button variant="outline" className="h-12 w-full rounded-full">
              <ShoppingBag className="mr-2 h-4 w-4" /> Back to home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
