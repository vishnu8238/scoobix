import { createClient } from "@insforge/sdk";

// Use an environment-aware singleton pattern
const getInsForgeClient = () => {
  const isServer = typeof window === 'undefined';
  const projectId = isServer ? process.env.INSFORGE_PROJECT_ID : (import.meta as any).env.VITE_INSFORGE_PROJECT_ID;
  const apiKey = isServer ? process.env.INSFORGE_API_KEY : (import.meta as any).env.VITE_INSFORGE_API_KEY;

  if (!projectId || !apiKey) {
    console.warn("[INSFORGE_INIT] Missing configuration. Auth will fail.");
  }

  // Ensure singleton per-process/per-window
  if (!(globalThis as any).__INSFORGE_CLIENT__) {
    console.log("[INSFORGE_INIT] Creating new client instance (Singleton)");
    (globalThis as any).__INSFORGE_CLIENT__ = createClient(projectId, apiKey);
  } else {
    console.log("[INSFORGE_INIT] Reusing existing client instance");
  }

  return (globalThis as any).__INSFORGE_CLIENT__;
};

export const insforge = getInsForgeClient();
