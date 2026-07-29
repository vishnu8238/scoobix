import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Role, User } from "./types";
import {
  ifSignup,
  ifLogin,
  ifLogout,
  ifGetSession,
  ifSendPasswordReset,
  ifVerifyEmail,
  ifResendVerificationEmail,
  ifCreateOAuthUrl,
  navigateToOAuthUrl,
  ifCompleteOAuth,
  readOAuthCallback,
  readOAuthError,
  clearOAuthParamsFromUrl,
  fetchUserProfile,
  findUserProfileByEmail,
  upsertUserProfile,
  referralCodeFor,
  type DbRole,
  type InsForgeUser,
  type OAuthProvider,
  type UserProfileRow,
} from "./insforge-auth";
import { isPhoneOtpEnabled, sendPhoneOtp, verifyPhoneOtp, normalisePhone } from "./phone-otp";
import { setTokens } from "./insforge-auth";

/**
 * Auth store backed by InsForge Auth.
 *
 * - Email + password, Google / Apple OAuth (PKCE), and a pluggable phone-OTP layer.
 * - Session persists across refresh (access + refresh tokens), auto-refreshing
 *   expired access tokens and clearing revoked ones.
 * - The authoritative profile lives in `public.users`; every sign-in path funnels
 *   through `syncProfile` so one person always maps to ONE account row.
 * - DB roles (customer | restaurant | driver | admin) are mapped to the historical
 *   UI Role enum (customer | partner | rider | admin) so routes stay unchanged.
 */

