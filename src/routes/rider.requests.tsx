import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rider/requests")({
  beforeLoad: () => {
    throw redirect({
      to: "/rider/gigs",
      replace: true,
    });
  },
});
