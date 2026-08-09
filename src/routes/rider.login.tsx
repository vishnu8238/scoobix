import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/cravio/RoleGuard";

export const Route = createFileRoute("/rider/login")({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/auth/login",
      search: { app: "rider", redirect: "/rider" }
    });
  },
  component: () => null,
});
