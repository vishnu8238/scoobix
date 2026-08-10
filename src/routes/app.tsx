import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/cravio/BottomNav";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { APPS, appHead } from "@/lib/apps";

export const Route = createFileRoute("/app")({
  head: () => appHead(APPS.customer),
  component: AppLayout,
});

function AppLayout() {
  console.log("[AUTH_DEBUG] AppLayout Mounting");
  return (
    <RoleGuard allow="customer">
      <div className="flex min-h-svh flex-col">
        <main className="flex-1 pb-2">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </RoleGuard>
  );
}

