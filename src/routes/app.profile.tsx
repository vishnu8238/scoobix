import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-store";
import { PageHeader } from "@/components/cravio/PageHeader";
import { getInitials } from "@/lib/identity-utils";

export const Route = createFileRoute("/app/profile")({
  component: AppProfile,
});

function AppProfile() {
  const { user } = useAuth();
  return (
    <div className="pb-20">
      <PageHeader title="Profile" back />
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100">
          <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 font-bold text-xl uppercase">
            {getInitials(user?.name)}
          </div>
          <div>
            <h2 className="text-lg font-bold">{user?.name || "User"}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
