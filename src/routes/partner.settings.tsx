import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/partner/settings")({
  component: PartnerSettings,
});

function PartnerSettings() {
  const { user } = useAuth();
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Partner Settings</h1>
      <p>Profile: {user?.name}</p>
    </div>
  );
}
