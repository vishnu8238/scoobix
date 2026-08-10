/**
 * SCOOBIX — INSFORGE AUTH
 * Official InsForge authentication mechanism for Google and Apple OAuth.
 */
import { insforge } from "./insforge";

/**
 * Starts the Google OAuth flow using the official InsForge SDK.
 * @param portalIntent The portal the user wants to enter ('customer', 'partner', 'rider', 'manager', 'admin')
 */
export async function loginWithGoogle(portalIntent: string = "customer"): Promise<void> {
  console.log(`[GOOGLE_OAUTH] BUTTON_CLICKED - Portal: ${portalIntent}`);
  
  if (!insforge) {
    console.error("[GOOGLE_OAUTH] CLIENT_NOT_INITIALIZED");
    throw new Error("Authentication service is not ready.");
  }
  
  console.log("[GOOGLE_OAUTH] CLIENT_READY");
  
  const callbackUrl = getCallbackUrl(portalIntent);
  console.log(`[GOOGLE_OAUTH] SDK_START - Callback: ${callbackUrl}`);
  
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
  const callbackUrl = getCallbackUrl(portalIntent);
  
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
 */
function getCallbackUrl(portalIntent: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
  return `${origin}/auth/callback?portal=${portalIntent}`;
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
