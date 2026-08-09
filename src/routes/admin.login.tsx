import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/admin/login")({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/auth/login",
      search: { app: "admin", redirect: "/admin" }
    });
  },
  component: () => null,
});
