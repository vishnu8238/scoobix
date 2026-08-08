import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/app/login")({
  component: () => (
    <RoleGuard allow="customer">
      <div>This should not be reachable due to RoleGuard redirecting to /auth/login?app=customer</div>
    </RoleGuard>
  ),
});
