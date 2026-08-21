import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/cravio/BottomNav";
import { APPS, appHead } from "@/lib/apps";

export const Route = createFileRoute("/app")({
  head: () => appHead(APPS.customer),
  component: AppLayout,
});

function AppLayout() {
  console.log("[AUTH_DEBUG] [CHECKPOINT: APP_ROUTE_MOUNTED] Mounting AppLayout");
  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex-1 pb-2">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
