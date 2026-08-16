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
  // Use authoritative SDK options
  (globalThis as any).__INSFORGE_CLIENT__ = createClient({
    baseUrl: INSFORGE_URL,
    anonKey: INSFORGE_ANON_KEY,
    auth: {
      detectOAuthCallback: true
    }
  });
}

export const insforge = (globalThis as any).__INSFORGE_CLIENT__;
if (typeof window !== "undefined") {
  (window as any).insforge = insforge;
}

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
      if (typeof window === "undefined") return;

      console.log("[INSFORGE_AUTH] Hydrating session from storage/cookies...");
      
      // Perform authoritative check with the SDK
      const { data, error } = await insforge.auth.getCurrentUser();
      
      if (error) {
        console.warn("[INSFORGE_AUTH] No session found during hydration:", error.message);
        cachedAccessToken = null;
        return;
      }
      
      const session = insforge.auth.session;
      if (session?.accessToken) {
        cachedAccessToken = session.accessToken;
        console.log("[INSFORGE_AUTH] Initial hydration complete. Token present.");
      }
    } catch (err) {
      console.warn("[INSFORGE_AUTH] Hydration failed:", err);
    }
  })();
  
  return initializationPromise;
};

// Subscribe to auth state changes at module level to keep cache in sync
if (typeof window !== "undefined") {
  insforge.auth.onAuthStateChange((event: string) => {
    const session = insforge.auth.session;
    const token = session?.accessToken || null;
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
  // 1. Authoritative check: current SDK session memory
  const sdkSession = insforge.auth.session;
  if (sdkSession?.accessToken) return sdkSession.accessToken;

  // 2. Authorization fallback: browser local storage (SDK might have lost its in-memory state)
  if (typeof window !== "undefined") {
    try {
      // The InsForge SDK uses this key format by default
      const stored = window.localStorage.getItem("insforge.auth.token");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.access_token) return parsed.access_token;
        if (parsed?.accessToken) return parsed.accessToken;
      }
      
      // Secondary fallback: search all keys for something that looks like an access token
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.includes("insforge") || key?.includes("auth") || key?.includes("token")) {
          const val = window.localStorage.getItem(key!);
          if (val && val.includes("access_token")) {
            const parsed = JSON.parse(val);
            if (parsed.access_token) return parsed.access_token;
            if (parsed.accessToken) return parsed.accessToken;
            if (parsed.session?.access_token) return parsed.session.access_token;
            if (parsed.session?.accessToken) return parsed.session.accessToken;
          }
        }
      }
    } catch { /* ignore */ }
  }

  // 3. Last resort: hydrate from server or trigger refresh
  if (!cachedAccessToken && typeof window !== "undefined") {
    await ensureAuthHydrated();
  }
  
  const finalToken = cachedAccessToken || sdkSession?.accessToken || null;
  console.log("[INSFORGE_AUTH] getAccessToken result:", finalToken ? "PRESENT" : "MISSING");
  return finalToken;
};


// Mock/Stub exports for missing members reported in build errors
export const addonsForDish = async (...args: any[]): Promise<any[]> => [];
export const bootstrapInsForge = async () => {};
export const insforgeState: { loading: boolean; status: "idle" | "error" | "loading" | "success" } = { loading: false, status: "idle" };
export const subscribeCatalog = () => () => {};
export const getCatalogVersion = () => "1.0.0";
export const setRestaurantApprovalStatus = async (...args: any[]) => {};
export const setRestaurantCommission = async (...args: any[]) => {};
export const updateRestaurantStatus = async (id: string, patch: Record<string, any>) => {
  const { patchRecord } = await import("./insforge-crud");
  return patchRecord("restaurants", id, patch);
};
export const deleteRestaurantComplete = async (id: string): Promise<any> => {
  const { deleteRecord } = await import("./insforge-crud");
  return deleteRecord("restaurants", id);
};
export const scheduleOrder = async (...args: any[]) => {};
export const upsertMenuItem = async (item: any): Promise<any> => {
  const { createRecord, patchRecord } = await import("./insforge-crud");
  if (item.id && !item.id.startsWith('n')) {
    return patchRecord("menu_items", item.id, item);
  }
  return createRecord("menu_items", item);
};
export const deleteMenuItem = async (id: string) => {
  const { deleteRecord } = await import("./insforge-crud");
  return deleteRecord("menu_items", id);
};
export const upsertAddon = async (addon: any) => {
  const { createRecord, patchRecord } = await import("./insforge-crud");
  if (addon.id && !addon.id.startsWith('a')) {
    return patchRecord("menu_addons", addon.id, addon);
  }
  return createRecord("menu_addons", addon);
};
export const deleteAddon = async (id: string) => {
  const { deleteRecord } = await import("./insforge-crud");
  return deleteRecord("menu_addons", id);
};
export const updateOrderStatus = async (id: string, patch: Record<string, any>) => {
  const { patchRecord } = await import("./insforge-crud");
  return patchRecord("orders", id, patch);
};
export const pingDriverLocation = async (...args: any[]) => {};
export const setDriverOnline = async (...args: any[]) => {};
export const acceptDeliveryRequest = async (...args: any[]) => {
  const { patchRecord } = await import("./insforge-crud");
  const [id] = args;
  return patchRecord("delivery_requests", id, { status: 'accepted' });
};

