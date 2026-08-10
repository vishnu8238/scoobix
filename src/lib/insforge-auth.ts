// The low-level authentication engine has been removed.
// This is a minimal stub to prevent build errors.

export function getAccessToken(): string | null {
  return null;
}

export function setAccessToken(token: string | null): void {}

export async function loginWithGoogle(): Promise<void> {}
export async function loginWithApple(): Promise<void> {}
export async function logout(): Promise<void> {}
export async function ifChangePassword(old: string, newP: string): Promise<{ ok: boolean }> {
  return { ok: true };
}
