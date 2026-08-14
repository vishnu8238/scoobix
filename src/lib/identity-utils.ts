import { User } from "./auth-store";

/**
 * Derives a robust display name from the User object or raw InsForge response.
 * Handles nested profiles, metadata, and auth fields recursively.
 */
export function getDisplayName(user: any): string {
  if (!user) return "User";

  const isGeneric = (name: any) => {
    if (typeof name !== 'string') return true;
    const n = name.trim().toLowerCase();
    
    // Explicitly check for generic strings and substrings
    if (n === 'user') return true;
    if (n === 'merchant manager') return true;
    if (n === 'administrator') return true;
    if (n === 'scoobix') return true;
    if (n === 'scoobix.info') return true;
    if (n === 'scoobix.v') return true;

    // Filter out common generic placeholders and email prefixes that are not real names
    return (
      !n || 
      n === 'null' || 
      n === 'undefined' || 
      n === 'manager' || 
      n === 'admin' || 
      n === 'partner' || 
      n === 'rider' || 
      n.startsWith('scoobix.') ||
      n === 'merchant manager' ||
      n === 'administrator'
    );
  };

  const normalize = (val: any): string | null => {
    if (typeof val !== 'string') return null;
    const cleaned = val.trim();
    
    // If it's the literal string "User", reject it
    if (cleaned.toLowerCase() === 'user') return null;

    // Prevent name fields from just repeating the generic email
    if (cleaned.toLowerCase().includes('scoobix.info')) return null;
    if (cleaned.toLowerCase().includes('scoobix.v')) return null;
    
    return isGeneric(cleaned) ? null : cleaned;
  };

  // 1. Authoritative metadata sources from Google/InsForge OAuth
  // Priority: Provider (Direct Google) > Social Identities > SDK User Metadata > DB Profile Row
  const candidates = [
    // 1. provider_metadata (Highest authority - injected from Google OAuth)
    { val: user.provider_metadata?.name, src: 'provider_metadata.name' },
    { val: user.provider_metadata?.full_name, src: 'provider_metadata.full_name' },
    { val: user.provider_metadata?.display_name, src: 'provider_metadata.display_name' },

    // 2. identities array (Direct provider mapping from SDK)
    { val: user.identities?.[0]?.identity_data?.full_name, src: 'identity.full_name' },
    { val: user.identities?.[0]?.identity_data?.name, src: 'identity.name' },
    { val: user.identities?.[0]?.identity_data?.display_name, src: 'identity.display_name' },
    { val: user.identities?.[0]?.identity_data?.custom_claims?.name, src: 'identity.claims.name' },

    // 3. user_metadata (Merged social profile from SDK)
    { val: user.user_metadata?.full_name, src: 'metadata.full_name' },
    { val: user.user_metadata?.name, src: 'metadata.name' },
    { val: user.user_metadata?.display_name, src: 'metadata.display_name' },

    // 4. DB Profile row fields (fetched from public.users/profiles table)
    { val: user.full_name, src: 'db.full_name' },
    { val: user.display_name, src: 'db.display_name' },
    { val: user.name, src: 'db.name' },
    
    // 5. SDK Profile (user.profile is common in SDK response)
    { val: user.profile?.full_name, src: 'profile.full_name' },
    { val: user.profile?.name, src: 'profile.name' },
    { val: user.profile?.display_name, src: 'profile.display_name' },
  ];

  for (const { val, src } of candidates) {
    const res = normalize(val);
    if (res) {
      if (typeof window !== "undefined") {
        // Safe production diagnostic: only source and boolean check
        const isDev = (import.meta as any).env?.DEV;
        if (isDev || (window as any).DIAGNOSE_IDENTITY) {
          console.log(`[IDENTITY_DIAGNOSTIC] Name Resolved | Source: ${src} | Valid: true`);
        }
      }
      return res;
    }
  }

  // 2. Fallback to Email Prefix (last resort before "User")
  const email = user.email || user.user_metadata?.email || user.profile?.email || user.identities?.[0]?.identity_data?.email;
  if (email && typeof email === 'string') {
    const prefix = email.split('@')[0];
    const res = normalize(prefix);
    if (res) return res;
  }

  return "User";
}

/**
 * Derives initials from a name (max 2 chars).
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
