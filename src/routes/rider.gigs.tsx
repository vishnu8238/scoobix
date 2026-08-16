import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rider/gigs")({
  loader: () => {
    throw redirect({ to: "/rider/requests", replace: true });
  },
});
