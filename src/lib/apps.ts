import type { Role } from "./types";

/**
 * Scoobix multi-application registry.
 *
 * Scoobix ships as four independent applications on one shared InsForge
 * backend. Each app owns its scope, manifest, launcher identity and deep
 * links. There is NO portal switcher — a signed-in user only ever sees the
 * surface that matches their role.
 */
export type AppId = "customer" | "partner" | "rider" | "admin";

export type ScoobixApp = {
  id: AppId;
  role: Role;
  /** Display name / launcher name */
  name: string;
  shortName: string;
  /** Android applicationId / iOS bundle id */
  applicationId: string;
  /** Route prefix owned by this app */
  scope: string;
  /** Landing route after sign-in */
  home: string;
  manifest: string;
  themeColor: string;
  /** Custom scheme used for deep links (scoobix-partner://orders/123) */
  deepLinkScheme: string;
  /** https deep-link host handled by this app */
  deepLinkHost: string;
  platform: "mobile" | "web";
};

export const APPS: Record<AppId, ScoobixApp> = {
  customer: {
    id: "customer",
    role: "customer",
    name: "Scoobix — Crave it. Get it.",
    shortName: "Scoobix",
    applicationId: "app.scoobix.customer",
    scope: "/app",
    home: "/app",
    manifest: "/manifest-customer.webmanifest",
    themeColor: "#28a156",
    deepLinkScheme: "scoobix",
    deepLinkHost: "scoobix.app",
    platform: "mobile",
  },
  partner: {
    id: "partner",
    role: "partner",
    name: "Scoobix Partner",
    shortName: "Partner",
    applicationId: "app.scoobix.partner",
    scope: "/partner",
    home: "/partner",
    manifest: "/manifest-partner.webmanifest",
    themeColor: "#b45309",
    deepLinkScheme: "scoobix-partner",
    deepLinkHost: "partner.scoobix.app",
    platform: "mobile",
  },
  rider: {
    id: "rider",
    role: "rider",
    name: "Scoobix Rider",
    shortName: "Rider",
    applicationId: "app.scoobix.rider",
    scope: "/rider",
    home: "/rider",
    manifest: "/manifest-rider.webmanifest",
    themeColor: "#0369a1",
    deepLinkScheme: "scoobix-rider",
    deepLinkHost: "rider.scoobix.app",
    platform: "mobile",
  },
  admin: {
    id: "admin",
    role: "admin",
    name: "Scoobix Admin Dashboard",
    shortName: "Scoobix Admin",
    applicationId: "app.scoobix.admin",
    scope: "/admin",
    home: "/admin",
    manifest: "/manifest-admin.webmanifest",
    themeColor: "#6d28d9",
    deepLinkScheme: "scoobix-admin",
    deepLinkHost: "admin.scoobix.app",
    platform: "web",
  },
};

export const APP_BY_ROLE: Record<Role, ScoobixApp> = {
  customer: APPS.customer,
  partner: APPS.partner,
  rider: APPS.rider,
  admin: APPS.admin,
};

export function appForPath(pathname: string): ScoobixApp | null {
  const match = Object.values(APPS).find(
    (a) => pathname === a.scope || pathname.startsWith(`${a.scope}/`),
  );
  return match ?? null;
}

/** Head <link>/<meta> block that binds a route subtree to its own app identity. */
export function appHead(app: ScoobixApp) {
  return {
    meta: [
      { title: app.name },
      { name: "application-name", content: app.shortName },
      { name: "apple-mobile-web-app-title", content: app.shortName },
      { name: "theme-color", content: app.themeColor },
    ],
    links: [{ rel: "manifest", href: app.manifest }],
  };
}
