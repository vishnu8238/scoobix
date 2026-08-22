/**
 * Scoobix permission matrix (RBAC).
 *
 * A single source of truth for "who may do what". Every security-sensitive
 * helper funnels through `assertPermission` / `can`, so a screen, a button and
 * a data write all resolve the same answer.
 *
 * Roles
 *  customer | partner | rider | manager | support | admin | super_admin
 *
 * `support` and `super_admin` are elevations of the `admin` UI role, resolved
 * from the `platform_admins.level` column — the UI Role enum stays untouched.
 */
import { listTable } from "./insforge-crud";
import type { Role } from "./types";

export type SecurityRole = "customer" | "partner" | "rider" | "manager" | "support" | "admin" | "super_admin" | "logistics_admin" | "dispatcher" | "zone_manager";

export type Permission =
  // customer
  | "order.create" | "order.cancel" | "order.rate" | "wallet.use" | "coupon.redeem"
  | "referral.use" | "reward.redeem" | "membership.manage" | "address.manage"
  | "profile.manage" | "support.create" | "privacy.export" | "privacy.delete"
  // restaurant partner
  | "menu.manage" | "menu.price" | "order.accept" | "order.reject" | "offer.manage"
  | "restaurant.settings" | "restaurant.docs" | "restaurant.subscription" | "restaurant.analytics"
  // rider
  | "rider.online" | "delivery.accept" | "delivery.reject" | "delivery.pickup"
  | "delivery.complete" | "cod.collect" | "payout.request" | "rider.docs"
  // merchant manager
  | "lead.manage" | "restaurant.onboard" | "restaurant.verify" | "manager.targets"
  | "campaign.create" | "transfer.request"
  // support agent
  | "support.view.all" | "support.reply" | "support.assign" | "support.escalate" | "support.close"
  // admin
  | "restaurant.approve" | "rider.approve" | "manager.assign" | "coupon.manage"
  | "campaign.manage" | "wallet.adjust" | "refund.issue" | "subscription.manage"
  | "user.ban" | "user.restore" | "settings.manage" | "analytics.platform"
  | "audit.view" | "security.view" | "fraud.manage" | "session.revoke.any"
  // super admin only
  | "permission.override" | "admin.manage" | "db.maintenance" | "audit.archive"
  // logistics
  | "logistics.view" | "logistics.dispatch" | "logistics.settings" | "logistics.zones.manage" | "logistics.riders.manage" | "logistics.audit.view";

const CUSTOMER: Permission[] = [
  "order.create", "order.cancel", "order.rate", "wallet.use", "coupon.redeem",
  "referral.use", "reward.redeem", "membership.manage", "address.manage",
  "profile.manage", "support.create", "privacy.export", "privacy.delete",
];

const PARTNER: Permission[] = [
  "profile.manage", "support.create", "privacy.export",
  "menu.manage", "menu.price", "order.accept", "order.reject", "offer.manage",
  "restaurant.settings", "restaurant.docs", "restaurant.subscription", "restaurant.analytics",
  "coupon.manage", "campaign.create",
];

const RIDER: Permission[] = [
  "profile.manage", "support.create", "privacy.export",
  "rider.online", "delivery.accept", "delivery.reject", "delivery.pickup",
  "delivery.complete", "cod.collect", "payout.request", "rider.docs",
];

const MANAGER: Permission[] = [
  "profile.manage", "support.create", "privacy.export",
  "lead.manage", "restaurant.onboard", "restaurant.verify", "manager.targets",
  "campaign.create", "transfer.request", "support.reply", "support.escalate",
  "restaurant.analytics",
];

const SUPPORT: Permission[] = [
  "profile.manage", "support.create",
  "support.view.all", "support.reply", "support.assign", "support.escalate", "support.close",
  "audit.view", "security.view",
];

const ADMIN: Permission[] = [
  ...SUPPORT,
  "restaurant.approve", "rider.approve", "manager.assign", "coupon.manage",
  "campaign.manage", "wallet.adjust", "refund.issue", "subscription.manage",
  "user.ban", "user.restore", "settings.manage", "analytics.platform",
  "fraud.manage", "session.revoke.any", "restaurant.verify", "restaurant.analytics",
  "menu.manage", "offer.manage",
];

const SUPER_ADMIN: Permission[] = [
  ...ADMIN,
  "permission.override", "admin.manage", "db.maintenance", "audit.archive",
];

