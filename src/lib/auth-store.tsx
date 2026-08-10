import { createContext, useContext, ReactNode } from "react";

/**
 * SCOOBIX — APPLICATION AUTH RESET
 * Minimal business-role provider for the current unauthenticated state.
 */

export type Role = "customer" | "partner" | "rider" | "admin" | "manager";

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  role: Role;
  roles: Role[];
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const getRequestedPortal = () => null;

const GUEST_USER: User = {
  id: "guest-user",
  name: "Guest",
  email: "guest@scoobix.app",
  phone: "",
  avatar: "",
  role: "customer",
  roles: ["customer", "partner", "rider", "admin", "manager"]
};

const AuthContext = createContext<AuthCtx>({
  user: GUEST_USER,
  loading: false,
  login: async () => {},
  logout: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{
      user: GUEST_USER,
      loading: false,
      login: async () => {},
      logout: async () => {},
      signOut: async () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
