import { createFileRoute, redirect } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/app/login")({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/auth/login",
      search: { app: "customer", redirect: "/app" }
    });
  },
  component: () => null,
});
