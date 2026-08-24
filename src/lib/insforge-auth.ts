/**
 * SCOOBIX — INSFORGE AUTH
 * Official InsForge authentication mechanism for Google OAuth.
 */
import { insforge } from "./insforge";

/**
 * Generates the canonical OAuth callback URL using the ACTUAL browser origin.
 * @param portal Optional portal to persist in the callback URL
 */
export function getOAuthCallbackUrl(portal?: string): string {
  if (typeof window === "undefined") return "http://localhost:8080/auth/callback";
  const origin = window.location.origin;
  const baseUrl = `${origin}/auth/callback`;
  
  if (portal && ["customer", "partner", "rider", "manager", "admin", "logistics"].includes(portal)) {
    return `${baseUrl}?portal=${portal}`;
  }
  
  return baseUrl;
}

const PORTAL_INTENT_KEY = "scoobix_oauth_portal_intent";

/**
 * Persists the portal intent before starting OAuth.
 * Uses both localStorage and sessionStorage for maximum reliability across browsers.
 */
export function setPortalIntent(portal: string) {
  if (typeof window !== "undefined") {
    console.log("[AUTH_DEBUG] Setting portal intent:", portal);
    localStorage.setItem(PORTAL_INTENT_KEY, portal);
    try {
      sessionStorage.setItem(PORTAL_INTENT_KEY, portal);
    } catch (e) {
      // Ignore sessionStorage errors (e.g. private mode)
    }
  }
}

/**
 * Retrieves and clears the portal intent.
 */
export function popPortalIntent(): string {
  if (typeof window === "undefined") return "customer";
  
  // Priority: URL Param > sessionStorage > localStorage
  const params = new URLSearchParams(window.location.search);
  const portalParam = params.get("portal");
  if (portalParam) return portalParam;

  const sessionIntent = sessionStorage.getItem(PORTAL_INTENT_KEY);
  const localIntent = localStorage.getItem(PORTAL_INTENT_KEY);
  const intent = sessionIntent || localIntent || "customer";
  
  console.log("[AUTH_DEBUG] Popped portal intent:", intent, { source: sessionIntent ? 'session' : localIntent ? 'local' : 'default' });
  
  localStorage.removeItem(PORTAL_INTENT_KEY);
  try {
    sessionStorage.removeItem(PORTAL_INTENT_KEY);
  } catch (e) {}
  
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
  // Carry validated portal through round-trip as a query parameter
  const callbackUrl = getOAuthCallbackUrl(portalIntent);
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
  const { data } = await insforge.auth.getCurrentUser().catch(() => ({ data: null }));
  const session = insforge.auth.session;
  const user = session?.user || data?.user;
  
  if (!user?.id) {
    return null;
  }
  
  const token = session?.accessToken || (data as any)?.accessToken;
  return { user, accessToken: token };
}


