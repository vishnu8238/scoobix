/**
 * SCOOBIX — INSFORGE AUTH
 * Official InsForge authentication mechanism for Google OAuth.
 */
import { insforge } from "./insforge";

/**
 * Generates the canonical OAuth callback URL using the ACTUAL browser origin.
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
    console.log("[AUTH_DEBUG] Setting portal intent:", portal);
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
 * @param options Additional options for the OAuth flow
 */
export async function loginWithGoogle(
  portalIntent: string = "customer",
  options: { prompt?: 'select_account' | 'consent' | 'none' } = {}
): Promise<void> {
  if (!insforge) {
    throw new Error("Authentication service is not ready.");
  }
  
  // 1. Preserve Intent
  setPortalIntent(portalIntent);
  
  // 2. Canonical Callback URL
  const callbackUrl = getOAuthCallbackUrl();
  
  try {
    const { data, error } = await insforge.auth.signInWithOAuth("google", {
      redirectTo: callbackUrl,
    });

    if (error) {
      throw new Error(`Google sign-in failed: ${error.message}`);
    }

    if ((data as any)?.url) {
      let url = (data as any).url;
      if (options.prompt) {
        const urlObj = new URL(url);
        urlObj.searchParams.set("prompt", options.prompt);
        url = urlObj.toString();
      }
      
      const target = window.top || window;
      target.location.href = url;
    }
  } catch (err: any) {
    console.error("Google login error:", err);
    throw err;
  }
}

export async function logout(): Promise<void> {
  const { error } = await insforge.auth.signOut();
  if (error) {
    console.error("Logout error:", error.message);
  }
}

/**
 * Helper to get the current session from the SDK.
 */
export async function getSession() {
  const { data, error } = await insforge.auth.getCurrentUser();
  if (error || !data.user) {
    return null;
  }
  return { user: data.user };
}


