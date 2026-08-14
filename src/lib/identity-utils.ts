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
    // Filter out common generic placeholders and email prefixes that are not real names
    return (
      !n || 
      n === 'user' || 
      n === 'null' || 
      n === 'undefined' || 
      n === 'manager' || 
      n === 'admin' || 
      n === 'partner' || 
      n === 'rider' || 
      n === 'scoobix' || 
      n === 'scoobix.info' ||
      n.includes('merchant manager') ||
      n.includes('administrator')
    );
  };

  const normalize = (val: any): string | null => {
    if (typeof val !== 'string') return null;
    const cleaned = val.trim();
    return isGeneric(cleaned) ? null : cleaned;
  };

  // 1. Deep search through every known InsForge/Google source
  // We prioritize: Table Profile Name > Nested Metadata/Social Profile > Top-level fields
  const candidates = [
    // Table Profile Name (if passed in the merged object)
    { val: user.name, src: 'profile_table.name' },
    
    // InsForge Nested Social Profile (Common for Google OAuth)
    { val: user.profile?.full_name, src: 'profile.full_name' },
    { val: user.profile?.name, src: 'profile.name' },
    { val: user.profile?.display_name, src: 'profile.display_name' },
    { val: user.profile?.first_name && user.profile?.last_name ? `${user.profile.first_name} ${user.profile.last_name}` : user.profile?.first_name, src: 'profile.names' },
    
    // InsForge User Metadata / Identities
    { val: user.user_metadata?.full_name, src: 'metadata.full_name' },
    { val: user.user_metadata?.name, src: 'metadata.name' },
    { val: user.user_metadata?.display_name, src: 'metadata.display_name' },
    { val: user.metadata?.full_name, src: 'raw_metadata.full_name' },
    { val: user.metadata?.name, src: 'raw_metadata.name' },
    
    // Check identities array (common in social logins)
    { val: user.identities?.[0]?.identity_data?.full_name, src: 'identity.full_name' },
    { val: user.identities?.[0]?.identity_data?.name, src: 'identity.name' },

    // Top-level / Fallback fields
    { val: user.full_name, src: 'top.full_name' },
    { val: user.display_name, src: 'top.display_name' },
    { val: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name, src: 'top.names' },
  ];

  for (const { val, src } of candidates) {
    const res = normalize(val);
    if (res) return res;
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
