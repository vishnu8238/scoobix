import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { ScoobixProviders } from "@/lib/stores";
import { PhoneShell } from "@/components/cravio/PhoneShell";
import { Toaster } from "@/components/ui/sonner";
import { CartConflictDialog } from "@/components/cravio/CartConflictDialog";
import { PWAInstallPrompt } from "@/components/cravio/PWAInstallPrompt";
import { NetworkBanner } from "@/components/cravio/NetworkBanner";
import { InsForgeBootstrap } from "@/components/cravio/InsForgeBootstrap";
import { subscribeCatalog, getCatalogVersion } from "@/lib/insforge";
import { registerServiceWorker, prefetchResources } from "@/lib/sw-register";
import { AuthProvider } from "@/lib/auth-store";
import { PreviewModeBanner } from "@/components/cravio/PreviewModeBanner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#28a156" },
      { title: "Scoobix — Crave it. Get it." },
      { name: "description", content: "Premium food delivery. Fresh meals from the best restaurants near you, fast." },
      { property: "og:title", content: "Scoobix — Crave it. Get it." },
      { property: "og:description", content: "Premium food delivery. Fresh meals from the best restaurants near you, fast." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Scoobix — Crave it. Get it." },
      { name: "twitter:description", content: "Premium food delivery. Fresh meals from the best restaurants near you, fast." },
      { property: "og:image", content: "/__l5e/assets-v1/fa2216a6-185b-4e1b-9d98-05fadb8c4490/scoobix-logo.png" },
      { name: "twitter:image", content: "/__l5e/assets-v1/fa2216a6-185b-4e1b-9d98-05fadb8c4490/scoobix-logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "Scoobix" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Scoobix" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/__l5e/assets-v1/fa2216a6-185b-4e1b-9d98-05fadb8c4490/scoobix-logo.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  
  useEffect(() => {
    registerServiceWorker();
    prefetchResources([]);
    const unsub = (subscribeCatalog as any)();
    return () => (unsub as any)?.();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ScoobixProviders>
          <AppShellContent />
          <Toaster position="top-center" richColors closeButton={false} />
          <CartConflictDialog />
          <NetworkBanner />
          <PWAInstallPrompt />
          <InsForgeBootstrap />
          <PreviewModeBanner />
        </ScoobixProviders>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppShellContent() {
  const location = useLocation();
  const isDesktopPortal = location.pathname.startsWith('/logistics') || location.pathname.startsWith('/admin');

  const catalogVersion = useSyncExternalStore(
    (cb) => (subscribeCatalog as any)(cb), 
    () => (getCatalogVersion as any)(),
    () => (getCatalogVersion as any)()
  );
  
  const content = <Outlet />;

  return (
    <div key={catalogVersion}>
      {isDesktopPortal ? (
        <div className="min-h-svh w-full bg-background">
          {content}
        </div>
      ) : (
        <PhoneShell>
          {content}
        </PhoneShell>
      )}
      <HeadContent />
      <Scripts />
    </div>
  );
}
