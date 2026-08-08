import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/manager/login")({
  component: () => (
    <RoleGuard allow="manager">
      <div>This should not be reachable due to RoleGuard redirecting to /auth/login?app=manager</div>
    </RoleGuard>
  ),
});
