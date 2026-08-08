import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/partner/login")({
  component: () => (
    <RoleGuard allow="partner">
      <div>This should not be reachable due to RoleGuard redirecting to /auth/login?app=partner</div>
    </RoleGuard>
  ),
});
