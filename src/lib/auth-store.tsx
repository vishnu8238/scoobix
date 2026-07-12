import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role, User } from "./types";
import {
  ifSignup,
  ifLogin,
  ifLogout,
  ifGetSession,
  ifSendPasswordReset,
  fetchUserProfile,
  upsertUserProfile,
  type DbRole,
  type InsForgeUser,
} from "./insforge-auth";

/**
 * Auth store backed by InsForge Auth.
 *
 * - Real sign in / sign up / sign out via `/api/auth/*` endpoints.
 * - Session persists across refresh (access + refresh tokens in localStorage).
 * - User role is read from `public.users.role`.
 * - Supported DB roles: customer | restaurant | driver | admin.
 *   The UI still uses the historical Role type (customer|partner|rider|admin) —
 *   we map DB ↔ UI so routes and components stay unchanged.
 */

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, role?: Role) => Promise<{ ok: boolean; user?: User; message?: string }>;
  signUp: (input: { name: string; email: string; phone: string; password: string; role: Role }) => Promise<{ ok: boolean; user?: User; message?: string }>;
  signOut: () => void;
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

function toUiRole(role: string | undefined | null): Role {
  if (!role) return "customer";
  if (role in DB_TO_UI) return DB_TO_UI[role as DbRole];
  // Some rows may already store the UI role directly.
  if (["customer", "partner", "rider", "admin"].includes(role)) return role as Role;
  return "customer";
}

async function assembleUser(sess: InsForgeUser, fallbackRole?: Role, fallbackName?: string, fallbackPhone?: string): Promise<User> {
  const profile = await fetchUserProfile(sess.id);
  const role = toUiRole(profile?.role) || fallbackRole || "customer";
  return {
    id: sess.id,
    name: profile?.name || fallbackName || sess.profile?.name || sess.email.split("@")[0],
    email: sess.email,
    phone: profile?.phone || fallbackPhone || "",
    role,
    avatar: profile?.avatar_url || (sess.profile?.avatar_url as string | undefined),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto-login: hydrate session from stored token on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sess = await ifGetSession();
        if (cancelled) return;
        if (sess) setUser(await assembleUser(sess));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    try {
      const { user: sess } = await ifLogin(email.trim(), password);
      const next = await assembleUser(sess);
      setUser(next);
      return { ok: true, user: next };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Sign in failed" };
    }
  };

  const signUp: AuthCtx["signUp"] = async ({ name, email, phone, password, role }) => {
    try {
      const { user: sess, requireEmailVerification } = await ifSignup(email.trim(), password, name.trim());
      // Best-effort profile row in public.users with the requested role.
      await upsertUserProfile({
        id: sess.id,
        name,
        email: sess.email,
        phone,
        role: UI_TO_DB[role],
      });
      if (requireEmailVerification) {
        return { ok: true, message: "Check your email to verify your account before signing in." };
      }
      const next = await assembleUser(sess, role, name, phone);
      setUser(next);
      return { ok: true, user: next };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Sign up failed" };
    }
  };

  const signOut = () => {
    void ifLogout();
    setUser(null);
  };

  const resetPassword: AuthCtx["resetPassword"] = async (email) => {
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/login` : undefined;
      await ifSendPasswordReset(email.trim(), redirectTo);
      return { ok: true, message: "Reset link sent — check your inbox" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Could not send reset email" };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
