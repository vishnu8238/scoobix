import { createContext, useContext, ReactNode } from "react";

// The authentication system has been removed. 
// This is a minimal stub to prevent build errors.

export type Role = "customer" | "partner" | "rider" | "admin" | "manager";

export type User = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: { id: "guest", name: "Guest User", email: "guest@example.com", roles: ["customer", "partner", "rider", "admin", "manager"] },
  loading: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{
      user: { id: "guest", name: "Guest User", email: "guest@example.com", roles: ["customer", "partner", "rider", "admin", "manager"] },
      loading: false,
      login: async () => {},
      logout: async () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
