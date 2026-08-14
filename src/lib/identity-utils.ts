import { User } from "./auth-store";

/**
 * Derives a robust display name from the User object or raw InsForge response.
 * Handles nested profiles, metadata, and auth fields recursively.
 */
export function getDisplayName(user: any): string {
  if (!user) return "User";

  // Diagnostic logging for development (filtered in production by logger)
  const trace = (val: string, source: string) => {
    if (val && !isGeneric(val)) {
      // console.log(`[IDENTITY_TRACE] Resolved "${val}" from ${source}`);
      return val;
    }
    return null;
  };

  const isGeneric = (name: any) => {
    if (typeof name !== 'string') return true;
    const n = name.trim().toLowerCase();
    return !n || n === 'user' || n === 'null' || n === 'undefined' || n === 'manager' || n === 'admin' || n === 'partner' || n === 'rider';
  };

  const normalize = (val: any): string | null => {
    if (typeof val !== 'string') return null;
    const cleaned = val.trim();
    return isGeneric(cleaned) ? null : cleaned;
  };

  // 1. Try explicit profile/user_metadata/metadata/auth fields
  const candidates = [
    // Direct or AuthStore flattened fields
    { val: user.name, src: 'top.name' },
    { val: user.full_name, src: 'top.full_name' },
    { val: user.display_name, src: 'top.display_name' },
    
    // InsForge Nested Profile (Common for Google/Social)
    { val: user.profile?.full_name, src: 'profile.full_name' },
    { val: user.profile?.name, src: 'profile.name' },
    { val: user.profile?.display_name, src: 'profile.display_name' },
    { val: user.profile?.first_name && user.profile?.last_name ? `${user.profile.first_name} ${user.profile.last_name}` : user.profile?.first_name, src: 'profile.names' },
    
    // InsForge User Metadata
    { val: user.user_metadata?.full_name, src: 'metadata.full_name' },
    { val: user.user_metadata?.name, src: 'metadata.name' },
    { val: user.user_metadata?.display_name, src: 'metadata.display_name' },
    { val: user.metadata?.full_name, src: 'raw_metadata.full_name' },
    { val: user.metadata?.name, src: 'raw_metadata.name' },

    // Top-level first/last
    { val: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name, src: 'top.names' },
  ];

  for (const { val, src } of candidates) {
    const res = normalize(val);
    if (res) return trace(res, src)!;
  }

  // 2. Fallback to Email Prefix
  const email = user.email || user.auth?.email || user.user_metadata?.email || user.profile?.email;
  if (email && typeof email === 'string') {
    const prefix = email.split('@')[0];
    const res = normalize(prefix);
    if (res) return trace(res, 'email_prefix')!;
  }

  // 3. Final fallback
  // console.log('[IDENTITY_TRACE] Resolution fell through to "User"', JSON.stringify({
  //   id: user.id,
  //   hasProfile: !!user.profile,
  //   hasMetadata: !!user.user_metadata,
  //   hasAuth: !!user.auth
  // }));
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
