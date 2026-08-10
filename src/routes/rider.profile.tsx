import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/rider/profile")({
  component: RiderProfile,
});

function RiderProfile() {
  const { user } = useAuth();
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Rider Profile</h1>
      <p>Name: {user?.name}</p>
    </div>
  );
}
