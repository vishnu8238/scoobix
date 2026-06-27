import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // SWR-style defaults: show cached data instantly, refresh in the background.
  // Safe for restaurant/menu/category mock data — no sensitive content is cached here.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,            // 1 min — cached data is "fresh"
        gcTime: 5 * 60_000,           // keep cache around for 5 min after unmount
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
