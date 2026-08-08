import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/admin/login")({
  component: () => (
    <RoleGuard allow="admin">
      <div>This should not be reachable due to RoleGuard redirecting to /auth/login?app=admin</div>
    </RoleGuard>
  ),
});