const DISPATCHER: Permission[] = [
  "profile.manage", "support.create", "privacy.export",
  "logistics.view", "logistics.dispatch", "logistics.riders.manage",
];

const ZONE_MANAGER: Permission[] = [
  "profile.manage", "support.create", "privacy.export",
  "logistics.view", "logistics.dispatch", "logistics.zones.manage", "logistics.riders.manage",
];

const LOGISTICS_ADMIN: Permission[] = [
  ...ZONE_MANAGER,
  "logistics.settings", "logistics.audit.view",
];

export const PERMISSION_MATRIX: Record<SecurityRole, Permission[]> = {
  customer: CUSTOMER,
  partner: PARTNER,
  rider: RIDER,
  manager: MANAGER,
  support: SUPPORT,
  admin: ADMIN,
  super_admin: SUPER_ADMIN,
  logistics_admin: LOGISTICS_ADMIN,
  dispatcher: DISPATCHER,
  zone_manager: ZONE_MANAGER,
};

export const ROLE_LABEL: Record<SecurityRole, string> = {
  customer: "Customer",
  partner: "Restaurant partner",
  rider: "Delivery rider",
  manager: "Merchant manager",
  support: "Support agent",
  admin: "Admin",
  super_admin: "Super admin",
  logistics_admin: "Logistics admin",
  dispatcher: "Dispatcher",
  zone_manager: "Zone manager",
};

/** Every permission, grouped for the admin matrix screen. */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: "Ordering", permissions: ["order.create", "order.cancel", "order.rate", "order.accept", "order.reject"] },
  { label: "Money", permissions: ["wallet.use", "wallet.adjust", "refund.issue", "cod.collect", "payout.request"] },
  { label: "Menu & offers", permissions: ["menu.manage", "menu.price", "offer.manage", "coupon.manage", "campaign.manage", "campaign.create"] },
  { label: "Delivery", permissions: ["rider.online", "delivery.accept", "delivery.reject", "delivery.pickup", "delivery.complete"] },
  { label: "Onboarding & KYC", permissions: ["lead.manage", "restaurant.onboard", "restaurant.verify", "restaurant.approve", "rider.approve", "restaurant.docs", "rider.docs"] },
  { label: "Support", permissions: ["support.create", "support.view.all", "support.reply", "support.assign", "support.escalate", "support.close"] },
  { label: "Platform", permissions: ["settings.manage", "subscription.manage", "manager.assign", "analytics.platform", "user.ban", "user.restore"] },
  { label: "Security", permissions: ["audit.view", "security.view", "fraud.manage", "session.revoke.any", "permission.override", "admin.manage", "db.maintenance", "audit.archive"] },
  { label: "Privacy", permissions: ["privacy.export", "privacy.delete", "profile.manage", "address.manage", "membership.manage"] },
  { label: "Logistics", permissions: ["logistics.view", "logistics.dispatch", "logistics.settings", "logistics.zones.manage", "logistics.riders.manage", "logistics.audit.view"] },
];

/* -------------------------------------------------- elevation resolution */

export type Elevation = { role: SecurityRole; level: string | null };

const elevationCache = new Map<string, { at: number; value: Elevation }>();
const ELEVATION_TTL = 5 * 60 * 1000;

/**
 * Resolve the effective security role for capabilities.
 * P0.1: This is a post-admission refinement only.
 * It NEVER appends a portal role or grants access if portal_access is missing.
 */
export async function resolveSecurityRole(
  userId: string | null | undefined,
  uiRole: Role | null | undefined,
): Promise<Elevation> {
  if (!uiRole) return { role: "customer", level: null };
  // Identity Resolution: Map to capability role without appending to portal roles.
  if (uiRole !== "admin" && uiRole !== "logistics") return { role: uiRole as SecurityRole, level: null };
  if (!userId) {
    if (uiRole === "logistics") return { role: "dispatcher", level: "dispatcher" };
    return { role: "support", level: "support" };
  }

  const hit = elevationCache.get(userId);
  if (hit && Date.now() - hit.at < ELEVATION_TTL) return hit.value;

  const table = uiRole === "logistics" ? "logistics_staff" : "platform_admins";
  const rows = await listTable<{ level?: string; status?: string; is_super_admin?: boolean }>(
    table,
    { select: "user_id,email,level,status", user_id: `eq.${userId}`, limit: 1 },
    { ttl: 120 },
  ).catch(() => []);

  const level = String(rows[0]?.level ?? (uiRole === "logistics" ? "dispatcher" : "admin")).toLowerCase();
  let role: SecurityRole;
  
  if (uiRole === "logistics") {
    role = level === "logistics_admin" ? "logistics_admin" : level === "zone_manager" ? "zone_manager" : "dispatcher";
  } else {
    role = level === "super_admin" ? "super_admin" : level === "support" ? "support" : "admin";
  }
  const value = { role, level };
  elevationCache.set(userId, { at: Date.now(), value });
  return value;
}

