/**
 * SCOOBIX — INSFORGE AUTH
 * Official InsForge authentication mechanism for Google and Apple OAuth.
 */
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";

const ACCESS_KEY = "scoobix_if_access_v1";

export function getAccessToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (token) {
    localStorage.setItem(ACCESS_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_KEY);
  }
}

/**
 * Starts the Google OAuth flow.
 * @param portalIntent The portal the user wants to enter ('customer', 'partner', 'rider', 'manager')
 */
export async function loginWithGoogle(portalIntent: string = "customer"): Promise<void> {
  const callbackUrl = `${window.location.origin}/auth/callback?portal=${portalIntent}`;
  const url = `${INSFORGE_URL}/api/auth/authorize?provider=google&redirect_to=${encodeURIComponent(callbackUrl)}`;
  window.location.assign(url);
}

/**
 * Starts the Apple OAuth flow.
 */
export async function loginWithApple(portalIntent: string = "customer"): Promise<void> {
  const callbackUrl = `${window.location.origin}/auth/callback?portal=${portalIntent}`;
  const url = `${INSFORGE_URL}/api/auth/authorize?provider=apple&redirect_to=${encodeURIComponent(callbackUrl)}`;
  window.location.assign(url);
}

export async function logout(): Promise<void> {
  setAccessToken(null);
  // Clear other auth-related local state if any
  console.log("Logout triggered - access token cleared");
}

export async function ifChangePassword(old: string, newP: string): Promise<{ ok: boolean }> {
  // Not implemented in Phase 1 (Email/Password disabled)
  return { ok: false };
}
