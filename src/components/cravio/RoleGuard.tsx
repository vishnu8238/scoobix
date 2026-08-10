import React, { ReactNode } from "react";

// The RoleGuard has been removed.
// This is a minimal stub that renders children directly.

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
