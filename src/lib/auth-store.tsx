import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role, User } from "./types";

/**
 * Mock auth store. Replace `signIn` / `signUp` / `signOut` internals with a
 * real backend call later — the public API is intentionally backend-shaped.
 */

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, _password: string, role?: Role) => Promise<{ ok: boolean; user?: User; message?: string }>;
  signUp: (input: { name: string; email: string; phone: string; password: string; role: Role }) => Promise<{ ok: boolean; user?: User; message?: string }>;
  signOut: () => void;
  resetPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
};

const AuthContext = createContext<AuthCtx | null>(null);
const KEY = "cravio_auth_v1";

const DEMO_USERS: User[] = [
  { id: "u_cust",  name: "Alex Customer",  email: "customer@cravio.app",  phone: "+91 90000 00001", role: "customer" },
  { id: "u_part",  name: "Marco Bianchi",  email: "partner@cravio.app",   phone: "+91 90000 00002", role: "partner"  },
  { id: "u_ride",  name: "Aarav Mehta",    email: "rider@cravio.app",     phone: "+91 90000 00003", role: "rider"    },
  { id: "u_admin", name: "Scoobix Admin",   email: "admin@cravio.app",     phone: "+91 90000 00004", role: "admin"    },
];

export const ROLE_HOME: Record<Role, string> = {
  customer: "/app",
  partner: "/partner",
  rider: "/rider",
  admin: "/admin",
};

function detectRole(email: string): Role {
  const e = email.toLowerCase();
  if (e.includes("admin"))   return "admin";
  if (e.includes("partner") || e.includes("restaurant")) return "partner";
  if (e.includes("rider")   || e.includes("driver"))     return "rider";
  return "customer";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  }, [user, loading]);

  const signIn: AuthCtx["signIn"] = async (email, _password, role) => {
    await new Promise((r) => setTimeout(r, 400));
    if (!email.trim()) return { ok: false, message: "Enter your email" };
    const inferred = role ?? DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase().trim())?.role ?? detectRole(email);
    const next: User = DEMO_USERS.find((u) => u.role === inferred) ?? {
      id: `u_${Math.random().toString(36).slice(2, 8)}`,
      name: email.split("@")[0],
      email,
      phone: "",
      role: inferred,
    };
    setUser(next);
    return { ok: true, user: next };
  };

  const signUp: AuthCtx["signUp"] = async ({ name, email, phone, role }) => {
    await new Promise((r) => setTimeout(r, 500));
    if (!email.trim() || !name.trim()) return { ok: false, message: "Name and email are required" };
    const next: User = { id: `u_${Math.random().toString(36).slice(2, 8)}`, name, email, phone, role };
    setUser(next);
    return { ok: true, user: next };
  };

  const signOut = () => setUser(null);

  const resetPassword: AuthCtx["resetPassword"] = async (email) => {
    await new Promise((r) => setTimeout(r, 400));
    if (!email.trim()) return { ok: false, message: "Enter your email" };
    return { ok: true, message: "Reset link sent — check your inbox" };
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
