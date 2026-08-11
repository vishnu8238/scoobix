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

  // 1. Preserve Intent (routing context only — never authorization)
  setPortalIntent(portalIntent);
  console.log("[AUTH_DEBUG] GOOGLE_CLICK portal:", portalIntent);

  // 2. Canonical Callback URL (real browser origin)
  const callbackUrl = getOAuthCallbackUrl();
  console.log("[AUTH_DEBUG] OAUTH_CALLBACK_URL", callbackUrl);

  // 3. Ask the SDK for the authorization URL instead of letting it navigate
  //    internally, so we can surface failures instead of appearing inert.
  //    The SDK still owns PKCE (verifier stored by signInWithOAuth).
  const { data, error } = await insforge.auth.signInWithOAuth("google", {
    redirectTo: callbackUrl,
    skipBrowserRedirect: true,
    ...(options.prompt ? { additionalParams: { prompt: options.prompt } } : {}),
  });

  const url = (data as any)?.url as string | undefined;
  console.log(
    "[AUTH_DEBUG] OAUTH_RESULT result exists:",
    data ? "YES" : "NO",
    "| url exists:",
    url ? "YES" : "NO",
    "| error exists:",
    error ? "YES" : "NO",
  );

  if (error) {
    console.error("[AUTH_DEBUG] OAUTH_ERROR", error.message);
    throw new Error(error.message || "Google sign-in failed.");
  }

  if (!url) {
    console.error("[AUTH_DEBUG] OAUTH_ERROR No authorization URL returned by provider.");
    throw new Error("Google sign-in did not return an authorization URL.");
  }

  // 4. Normal top-level browser navigation (no window.top, no iframe tricks)
  window.location.href = url;
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