export function clearElevationCache(userId?: string) {
  if (userId) elevationCache.delete(userId);
  else elevationCache.clear();
}

/* ------------------------------------------------------------- overrides */

export type OverrideRow = {
  id: string; user_id?: string; permission?: string; effect?: string;
  active?: boolean; expires_at?: string; reason?: string; granted_by?: string; created_at?: string;
};

const overrideCache = new Map<string, { at: number; rows: OverrideRow[] }>();

export async function fetchOverrides(userId: string): Promise<OverrideRow[]> {
  const hit = overrideCache.get(userId);
  if (hit && Date.now() - hit.at < ELEVATION_TTL) return hit.rows;
  const rows = await listTable<OverrideRow>(
    "permission_overrides",
    { select: "id,user_id,permission,effect,active,expires_at,reason,granted_by,created_at", user_id: `eq.${userId}`, limit: 100 },
    { ttl: 120 },
  ).catch(() => []);
  const live = rows.filter(
    (r) => r.active !== false && (!r.expires_at || Date.parse(r.expires_at) > Date.now()),
  );
  overrideCache.set(userId, { at: Date.now(), rows: live });
  return live;
}

export function clearOverrideCache(userId?: string) {
  if (userId) overrideCache.delete(userId);
  else overrideCache.clear();
}

/* ---------------------------------------------------------- entitlements */

export type Entitlements = {
  userId: string | null;
  role: SecurityRole;
  permissions: Set<Permission>;
  can: (p: Permission) => boolean;
  canAny: (p: Permission[]) => boolean;
  canAll: (p: Permission[]) => boolean;
};

function build(userId: string | null, role: SecurityRole, overrides: OverrideRow[]): Entitlements {
  const set = new Set<Permission>(PERMISSION_MATRIX[role] ?? []);
  for (const o of overrides) {
    const p = o.permission as Permission | undefined;
    if (!p) continue;
    if (o.effect === "deny") set.delete(p);
    else set.add(p);
  }
  return {
    userId,
    role,
    permissions: set,
    can: (p) => set.has(p),
    canAny: (list) => list.some((p) => set.has(p)),
    canAll: (list) => list.every((p) => set.has(p)),
  };
}

/** Full entitlement resolution: base matrix + per-user overrides. */
export async function resolveEntitlements(
  userId: string | null | undefined,
  uiRole: Role | null | undefined,
): Promise<Entitlements> {
  const { role } = await resolveSecurityRole(userId, uiRole);
  const overrides = userId ? await fetchOverrides(userId) : [];
  return build(userId ?? null, role, overrides);
}

/** Synchronous check against the base matrix (no overrides). */
export function roleCan(role: SecurityRole, permission: Permission): boolean {
  return (PERMISSION_MATRIX[role] ?? []).includes(permission);
}

export class PermissionError extends Error {
  permission: Permission;
  constructor(permission: Permission) {
    super(`Not permitted: ${permission}`);
    this.name = "PermissionError";
    this.permission = permission;
  }
}

/**
 * Gate a sensitive operation. Throws `PermissionError` when the actor lacks the
 * permission, so callers cannot accidentally continue on a falsy check.
 */
export async function assertPermission(
  userId: string | null | undefined,
  uiRole: Role | null | undefined,
  permission: Permission,
): Promise<Entitlements> {
  const ent = await resolveEntitlements(userId, uiRole);
  if (!ent.can(permission)) throw new PermissionError(permission);
  return ent;
}

/** Non-throwing variant for UI affordances. */
export async function checkPermission(
  userId: string | null | undefined,
  uiRole: Role | null | undefined,
  permission: Permission,
): Promise<boolean> {
  const ent = await resolveEntitlements(userId, uiRole);
  return ent.can(permission);
}
