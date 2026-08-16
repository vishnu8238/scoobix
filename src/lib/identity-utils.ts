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
    
    // Explicitly forbidden generic terms as full strings (case-insensitive)
    const forbidden = ['user', 'us', 'unknown', 'guest', 'anonymous', 'null', 'undefined', 'administrator', 'logistics staff', 'merchant manager', 'logistics', 'm'];
    if (forbidden.includes(n)) return null;

    // If it looks like an email, it's not a real name
    if (n.includes('@')) return null;

    return cleaned;
  };

  /**
   * Helper to resolve the best name from an entity (user or manager)
   * while rejecting generic placeholders.
   */
  const resolve = (entity: any): string | null => {
    if (!entity) return null;
    
    // Check direct name fields first
    const directNames = [
      entity.display_name,
      entity.full_name,
      entity.name,
      entity.first_name && entity.last_name 
          ? `${entity.first_name} ${entity.last_name}` 
          : entity.first_name || entity.last_name,
    ];

    for (const val of directNames) {
      const res = normalize(val);
      if (res) return res;
    }

    // Check nested metadata
    if (entity.user_metadata) {
      const metaNames = [
        entity.user_metadata.full_name,
        entity.user_metadata.name,
        entity.user_metadata.display_name,
        entity.user_metadata.given_name && entity.user_metadata.family_name 
            ? `${entity.user_metadata.given_name} ${entity.user_metadata.family_name}` 
            : entity.user_metadata.given_name || entity.user_metadata.family_name,
      ];
      for (const val of metaNames) {
        const res = normalize(val);
        if (res) return res;
      }
    }

    // Check identities
    if (entity.identities) {
      for (const identity of entity.identities) {
        const data = identity.identity_data;
        if (!data) continue;
        const identityNames = [
          data.full_name,
          data.name,
          data.given_name && data.family_name ? `${data.given_name} ${data.family_name}` : data.given_name || data.family_name
        ];
        for (const val of identityNames) {
          const res = normalize(val);
          if (res) return res;
        }
      }
    }

    return null;
  };

  // Authoritative identity resolution order:
  // 1. Authenticated User object (metadata, profile, etc.)
  const userResolved = resolve(user) || resolve(user.profile);
  if (userResolved) return userResolved;

  // 2. Manager record (if generic values were passed in, resolve() will filter them)
  const managerResolved = resolve(user.manager);
  if (managerResolved) return managerResolved;

  // 3. Fallback: Human-readable name from email
  const email = user.email || user.user_metadata?.email || user.profile?.email || 
                user.identities?.find((i: any) => i.identity_data?.email)?.identity_data?.email ||
                user.manager?.email;
  
  if (email && typeof email === 'string' && email.includes('@')) {
    const prefix = email.split('@')[0];
    const humanName = prefix
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    
    const res = normalize(humanName);
    if (res) return res;
    return humanName;
  }

  return "";
}

/**
 * Returns the final authoritative display name for the Manager portal, 
 * explicitly rejecting generic fallbacks like "User" or "M".
 */
export function getManagerDisplayName(user: any, manager?: any): string {
  const name = getDisplayName(user) || (manager ? getDisplayName({ ...user, manager }) : "");
  const forbidden = ['user', 'us', 'merchant manager', 'scoobix manager', 'unknown', 'm'];
  if (!name || forbidden.includes(name.toLowerCase())) {
    // If somehow we still have a generic name, force the email fallback
    const email = user?.email || manager?.email;
    if (email && email.includes('@')) {
      const prefix = email.split('@')[0];
      return prefix
        .split(/[._-]/)
        .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    return "Scoobix Manager";
  }
  return name;
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
