/**
 * SCOOBIX — INSFORGE AUTH
 * Official InsForge authentication mechanism for Google and Apple OAuth.
 */
import { insforge } from "./insforge";

/**
 * Generates the canonical OAuth callback URL using the ACTUAL browser origin.
 * No query parameters are used here to ensure compatibility with whitelisted URLs.
 */
export function getOAuthCallbackUrl(): string {
  if (typeof window === "undefined") return "http://localhost:8080/auth/callback";
  const origin = window.location.origin;
  return `${origin}/auth/callback`;
}

const PORTAL_INTENT_KEY = "scoobix_oauth_portal_intent";

/**
 * Persists the portal intent before starting OAuth.
 */
export function setPortalIntent(portal: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(PORTAL_INTENT_KEY, portal);
  }
}

/**
 * Retrieves and clears the portal intent.
 */
export function popPortalIntent(): string {
  if (typeof window === "undefined") return "customer";
  const intent = localStorage.getItem(PORTAL_INTENT_KEY) || "customer";
  localStorage.removeItem(PORTAL_INTENT_KEY);
  return intent;
}

/**
 * Starts the Google OAuth flow using the official InsForge SDK.
 * @param portalIntent The portal the user wants to enter ('customer', 'partner', 'rider', 'manager', 'admin')
 */
export async function loginWithGoogle(portalIntent: string = "customer"): Promise<void> {
  console.log(`[GOOGLE_OAUTH] BUTTON_CLICKED - Portal: ${portalIntent}`);
  
  if (!insforge) {
    const err = "[GOOGLE_OAUTH] CLIENT_NOT_INITIALIZED";
    console.error(err);
    alert(err);
    throw new Error("Authentication service is not ready.");
  }
  
  console.log("[GOOGLE_OAUTH] CLIENT_READY");
  
  // 1. Preserve Intent
  setPortalIntent(portalIntent);
  
  // 2. Canonical Callback URL (No query params)
  const callbackUrl = getOAuthCallbackUrl();
  console.log(`[GOOGLE_OAUTH] CALLBACK_URL ${callbackUrl}`);
  
  try {
    console.log("[GOOGLE_OAUTH] CALLING_SDK_SIGNIN");
    const { data, error } = await insforge.auth.signInWithOAuth("google", {
      redirectTo: callbackUrl,
    });

    if (error) {
      console.error("[GOOGLE_OAUTH] SDK_ERROR:", error.message);
      alert(`SDK_ERROR: ${error.message}`);
      throw new Error(`Google sign-in failed: ${error.message}`);
    }

    console.log("[GOOGLE_OAUTH] SDK_RESULT", data);
    
    // If we're here, it means the browser didn't navigate immediately.
    // Sometimes the SDK returns an URL to navigate to manually.
    if ((data as any)?.url) {
      console.log("[GOOGLE_OAUTH] MANUAL_NAVIGATION_REQUIRED", (data as any).url);
      const target = window.top || window;
      target.location.href = (data as any).url;
    }
  } catch (err: any) {
    console.error("[GOOGLE_OAUTH] UNEXPECTED_ERROR:", err);
    alert(`UNEXPECTED_ERROR: ${err.message || String(err)}`);
    throw err;
  }
}

/**
 * Starts the Apple OAuth flow using the official InsForge SDK.
 */
export async function loginWithApple(portalIntent: string = "customer"): Promise<void> {
  console.log(`[APPLE_OAUTH] BUTTON_CLICKED - Portal: ${portalIntent}`);
  
  if (!insforge) {
    const err = "[APPLE_OAUTH] CLIENT_NOT_INITIALIZED";
    console.error(err);
    alert(err);
    throw new Error("Authentication service is not ready.");
  }
  
  console.log("[APPLE_OAUTH] CLIENT_READY");
  
  // 1. Preserve Intent
  setPortalIntent(portalIntent);
  
  // 2. Canonical Callback URL (No query params)
  const callbackUrl = getOAuthCallbackUrl();
  console.log(`[APPLE_OAUTH] CALLBACK_URL ${callbackUrl}`);
  
  try {
    console.log("[APPLE_OAUTH] CALLING_SDK_SIGNIN");
    const { data, error } = await insforge.auth.signInWithOAuth("apple", {
      redirectTo: callbackUrl,
    });

    if (error) {
      console.error("[APPLE_OAUTH] SDK_ERROR:", error.message);
      alert(`SDK_ERROR: ${error.message}`);
      throw new Error(`Apple sign-in failed: ${error.message}`);
    }

    console.log("[APPLE_OAUTH] SDK_RESULT", data);
    
    // If we're here, it means the browser didn't navigate immediately.
    // Sometimes the SDK returns an URL to navigate to manually.
    if ((data as any)?.url) {
      console.log("[APPLE_OAUTH] MANUAL_NAVIGATION_REQUIRED", (data as any).url);
      const target = window.top || window;
      target.location.href = (data as any).url;
    }
  } catch (err: any) {
    console.error("[APPLE_OAUTH] UNEXPECTED_ERROR:", err);
    alert(`UNEXPECTED_ERROR: ${err.message || String(err)}`);
    throw err;
  }
}

/**
 * Selects the callback URL dynamically based on the current environment.
 * @deprecated Use getOAuthCallbackUrl()
 */
function getCallbackUrl(portalIntent: string): string {
  return getOAuthCallbackUrl();
}

export async function logout(): Promise<void> {
  console.log("[AUTH] Logging out...");
  const { error } = await insforge.auth.signOut();
  if (error) {
    console.error("[AUTH] Logout error:", error.message);
  }
}

/**
 * Helper to get the current session from the SDK.
 */
export async function getSession() {
  const { data, error } = await insforge.auth.getCurrentUser();
  if (error) {
    return null;
  }
  return data.user ? { user: data.user } : null;
}

// Legacy helpers removed as the SDK manages persistence automatically.
export function getAccessToken(): string | null { 
  if (typeof window === "undefined") return null;
  // The SDK might store it in a standard key or we might not need to manually expose it
  return null; 
}
export function setAccessToken(token: string | null): void {}

