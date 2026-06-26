import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/cravio/BottomNav";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex-1 pb-2">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
