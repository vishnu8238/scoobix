/**
 * SCOOBIX — INSFORGE AUTH PRESERVATION
 * Minimal interface to preserve the underlying InsForge infrastructure.
 */

export function getAccessToken(): string | null {
  return null;
}

export function setAccessToken(token: string | null): void {}

export async function loginWithGoogle(): Promise<void> {
  console.log("Google Login placeholder triggered");
}

export async function loginWithApple(): Promise<void> {
  console.log("Apple Login placeholder triggered");
}

export async function logout(): Promise<void> {
  console.log("Logout triggered");
}

export async function ifChangePassword(old: string, newP: string): Promise<{ ok: boolean }> {
  return { ok: true };
}
