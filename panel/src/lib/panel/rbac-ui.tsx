"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/context";
import {
  roleHasPermission,
  type PanelPermission,
  type PanelRole,
} from "@/lib/panel/permissions";
import { canViewAuditLog } from "@/lib/panel/audit-shared";

interface RbacGateProps {
  permission?: PanelPermission;
  roles?: PanelRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

/** Hide UI unless the current user has a permission or role. */
export function RbacGate({ permission, roles, children, fallback = null }: RbacGateProps) {
  const { user } = useAuth();
  if (!user) return fallback;

  if (permission && !roleHasPermission(user.role, permission)) return fallback;
  if (roles && !roles.includes(user.role)) return fallback;

  return <>{children}</>;
}

export function usePanelRole() {
  const { user } = useAuth();
  return user?.role ?? null;
}

export function useHasPanelPermission(permission: PanelPermission) {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

export function useCanViewAuditLog() {
  const role = usePanelRole();
  return role ? canViewAuditLog(role) : false;
}
