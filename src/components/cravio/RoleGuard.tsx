import React, { ReactNode } from "react";

/**
 * SCOOBIX — ROLE GUARD RESET
 * Temporary pass-through during the authentication reset phase.
 */

interface RoleGuardProps {
  allow?: any;
  children: ReactNode;
  loading?: ReactNode;
  fallback?: ReactNode;
  transitionLabel?: string;
}

export function RoleGuard({ children }: RoleGuardProps) {
  return <>{children}</>;
}
