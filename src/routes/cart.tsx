import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCart } from "@/lib/stores";
import { useEffect } from "react";

export const Route = createFileRoute("/cart")({
  component: CartRedirect,
});

function CartRedirect() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const search = new URLSearchParams(window.location.search).toString();
    const to = search ? `/app/cart?${search}` : "/app/cart";
    window.location.replace(to);
  }, []);

  return (
    <div className="min-h-svh flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
