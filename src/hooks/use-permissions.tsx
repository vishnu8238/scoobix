/**
 * React access to the permission matrix.
 *
 * `usePermissions()` resolves the signed-in user's effective role (including the
 * support / super-admin elevations) plus any per-user overrides, and exposes
 * `can()` for UI affordances. Route-level protection still belongs to RoleGuard;
 * this is for hiding actions the current account may not perform.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import {
  PERMISSION_MATRIX, ROLE_LABEL, resolveEntitlements,
  type Entitlements, type Permission, type SecurityRole,
} from "@/lib/permissions";

export type PermissionsState = {
  ready: boolean;
  role: SecurityRole;
  roleLabel: string;
  permissions: Permission[];
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isSupport: boolean;
  refresh: () => void;
};

export function usePermissions(): PermissionsState {
  const { user } = useAuth();
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!user?.id) { setEnt(null); return; }
    void resolveEntitlements(user.id, user.role)
      .then((next) => { if (alive) setEnt(next); })
      .catch(() => { if (alive) setEnt(null); });
    return () => { alive = false; };
  }, [user?.id, user?.role, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return useMemo(() => {
    // Before resolution completes, fall back to the base matrix for the UI role
    // so buttons don't flicker from disabled to enabled.
    const role: SecurityRole = ent?.role ?? ((user?.role as SecurityRole) ?? "customer");
    const list = ent ? [...ent.permissions] : (PERMISSION_MATRIX[role] ?? []);
    const set = new Set(list);
    return {
      ready: Boolean(ent),
      role,
      roleLabel: ROLE_LABEL[role] ?? role,
      permissions: list,
      can: (p: Permission) => set.has(p),
      canAny: (ps: Permission[]) => ps.some((p) => set.has(p)),
      canAll: (ps: Permission[]) => ps.every((p) => set.has(p)),
      isAdmin: role === "admin" || role === "super_admin",
      isSuperAdmin: role === "super_admin",
      isSupport: role === "support",
      refresh,
    };
  }, [ent, user?.role, refresh]);
}

/** Render children only when the current account holds the permission. */
export function PermissionGate({
  permission,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: Permission;
  anyOf?: Permission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const perms = usePermissions();
  const allowed = permission ? perms.can(permission) : anyOf ? perms.canAny(anyOf) : true;
  return <>{allowed ? children : fallback}</>;
}
