import type { Role } from "./types";

/**
 * Last visited in-app route, persisted per role so a refresh or cold start
 * returns to the exact screen the user left (never a different app).
 */
const KEY = "scoobix_last_route_v1";

const ROLE_PREFIX: Record<Role, string> = {
  customer: "/app",
  partner: "/partner",
  rider: "/rider",
  admin: "/admin",
  manager: "/manager",
};

function roleForPath(path: string): Role | null {
  const entry = (Object.entries(ROLE_PREFIX) as [Role, string][]).find(
    ([, prefix]) => path === prefix || path.startsWith(`${prefix}/`),
  );
  return entry ? entry[0] : null;
}

/** Store a route only when it belongs to one of the four app surfaces. */
export function writeLastRoute(href: string) {
  if (typeof window === "undefined") return;
  const path = href.split("#")[0];
  const role = roleForPath(path.split("?")[0]);
  if (!role) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ role, href: path }));
  } catch { /* */ }
}

/** Last route for this role, or null when nothing usable is stored. */
export function readLastRoute(role: Role | null | undefined): string | null {
  if (typeof window === "undefined" || !role) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role?: Role; href?: string };
    if (parsed?.role !== role || typeof parsed.href !== "string") return null;
    return roleForPath(parsed.href.split("?")[0]) === role ? parsed.href : null;
  } catch { return null; }
}

export function clearLastRoute() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY); } catch { /* */ }
}
