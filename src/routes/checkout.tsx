import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCart } from "@/lib/stores";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/cravio/EmptyState";
import { useEffect } from "react";

export const Route = createFileRoute("/checkout")({
  component: CheckoutRedirect,
});

function CheckoutRedirect() {
  const navigate = useNavigate();
  const { items } = useCart();

  useEffect(() => {
    if (items.length > 0) {
      const search = new URLSearchParams(window.location.search).toString();
      const to = search ? `/app/checkout?${search}` : "/app/checkout";
      window.location.replace(to);
    }
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="min-h-svh bg-background">
        <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <button onClick={() => navigate({ to: "/app" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </header>
        <EmptyState
          icon={<ShoppingBag className="h-9 w-9" />}
          title="Your cart is empty"
          description="Add dishes from any restaurant to get started."
          action={{ label: "Browse restaurants", to: "/app" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-svh flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
