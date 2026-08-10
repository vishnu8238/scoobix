/**
 * SCOOBIX — INSFORGE AUTH
 * Official InsForge authentication mechanism for Google and Apple OAuth.
 */
import { insforge } from "./insforge";

/**
 * Generates the OAuth callback URL using the ACTUAL browser origin.
 * Never hard-codes localhost for production or preview.
 */
export function getOAuthCallbackUrl(portal: string): string {
  if (typeof window === "undefined") return `http://localhost:8080/auth/callback?portal=${portal}`;
  
  const origin = window.location.origin;
  return `${origin}/auth/callback?portal=${portal}`;
}

/**
 * Starts the Google OAuth flow using the official InsForge SDK.
 * @param portalIntent The portal the user wants to enter ('customer', 'partner', 'rider', 'manager', 'admin')
 */
export async function loginWithGoogle(portalIntent: string = "customer"): Promise<void> {
  const msg = `[GOOGLE_OAUTH] BUTTON_CLICKED - Portal: ${portalIntent}`;
  console.log(msg);
  alert(msg); // Hard signal to confirm button interaction is reaching the function
  
  if (!insforge) {
    const err = "[GOOGLE_OAUTH] CLIENT_NOT_INITIALIZED";
    console.error(err);
    alert(err);
    throw new Error("Authentication service is not ready.");
  }
  
  console.log("[GOOGLE_OAUTH] CLIENT_READY");
  
  const callbackUrl = getOAuthCallbackUrl(portalIntent);
  console.log(`[GOOGLE_OAUTH] CALLBACK_URL ${callbackUrl}`);
  
  try {
    const { data, error } = await insforge.auth.signInWithOAuth("google", {
      redirectTo: callbackUrl,
    });

    if (error) {
      console.error("[GOOGLE_OAUTH] SDK_ERROR:", error.message);
      throw new Error(`Google sign-in failed: ${error.message}`);
    }

    console.log("[GOOGLE_OAUTH] SDK_RESULT", data);
  } catch (err: any) {
    console.error("[GOOGLE_OAUTH] UNEXPECTED_ERROR:", err);
    throw err;
  }
}

/**
 * Starts the Apple OAuth flow using the official InsForge SDK.
 */
export async function loginWithApple(portalIntent: string = "customer"): Promise<void> {
  console.log(`[APPLE_OAUTH] BUTTON_CLICKED - Portal: ${portalIntent}`);
  const callbackUrl = getOAuthCallbackUrl(portalIntent);
  console.log(`[APPLE_OAUTH] CALLBACK_URL ${callbackUrl}`);
  
  const { error } = await insforge.auth.signInWithOAuth("apple", {
    redirectTo: callbackUrl,
  });

  if (error) {
    console.error("[APPLE_OAUTH] SDK_ERROR:", error.message);
    throw new Error(`Apple sign-in failed: ${error.message}`);
  }
}

/**
 * Selects the callback URL dynamically based on the current environment.
 * @deprecated Use getOAuthCallbackUrl(portal)
 */
function getCallbackUrl(portalIntent: string): string {
  return getOAuthCallbackUrl(portalIntent);
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
export function getAccessToken(): string | null { return null; }
export function setAccessToken(token: string | null): void {}

