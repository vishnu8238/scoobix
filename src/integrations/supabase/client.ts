import { createClient } from "@insforge/sdk";

// Authoritative InsForge configuration
export const INSFORGE_URL = (import.meta as any).env.VITE_INSFORGE_URL || "https://awvs3seh.us-east.insforge.app";
export const INSFORGE_ANON_KEY = (import.meta as any).env.VITE_INSFORGE_ANON_KEY || "sb_publishable_FIPSldMe55J2LJ_hczRqag_orYaOaTT";

// Provide a Supabase-compatible client export that actually uses InsForge
// to satisfy legacy imports while adhering to the Supabase-free constraint.
if (!(globalThis as any).__INSFORGE_CLIENT__) {
  (globalThis as any).__INSFORGE_CLIENT__ = createClient({
    baseUrl: INSFORGE_URL,
    anonKey: INSFORGE_ANON_KEY,
    auth: {
      detectOAuthCallback: true
    }
  });
}

export const supabase = (globalThis as any).__INSFORGE_CLIENT__;
export const insforge = (globalThis as any).__INSFORGE_CLIENT__;
