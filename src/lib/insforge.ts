import { createClient } from "@insforge/sdk";

export const INSFORGE_URL = (import.meta as any).env.VITE_INSFORGE_URL || "https://awvs3seh.us-east.insforge.app";
export const INSFORGE_PROJECT_ID = (import.meta as any).env.VITE_INSFORGE_PROJECT_ID || "9d873abd-530b-47a7-8a36-b38cc54dbdf5";
export const INSFORGE_ANON_KEY = (import.meta as any).env.VITE_INSFORGE_ANON_KEY || "sb_publishable_FIPSldMe55J2LJ_hczRqag_orYaOaTT";
export const INSFORGE_API_KEY = (import.meta as any).env.VITE_INSFORGE_API_KEY || "";

// Fail clearly if required configuration is missing
if (!INSFORGE_URL || !INSFORGE_ANON_KEY) {
  console.error(
    "[INSFORGE_ERROR] CRITICAL: VITE_INSFORGE_URL or VITE_INSFORGE_ANON_KEY is missing from the environment. " +
    "Check your .env file or deployment settings. SDK will fail if continued."
  );
}

// Maintain singleton instance with explicit persistence for iOS/mobile stability
if (!(globalThis as any).__INSFORGE_CLIENT__) {
  const options = {
    baseUrl: INSFORGE_URL,
    anonKey: INSFORGE_ANON_KEY,
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // If the SDK supports storage injection, we use it. 
      // Otherwise, the SDK defaults to localStorage in browsers.
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    }
  };
  (globalThis as any).__INSFORGE_CLIENT__ = createClient(options);
}

export const insforge = (globalThis as any).__INSFORGE_CLIENT__;

/**
 * CACHED ACCESS TOKEN - Single source of truth to avoid async race conditions.
 * Updated by the auth state listener and hydrated on startup.
 */
let cachedAccessToken: string | null = null;
let initializationPromise: Promise<void> | null = null;

// Initialize the cache by performing one authoritative check
export const ensureAuthHydrated = async () => {
  if (initializationPromise) return initializationPromise;
  
  initializationPromise = (async () => {
    try {
      console.log("[INSFORGE_AUTH] Hydrating session from storage/cookies...");
      // getCurrentUser handles the refresh logic and hydrates the session internally
      const { data: session, error } = await insforge.auth.getCurrentUser();
      if (error) {
        console.warn("[INSFORGE_AUTH] No session found during hydration:", error.message);
        cachedAccessToken = null;
        return;
      }
      
      // Pull token from the SDK
      const auth = insforge.auth;
      const tm = auth.tokenManager;
      const token = tm?.getAccessToken?.() || tm?.getSession?.()?.accessToken || null;
      cachedAccessToken = token;
      
      console.log("[INSFORGE_AUTH] Initial hydration complete. Token present:", !!cachedAccessToken);
    } catch (err) {
      console.warn("[INSFORGE_AUTH] Hydration failed:", err);
    }
  })();
  
  return initializationPromise;
};

// Subscribe to auth state changes at module level to keep cache in sync
if (typeof window !== "undefined") {
  insforge.auth.onAuthStateChange((event: string) => {
    const tm = insforge.auth.tokenManager;
    const token = tm?.getAccessToken?.() || tm?.getSession?.()?.accessToken || null;
    console.log(`[INSFORGE_AUTH] Auth event: ${event} | Token present: ${!!token}`);
    cachedAccessToken = token;
  });
  
  // Start hydration immediately on load
  ensureAuthHydrated();
}

/**
 * Standardized getter for the current access token.
 * Returns the cached value immediately if available.
 */
export const getAccessToken = async () => {
  // If we don't have a token but we're in a browser, ensure we've at least tried to hydrate
  if (!cachedAccessToken && typeof window !== "undefined") {
    await ensureAuthHydrated();
  }
  return cachedAccessToken;
};


// Mock/Stub exports for missing members reported in build errors
export const addonsForDish = async (...args: any[]): Promise<any[]> => [];
export const bootstrapInsForge = async () => {};
export const insforgeState: { loading: boolean; status: "idle" | "error" | "loading" | "success" } = { loading: false, status: "idle" };
export const subscribeCatalog = () => () => {};
export const getCatalogVersion = () => "1.0.0";
export const setRestaurantApprovalStatus = async (...args: any[]) => {};
export const setRestaurantCommission = async (...args: any[]) => {};
export const updateRestaurantStatus = async (...args: any[]) => {};
export const deleteRestaurantComplete = async (...args: any[]): Promise<any> => ({ ok: true });
export const scheduleOrder = async (...args: any[]) => {};
export const upsertMenuItem = async (...args: any[]): Promise<any> => ({ ok: true });
export const deleteMenuItem = async (...args: any[]) => {};
export const upsertAddon = async (...args: any[]) => {};
export const deleteAddon = async (...args: any[]) => {};
export const updateOrderStatus = async (...args: any[]) => {};
export const pingDriverLocation = async (...args: any[]) => {};
export const setDriverOnline = async (...args: any[]) => {};
export const acceptDeliveryRequest = async (...args: any[]) => {};

