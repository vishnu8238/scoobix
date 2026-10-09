/**
 * TEMPORARY Portal Preview Mode (frontend-only identity simulation).
 *
 * Enabled ONLY when BOTH are true:
 *   - PORTAL_PREVIEW_FLAG below is true (or VITE_ENABLE_PORTAL_PREVIEW_MODE === "true")
 *   - the page runs in a verified non-production environment: the Vite dev server, localhost,
 *     or a Lovable editor preview host (id-preview--*.lovable.app / *.lovableproject.com).
 *     Any other host — including the published site and custom domains — fails closed.
 *
 * It never creates an InsForge session, never sends tokens, and all writes are blocked in insforge-crud.
 * Set PORTAL_PREVIEW_FLAG to false to restore normal behaviour completely.
 */
function isVerifiedPreviewHost(): boolean {
  if (typeof window === "undefined") return false; // SSR: fail closed
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    /^id-preview--[a-z0-9-]+\.lovable\.app$/i.test(h) ||
    /\.lovableproject\.com$/i.test(h)
  );
}

/** TEMPORARY switch. Set to false to disable Preview Mode everywhere. */
const PORTAL_PREVIEW_FLAG = true;

export const PREVIEW_MODE_ENABLED: boolean =
  (PORTAL_PREVIEW_FLAG || (import.meta.env as any).VITE_ENABLE_PORTAL_PREVIEW_MODE === "true") &&
  (import.meta.env.DEV === true ? typeof window !== "undefined" : isVerifiedPreviewHost());

export const PREVIEW_USER_ID = "preview-unauthenticated";
export const PREVIEW_BLOCKED_MESSAGE = "Sign in with an authorized account to perform this action.";

export const PREVIEW_PORTALS = [
  { id: "customer", label: "Customer", path: "/app" },
  { id: "partner", label: "Restaurant Partner", path: "/partner" },
  { id: "rider", label: "Rider", path: "/rider" },
  { id: "manager", label: "Merchant Manager", path: "/manager" },
  { id: "admin", label: "Master Admin", path: "/admin" },
  { id: "logistics", label: "Logistics", path: "/logistics" },
] as const;

/** True while a simulated (non-authenticated) preview identity is active. */
let previewIdentityActive = false;
export function setPreviewIdentityActive(v: boolean) {
  previewIdentityActive = PREVIEW_MODE_ENABLED && v;
}
export function isPreviewIdentityActive() {
  return previewIdentityActive;
}

/** Throws for any backend mutation attempted by a simulated preview identity. */
export function assertNotPreviewMutation() {
  if (previewIdentityActive) throw new Error(PREVIEW_BLOCKED_MESSAGE);
}
