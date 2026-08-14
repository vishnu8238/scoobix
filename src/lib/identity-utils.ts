import { User } from "./auth-store";

/**
 * Derives a robust display name from the User object.
 * Priority: full_name -> name -> email prefix -> "User"
 */
export function getDisplayName(user: User | null | any): string {
  if (!user) return "";
  
  // If user is from AuthStore (User type)
  if ('name' in user && user.name) {
    return user.name;
  }

  // If user is a raw InsForge user object or profile
  // Priority: full_name -> name -> display_name -> first_name + last_name
  let name = user.full_name || user.name || user.display_name;
  
  if (!name && user.first_name) {
    name = user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name;
  }

  if (name) return name;
  
  // Fallback to email prefix
  const email = user.email || (typeof user.auth?.email === 'string' ? user.auth.email : null);
  if (email) {
    return email.split('@')[0];
  }
  
  return "";
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
