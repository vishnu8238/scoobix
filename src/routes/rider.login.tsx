import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/rider/login")({
  component: () => (
    <RoleGuard allow="rider">
      <div>This should not be reachable due to RoleGuard redirecting to /auth/login?app=rider</div>
    </RoleGuard>
  ),
});
