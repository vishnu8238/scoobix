import { User } from "./auth-store";

/**
 * Derives a robust display name from the User object or raw InsForge response.
 * Handles nested profiles, metadata, and auth fields recursively.
 */
export function getDisplayName(user: any): string {
  if (!user) return "";

  const normalize = (val: any): string | null => {
    if (typeof val !== 'string') return null;
    const cleaned = val.trim().replace(/\s+/g, ' '); // Normalize whitespace
    if (!cleaned) return null;

    const n = cleaned.toLowerCase();
    
    // Explicitly forbidden generic terms as full strings
    const forbidden = ['user', 'unknown', 'guest', 'anonymous', 'null', 'undefined', 'administrator', 'logistics staff', 'merchant manager', 'logistics'];
    if (forbidden.includes(n)) return null;

    // If it looks like an email, it's not a real name
    if (n.includes('@')) return null;

    return cleaned;
  };

  // Authoritative identity resolution order
  const candidates = [
    // 1. InsForge profile fields from the database (highest priority)
    user.profile?.display_name,
    user.profile?.full_name,
    user.profile?.name,
    user.profile?.first_name && user.profile?.last_name 
        ? `${user.profile.first_name} ${user.profile.last_name}` 
        : user.profile?.first_name || user.profile?.last_name,
    
    // 2. InsForge auth user metadata
    user.user_metadata?.full_name,
    user.user_metadata?.name,
    user.user_metadata?.display_name,
    user.user_metadata?.given_name && user.user_metadata?.family_name 
        ? `${user.user_metadata.given_name} ${user.user_metadata.family_name}` 
        : user.user_metadata?.given_name || user.user_metadata?.family_name,
    
    // 3. Existing Merchant Manager profile name (if resolving for manager portal)
    user.merchant_manager?.name,

    // 4. OAuth identity payload / provider_data
    user.identities?.find((i: any) => i.identity_data?.full_name)?.identity_data?.full_name,
    user.identities?.find((i: any) => i.identity_data?.name)?.identity_data?.name,
    user.identities?.find((i: any) => i.identity_data?.given_name)?.identity_data?.given_name && 
    user.identities?.find((i: any) => i.identity_data?.family_name)?.identity_data?.family_name 
        ? `${user.identities.find((i: any) => i.identity_data.given_name).identity_data.given_name} ${user.identities.find((i: any) => i.identity_data.family_name).identity_data.family_name}` 
        : null,
  ];

  for (const val of candidates) {
    const res = normalize(val);
    if (res) return res;
  }

  // 4. Fallback: Human-readable name from email (never literal "User")
  const email = user.email || user.user_metadata?.email || user.profile?.email || 
                user.identities?.find((i: any) => i.identity_data?.email)?.identity_data?.email;
  
  if (email && typeof email === 'string' && email.includes('@')) {
    const prefix = email.split('@')[0];
    // Convert "john.doe" or "john_doe" to "John Doe"
    const humanName = prefix
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    
    const res = normalize(humanName);
    if (res) return res;
    return humanName; // Return even if it fails normalize (last resort before empty)
  }

  return "";
}

/**
 * Derives initials from a name (max 2 chars).
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "";
  const cleaned = name.replace(/[^a-zA-Z\s]/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(n => n.length > 0);
  
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
