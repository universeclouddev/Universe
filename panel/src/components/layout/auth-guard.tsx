"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import type { PanelPermission } from "@/lib/panel/permissions";
import { PageLoader } from "@/components/layout/page-loader";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, universeConfigured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return <PageLoader label={isLoading ? "Loading session..." : "Redirecting to sign in..."} />;
  }

  if (!universeConfigured) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="glass-panel max-w-md rounded-2xl p-6 text-center">
          <h2 className="text-lg font-semibold text-zinc-100">No Universe cluster linked</h2>
          <p className="mt-2 text-sm text-zinc-500">
            An operator must add at least one Universe cluster in Settings → Clusters.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function PermissionGuard({
  permission,
  children,
  fallback,
}: {
  permission: PanelPermission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return (
      fallback ?? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
          You don&apos;t have permission for this section.
        </div>
      )
    );
  }
  return <>{children}</>;
}

/** @deprecated Prefer PermissionGuard */
export function AdminGuard({
  children,
  fallback,
  permission = "instances.manage",
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  permission?: PanelPermission;
}) {
  return (
    <PermissionGuard permission={permission} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}
