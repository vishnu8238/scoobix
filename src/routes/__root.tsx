import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import { CravioProviders } from "@/lib/stores";
import { PhoneShell } from "@/components/cravio/PhoneShell";
import { Toaster } from "@/components/ui/sonner";
import { CartConflictDialog } from "@/components/cravio/CartConflictDialog";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#28a156" },
      { title: "Cravio — Crave it. Get it." },
      { name: "description", content: "Premium food delivery. Fresh meals from the best restaurants near you, fast." },
      { property: "og:title", content: "Cravio — Crave it. Get it." },
      { property: "og:description", content: "Premium food delivery. Fresh meals from the best restaurants near you, fast." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Cravio — Crave it. Get it." },
      { name: "twitter:description", content: "Premium food delivery. Fresh meals from the best restaurants near you, fast." },
      { property: "og:image", content: "/__l5e/assets-v1/ce9dea1e-9a2b-4604-9fdb-edc72023a6d0/cravio-logo.png" },
      { name: "twitter:image", content: "/__l5e/assets-v1/ce9dea1e-9a2b-4604-9fdb-edc72023a6d0/cravio-logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDesktop = pathname.startsWith("/admin");
  const isPortal = pathname === "/portal";

  return (
    <QueryClientProvider client={queryClient}>
      <CravioProviders>
        {isDesktop || isPortal ? (
          <Outlet />
        ) : (
          <PhoneShell>
            <Outlet />
          </PhoneShell>
        )}
        <Toaster position="top-center" richColors closeButton={false} />
        <CartConflictDialog />
      </CravioProviders>
    </QueryClientProvider>
  );
}
