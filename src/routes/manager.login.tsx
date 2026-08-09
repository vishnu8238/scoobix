import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/manager/login")({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/auth/login",
      search: { app: "manager", redirect: "/manager" }
    });
  },
  component: () => null,
});
