import { createFileRoute, redirect } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/partner/login")({
  beforeLoad: ({ location }) => {
    // If we land on /partner/login, immediately redirect to the central login with context
    // This prevents the RoleGuard within this route from triggering a generic redirect loop
    throw redirect({
      to: "/auth/login",
      search: { app: "partner", redirect: "/partner" }
    });
  },
  component: () => null,
});
