/**
 * TEMPORARY development-only Portal Preview Mode.
 *
 * Enabled ONLY when BOTH are true:
 *   - the app runs on the Vite dev server (import.meta.env.DEV) — production builds hard-code this to false
 *   - VITE_ENABLE_PORTAL_PREVIEW_MODE === "true"
 *
 * It simulates a portal identity in the frontend only (routing/guards). It never creates an
 * InsForge session, never sends tokens, and all writes are blocked in insforge-crud.
 * Remove `.env.development.local` (or set the flag to false) to restore normal behaviour.
 */
export const PREVIEW_MODE_ENABLED: boolean =
  import.meta.env.DEV === true &&
  (import.meta.env as any).VITE_ENABLE_PORTAL_PREVIEW_MODE === "true";

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
