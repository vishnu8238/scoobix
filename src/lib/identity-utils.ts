import { User } from "./auth-store";

/**
 * Derives a robust display name from the User object.
 * Priority: full_name -> name -> email prefix -> "User"
 */
export function getDisplayName(user: User | null | any): string {
  if (!user) return "User";
  
  // 1. Check for name in our AuthStore User object
  // If it's the literal string "User", we treat it as a missing name and try to resolve better.
  if (typeof user === 'object' && 'name' in user && user.name && user.name !== "User") {
    return user.name;
  }

  // 2. Resolve from raw InsForge user object or profile
  // Priority: full_name -> name -> display_name -> first_name + last_name
  let name = user.full_name || user.name || user.display_name;
  
  if (!name && user.first_name) {
    name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
  }

  if (name && name !== "User") return name;
  
  // 3. Fallback to email prefix (most descriptive unique ID we have)
  const email = user.email || (user.auth && typeof user.auth.email === 'string' ? user.auth.email : null);
  if (email) {
    const prefix = email.split('@')[0];
    if (prefix) return prefix;
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
