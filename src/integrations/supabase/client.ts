import { createClient } from "@insforge/sdk";

// Stub for local dev / non-Lovable environments if needed, 
// though Lovable projects should always have these via Lovable Cloud
export const INSFORGE_URL = (import.meta as any).env.VITE_INSFORGE_URL || "https://awvs3seh.us-east.insforge.app";
export const INSFORGE_ANON_KEY = (import.meta as any).env.VITE_INSFORGE_ANON_KEY || "sb_publishable_FIPSldMe55J2LJ_hczRqag_orYaOaTT";

if (!(globalThis as any).__INSFORGE_CLIENT__) {
  (globalThis as any).__INSFORGE_CLIENT__ = createClient({
    baseUrl: INSFORGE_URL,
    anonKey: INSFORGE_ANON_KEY,
    auth: {
      detectOAuthCallback: true
    }
  });
}

export const insforge = (globalThis as any).__INSFORGE_CLIENT__;
