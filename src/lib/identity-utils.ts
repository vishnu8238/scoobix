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
    
    // Explicitly check for generic strings
    if (n === 'user') return true;
    if (n === 'merchant manager') return true;
    if (n === 'administrator') return true;

    // Filter out common generic placeholders and email prefixes that are not real names
    return (
      !n || 
      n === 'null' || 
      n === 'undefined' || 
      n === 'manager' || 
      n === 'admin' || 
      n === 'partner' || 
      n === 'rider' || 
      n === 'scoobix' || 
      n === 'scoobix.info' ||
      n === 'scoobix.v' ||
      n.startsWith('scoobix.') ||
      n.includes('merchant manager') ||
      n.includes('administrator')
    );
  };

  const normalize = (val: any): string | null => {
    if (typeof val !== 'string') return null;
    const cleaned = val.trim();
    
    // If it's the literal string "User", reject it
    if (cleaned.toLowerCase() === 'user') return null;

    // Prevent name fields from just repeating the generic email
    if (cleaned.toLowerCase().includes('scoobix.info')) return null;
    
    return isGeneric(cleaned) ? null : cleaned;
  };

  // 1. Authoritative metadata sources from Google/InsForge OAuth
  // We prioritize: provider_metadata > user_metadata > identities > profile (from SDK) > profile (from table)
  const candidates = [
    // 1. provider_metadata (Highest authority for provider-specific fields like 'name')
    { val: user.provider_metadata?.name, src: 'provider_metadata.name' },
    { val: user.provider_metadata?.full_name, src: 'provider_metadata.full_name' },
    { val: user.provider_metadata?.display_name, src: 'provider_metadata.display_name' },

    // 2. identities array (Direct provider mapping)
    { val: user.identities?.[0]?.identity_data?.full_name, src: 'identity.full_name' },
    { val: user.identities?.[0]?.identity_data?.name, src: 'identity.name' },
    { val: user.identities?.[0]?.identity_data?.custom_claims?.name, src: 'identity.claims.name' },

    // 3. user_metadata (Merged social profile)
    { val: user.user_metadata?.full_name, src: 'metadata.full_name' },
    { val: user.user_metadata?.name, src: 'metadata.name' },
    { val: user.user_metadata?.display_name, src: 'metadata.display_name' },

    // 4. InsForge Nested Social Profile (user.profile is common in SDK response)
    { val: user.profile?.full_name, src: 'profile.full_name' },
    { val: user.profile?.name, src: 'profile.name' },
    { val: user.profile?.display_name, src: 'profile.display_name' },
    { val: user.profile?.first_name && user.profile?.last_name ? `${user.profile.first_name} ${user.profile.last_name}` : user.profile?.first_name, src: 'profile.names' },
    
    // 5. Database Profile row fields
    { val: user.full_name, src: 'db.full_name' },
    { val: user.display_name, src: 'db.display_name' },
    { val: user.name, src: 'db.name' },
  ];

  for (const { val, src } of candidates) {
    const res = normalize(val);
    if (res) {
      if (typeof window !== "undefined") {
        // Safe development diagnostic
        const isDev = (import.meta as any).env?.DEV;
        if (isDev || (window as any).DIAGNOSE_IDENTITY) {
          console.log(`[IDENTITY_DIAGNOSTIC] Resolved: "${res}" | Source: ${src}`);
        }
      }
      return res;
    }
  }

  // 2. Fallback to Email Prefix (last resort before role/generic)
  const email = user.email || user.auth?.email || user.user_metadata?.email || user.profile?.email || user.identities?.[0]?.identity_data?.email;
  if (email && typeof email === 'string') {
    const prefix = email.split('@')[0];
    const res = normalize(prefix);
    if (res) return res;
  }

  return "User";
}

  // 2. Fallback to Email Prefix (last resort before "User")
  const email = user.email || user.auth?.email || user.user_metadata?.email || user.profile?.email || user.identities?.[0]?.identity_data?.email;
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