type AuthResult = { ok: boolean; user?: User; message?: string; needsVerification?: boolean };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, role?: Role) => Promise<AuthResult>;
  signUp: (input: { name: string; email: string; phone: string; password: string; role: Role }) => Promise<AuthResult>;
  signInWithProvider: (provider: OAuthProvider, role?: Role) => Promise<{ ok: boolean; message?: string }>;
  phoneOtpEnabled: boolean;
  requestPhoneOtp: (phone: string) => Promise<{ ok: boolean; message?: string; resendAfter: number }>;
  verifyPhoneLogin: (phone: string, otp: string, role?: Role) => Promise<AuthResult>;
  verifyEmailCode: (email: string, code: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => void;
  /** Last provider sign-in failure (Google / Apple), surfaced by the login UI. */
  oauthError: string | null;
  clearOAuthError: () => void;
  resetPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export const ROLE_HOME: Record<Role, string> = {
  customer: "/app",
  partner: "/partner",
  rider: "/rider",
  admin: "/admin",
};

// ---------- role mapping between DB and existing UI enum ----------

const DB_TO_UI: Record<DbRole, Role> = {
  customer: "customer",
  restaurant: "partner",
  driver: "rider",
  admin: "admin",
};
const UI_TO_DB: Record<Role, DbRole> = {
  customer: "customer",
  partner: "restaurant",
  rider: "driver",
  admin: "admin",
};

function toUiRole(role: string | undefined | null): Role | null {
  if (!role) return null;
  const key = String(role).toLowerCase();
  if (key in DB_TO_UI) return DB_TO_UI[key as DbRole];
  if (["customer", "partner", "rider", "admin"].includes(key)) return key as Role;
  return null;
}

const PENDING_ROLE_KEY = "scoobix_pending_role_v1";
const PENDING_ROLE_CLAIM_KEY = "scoobix_pending_role_claim_v1";

function rememberPendingRole(role?: Role, claim = false) {
  try {
    if (role) sessionStorage.setItem(PENDING_ROLE_KEY, role);
    if (role && claim) sessionStorage.setItem(PENDING_ROLE_CLAIM_KEY, "1");
  } catch { /* */ }
  try {
    if (role) localStorage.setItem(PENDING_ROLE_KEY, role);
    if (role && claim) localStorage.setItem(PENDING_ROLE_CLAIM_KEY, "1");
  } catch { /* */ }
}
function takePendingRole(): { role?: Role; claim: boolean } {
  try {
    const value = (sessionStorage.getItem(PENDING_ROLE_KEY) ?? localStorage.getItem(PENDING_ROLE_KEY)) as Role | null;
    const claim =
      (sessionStorage.getItem(PENDING_ROLE_CLAIM_KEY) ?? localStorage.getItem(PENDING_ROLE_CLAIM_KEY)) === "1";
    sessionStorage.removeItem(PENDING_ROLE_KEY);
    localStorage.removeItem(PENDING_ROLE_KEY);
    sessionStorage.removeItem(PENDING_ROLE_CLAIM_KEY);
    localStorage.removeItem(PENDING_ROLE_CLAIM_KEY);
    return { role: value ?? undefined, claim };
  } catch { return { claim: false }; }
}


function mergeProviders(existing: string | null | undefined, provider: string): string {
  const list = new Set((existing ?? "").split(",").map((p) => p.trim()).filter(Boolean));
  list.add(provider);
  return Array.from(list).join(",");
}

type SyncInput = {
  role?: Role;
  /** Signup paths claim the chosen role even if a default profile row exists. */
  forceRole?: boolean;
  name?: string;
  phone?: string;
  provider?: string;
};

/**
 * THE single authentication pipeline. Every path (email login, email signup,
 * Google, Apple, phone OTP, session restore) funnels through here.
 *
 * Guarantees:
 * - returns null instead of throwing when there is no session user,
 * - always ensures exactly one `public.users` row for the auth account
 *   (self-healing for accounts created before the profile write worked),
 * - never reads a property off a profile that may not exist.
 */
async function syncProfile(sess: InsForgeUser | null | undefined, input: SyncInput = {}): Promise<User | null> {
  if (!sess || typeof sess.id !== "string" || !sess.id) return null;

  const provider = input.provider ?? "email";
  let existing: UserProfileRow | null = null;
  try {
    existing =
      (await fetchUserProfile(sess.id)) ?? (sess.email ? await findUserProfileByEmail(sess.email) : null);
  } catch {
    existing = null;
  }

  const name =
    existing?.name ||
    input.name ||
    (sess.profile?.name as string | undefined) ||
    (sess.profile?.full_name as string | undefined) ||
    ((sess.metadata?.name ?? sess.metadata?.full_name) as string | undefined) ||
    (sess.email ? sess.email.split("@")[0] : provider === "apple" ? "Apple User" : "User");
  const avatar =
    (sess.profile?.avatar_url as string | undefined) || existing?.avatar || undefined;
  const role = toUiRole(existing?.role) ?? input.role ?? "customer";
  const phone = existing?.phone || input.phone || "";
  // Apple can withhold the address entirely — never write an empty string into
  // a unique column, and never crash on the missing value.
  const email = sess.email || existing?.email || "";

  const row: UserProfileRow = {
    id: sess.id,
    email: email || null,
    name,
    phone: phone || null,
    role: UI_TO_DB[role],
    avatar: avatar ?? null,
    status: existing?.status ?? "active",
    provider,
    providers: mergeProviders(existing?.providers, provider),
    email_verified: sess.emailVerified ?? existing?.email_verified ?? false,
    last_login_at: new Date().toISOString(),
    referral_code: existing?.referral_code || referralCodeFor(sess.id, name),
    wallet_balance: existing?.wallet_balance ?? 0,
    loyalty_points: existing?.loyalty_points ?? 0,
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(sess.metadata ?? {}),
      last_provider: provider,
      updated_at: new Date().toISOString(),
    },
  };

  // Blocking: the profile must exist before the UI ever sees the user.
  const saved = await upsertUserProfile(row).catch(() => null);
  const finalRole = toUiRole(saved?.role) ?? role;

  return {
    id: sess.id,
    name: saved?.name || name,
    email: saved?.email || email,
    phone: saved?.phone || phone,
    role: finalRole,
    avatar: saved?.avatar || avatar,
  };
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Auto-login + OAuth return handling.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let handledOAuth = false;
      try {
        const providerError = readOAuthError();
        if (providerError) {
          console.error("[auth] OAuth provider returned an error", providerError);
          if (!cancelled) setOauthError(providerError);
          clearOAuthParamsFromUrl();
        }
        const callback = readOAuthCallback();
        if (callback) {
          try {
            const { user: sess } = await ifCompleteOAuth(callback.code);
            const next = await syncProfile(sess, {
              provider: String(callback.provider),
              role: takePendingRole(),
            });
            if (!cancelled && next) {
              setUser(next);
              handledOAuth = true;
              try {
                window.opener?.postMessage({ type: "scoobix_oauth_complete" }, window.location.origin);
                if (window.opener && !window.opener.closed) window.setTimeout(() => window.close(), 250);
              } catch { /* */ }
            }
          } catch (err) {
            console.error("[auth] OAuth callback failed", err);
            if (!cancelled) {
              setOauthError(err instanceof Error ? err.message : "Provider sign-in failed");
            }
          }
          clearOAuthParamsFromUrl();
        }
        if (handledOAuth) return;
        const sess = await ifGetSession();
        if (cancelled) return;
        if (sess) {
          const next = await syncProfile(sess);
          if (!cancelled && next) setUser(next);
        } else if (!callback) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restoreFromSharedSession = async () => {
      const sess = await ifGetSession();
      if (cancelled) return;
      const next = await syncProfile(sess);
      if (!cancelled && next) setUser(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key.startsWith("scoobix_if_")) void restoreFromSharedSession();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === "scoobix_oauth_complete") {
        void restoreFromSharedSession();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password, role) => {
    try {
      const { user: sess } = await ifLogin(email.trim(), password);
      const next = await syncProfile(sess, { provider: "email", role });
      if (!next) return { ok: false, message: "Could not load your account. Please try again." };
      setUser(next);
      return { ok: true, user: next };
    } catch (err) {
      console.error("[auth] Email sign-in failed", err);
      const message = err instanceof Error ? err.message : "Sign in failed";
      return { ok: false, message, needsVerification: /verif/i.test(message) };
    }
  };

  const signUp: AuthCtx["signUp"] = async ({ name, email, phone, password, role }) => {
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/login` : undefined;
      const { user: sess, requireEmailVerification } = await ifSignup(email.trim(), password, name.trim(), redirectTo);
      // Profile creation is attempted for every signup; when verification is
      // pending there may be no session user yet — the row is then created on
      // the first successful login (self-healing).
      const next = await syncProfile(sess, { provider: "email", role, name: name.trim(), phone });
      if (requireEmailVerification) {
        return {
          ok: true,
          needsVerification: true,
          message: "Check your email to verify your account before signing in.",
        };
      }
      if (!next) return { ok: false, message: "Account created but sign-in failed. Please sign in." };
      setUser(next);
      return { ok: true, user: next };
    } catch (err) {
      console.error("[auth] Email sign-up failed", err);
      return { ok: false, message: err instanceof Error ? err.message : "Sign up failed" };
    }
  };


  const signInWithProvider: AuthCtx["signInWithProvider"] = async (provider, role) => {
    try {
      setOauthError(null);
      rememberPendingRole(role);
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const authUrl = await ifCreateOAuthUrl(provider, redirectUri);
      navigateToOAuthUrl(authUrl);
      return { ok: true };
    } catch (err) {
      console.error(`[auth] ${provider} sign-in failed`, err);
      return { ok: false, message: err instanceof Error ? err.message : `Could not sign in with ${provider}` };
    }
  };

  const requestPhoneOtp: AuthCtx["requestPhoneOtp"] = async (phone) => {
    const res = await sendPhoneOtp(phone);
    return { ok: res.ok, message: res.message, resendAfter: res.resendAfter };
  };

  const verifyPhoneLogin: AuthCtx["verifyPhoneLogin"] = async (phone, otp, role) => {
    const res = await verifyPhoneOtp(phone, otp);
    if (!res.ok || !res.accessToken) return { ok: false, message: res.message ?? "Invalid code" };
    setTokens(res.accessToken, res.refreshToken ?? null);
    const sess = await ifGetSession();
    if (!sess) return { ok: false, message: "Could not start a session" };
    const next = await syncProfile(sess, { provider: "phone", role, phone: normalisePhone(phone) });
    if (!next) return { ok: false, message: "Could not load your account. Please try again." };
    setUser(next);
    return { ok: true, user: next };
  };

  const verifyEmailCode: AuthCtx["verifyEmailCode"] = async (email, code) => {
    try {
      const sess = await ifVerifyEmail(email.trim(), code.trim());
      if (!sess) return { ok: false, message: "Verification failed" };
      const next = await syncProfile(sess, { provider: "email" });
      if (!next) return { ok: false, message: "Could not load your account. Please try again." };
      setUser(next);
      return { ok: true, user: next };

    } catch (err) {
      console.error("[auth] Email verification failed", err);
      return { ok: false, message: err instanceof Error ? err.message : "Verification failed" };
    }
  };

  const resendVerification: AuthCtx["resendVerification"] = async (email) => {
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/login` : undefined;
      await ifResendVerificationEmail(email.trim(), redirectTo);
      return { ok: true, message: "Verification email sent" };
    } catch (err) {
      console.error("[auth] Verification resend failed", err);
      return { ok: false, message: err instanceof Error ? err.message : "Could not resend email" };
    }
  };

  const signOut = useCallback(() => {
    // Clear the local session FIRST so no in-flight request can revive it,
    // then revoke server-side in the background.
    setTokens(null, null);
    try {
      sessionStorage.removeItem(PENDING_ROLE_KEY);
      localStorage.removeItem(PENDING_ROLE_KEY);
    } catch { /* */ }
    setUser(null);
    void ifLogout();
  }, []);

  const resetPassword: AuthCtx["resetPassword"] = async (email) => {
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/login` : undefined;
      await ifSendPasswordReset(email.trim(), redirectTo);
      return { ok: true, message: "Reset link sent — check your inbox" };
    } catch (err) {
      console.error("[auth] Password reset failed", err);
      return { ok: false, message: err instanceof Error ? err.message : "Could not send reset email" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signInWithProvider,
        oauthError,
        clearOAuthError: () => setOauthError(null),
        phoneOtpEnabled: isPhoneOtpEnabled(),
        requestPhoneOtp,
        verifyPhoneLogin,
        verifyEmailCode,
        resendVerification,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
