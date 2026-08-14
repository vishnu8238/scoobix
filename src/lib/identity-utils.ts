import { User } from "./auth-store";

/**
 * Derives a robust display name from the User object.
 * Priority: full_name -> name -> email prefix -> "User"
 */
export function getDisplayName(user: User | null | any): string {
  if (!user) return "User";
  
  // If user is from AuthStore (User type)
  if ('name' in user && user.name && user.name !== "User") {
    return user.name;
  }

  // If user is a raw InsForge user object
  const name = user.full_name || user.name || user.display_name;
  if (name && name !== "User") return name;
  
  // Fallback to email prefix
  if (user.email) {
    return user.email.split('@')[0];
  }
  
  return "User";
}

/**
 * Derives initials from a name (max 2 chars).
 */
export function getInitials(name: string | null | undefined): string {
  if (!name || name === "User") return "U";
  return name
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
