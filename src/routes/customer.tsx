import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/customer")({
  component: CustomerRedirect,
});

function CustomerRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    // Deterministically redirect /customer to the canonical /app route
    navigate({ to: "/app", replace: true });
  }, [navigate]);

  return null;
}
