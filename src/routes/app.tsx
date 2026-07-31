import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomNav } from "@/components/cravio/BottomNav";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { APPS, appHead } from "@/lib/apps";
import { AiAssistant } from "@/components/ai/AiAssistant";

export const Route = createFileRoute("/app")({
  head: () => appHead(APPS.customer),
  component: AppLayout,
});

function AppLayout() {
  return (
    <RoleGuard allow="customer">
      <div className="flex min-h-svh flex-col">
        <main className="flex-1 pb-2">
          <Outlet />
        </main>
        <AiAssistant
          app="customer"
          task="food_assistant"
          title="Scoobix AI"
          greeting="Hungry? Ask me what to eat, what's trending, or the best offers right now."
          suggestions={["What should I eat today?", "Suggest a healthy dinner", "Show best offers", "What's trending?"]}
          supportHref="/app/support"
        />
        <BottomNav />
      </div>
    </RoleGuard>
  );
}

