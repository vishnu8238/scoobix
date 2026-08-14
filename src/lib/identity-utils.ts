import { User } from "./auth-store";

/**
 * Derives a robust display name from the User object or raw InsForge response.
 * Handles nested profiles, metadata, and auth fields recursively.
 */
export function getDisplayName(user: any): string {
  if (!user) return "";

  const isGeneric = (name: any) => {
    if (typeof name !== 'string') return true;
    const n = name.trim().toLowerCase();
    
    // Explicitly check for generic strings and substrings
    const genericTerms = [
      'user', 'merchant manager', 'administrator', 'admin', 'operator',
      'partner', 'rider', 'logistics', 'customer', 'unknown', 'scoobix',
      'anonymous', 'guest'
    ];

    if (genericTerms.includes(n)) return true;
    if (n === 'scoobix.info') return true;
    if (n === 'scoobix.v') return true;

    // Filter out common generic placeholders and email prefixes that are not real names
    return (
      !n || 
      n === 'null' || 
      n === 'undefined' || 
      n.startsWith('scoobix.') ||
      n.includes('@')
    );
  };

  const normalize = (val: any): string | null => {
    if (typeof val !== 'string') return null;
    const cleaned = val.trim().replace(/\s+/g, ' '); // Normalize whitespace
    
    if (!cleaned) return null;

    // Prevent name fields from just repeating the generic email
    const lower = cleaned.toLowerCase();
    if (lower.includes('scoobix.info')) return null;
    if (lower.includes('scoobix.v')) return null;
    
    return isGeneric(cleaned) ? null : cleaned;
  };

  // Authoritative identity resolution order (strict requirements)
  const candidates = [
    // 1. InsForge profile fields from the database (highest priority)
    { val: user.profile?.display_name, src: 'profile.display_name' },
    { val: user.profile?.full_name, src: 'profile.full_name' },
    { val: user.profile?.name, src: 'profile.name' },
    { val: user.profile?.first_name && user.profile?.last_name 
        ? `${user.profile.first_name} ${user.profile.last_name}` 
        : user.profile?.first_name || user.profile?.last_name || null, src: 'profile.name_parts' },
    
    // 2. InsForge auth user metadata
    { val: user.user_metadata?.full_name, src: 'metadata.full_name' },
    { val: user.user_metadata?.name, src: 'metadata.name' },
    { val: user.user_metadata?.display_name, src: 'metadata.display_name' },
    { val: user.user_metadata?.given_name && user.user_metadata?.family_name 
        ? `${user.user_metadata.given_name} ${user.user_metadata.family_name}` 
        : user.user_metadata?.given_name || user.user_metadata?.family_name || null, src: 'metadata.name_parts' },
    
    // 3. OAuth identity payload / provider_data (Direct Google mapping)
    { val: user.identities?.find((i: any) => i.identity_data?.full_name)?.identity_data?.full_name, src: 'identity.full_name' },
    { val: user.identities?.find((i: any) => i.identity_data?.name)?.identity_data?.name, src: 'identity.name' },
    { val: user.identities?.find((i: any) => i.identity_data?.given_name)?.identity_data?.given_name && 
      user.identities?.find((i: any) => i.identity_data?.family_name)?.identity_data?.family_name 
        ? `${user.identities.find((i: any) => i.identity_data?.given_name).identity_data.given_name} ${user.identities.find((i: any) => i.identity_data?.family_name).identity_data.family_name}` 
        : null, src: 'identity.name_parts' },
    
    // Legacy/Alternative metadata locations
    { val: user.provider_metadata?.full_name, src: 'provider_metadata.full_name' },
    { val: user.provider_metadata?.name, src: 'provider_metadata.name' },
  ];

  for (const { val, src } of candidates) {
    const res = normalize(val);
    if (res) {
      if (typeof window !== "undefined" && (window as any).DIAGNOSE_IDENTITY) {
        console.log(`[IDENTITY_DIAGNOSTIC] Name Resolved | Source: ${src} | Name: ${res}`);
      }
      return res;
    }
  }

  // 4. Last resort: non-empty email prefix
  const email = user.email || user.user_metadata?.email || user.profile?.email || 
                user.identities?.find((i: any) => i.identity_data?.email)?.identity_data?.email;
  
  if (email && typeof email === 'string' && email.includes('@')) {
    const prefix = email.split('@')[0];
    const res = normalize(prefix);
    if (res) return res;
  }

  return "";
}

/**
 * Derives initials from a name (max 2 chars).
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const cleaned = getDisplayName({ name }).replace(/[^a-zA-Z\s]/g, '');
  const parts = cleaned.split(' ').filter(n => n.length > 0);
  
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
