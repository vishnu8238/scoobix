import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rider/pocket")({
  loader: () => {
    throw redirect({ to: "/rider/earnings", replace: true });
  },
});
