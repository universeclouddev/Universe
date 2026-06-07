"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RbacGate, useCanViewAuditLog } from "@/lib/panel/rbac-ui";
import { AUDIT_VIEW_PERMISSION } from "@/lib/panel/audit-shared";

function AuditRedirect() {
  const router = useRouter();
  const canView = useCanViewAuditLog();

  useEffect(() => {
    if (!canView) {
      router.replace("/settings");
      return;
    }
    router.replace("/settings?tab=audit");
  }, [canView, router]);

  return <p className="text-zinc-500">Redirecting...</p>;
}

export default function SettingsAuditPage() {
  return (
    <RbacGate
      permission={AUDIT_VIEW_PERMISSION}
      fallback={
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
          You don&apos;t have permission to view the audit log.
        </div>
      }
    >
      <Suspense fallback={<p className="text-zinc-500">Loading...</p>}>
        <AuditRedirect />
      </Suspense>
    </RbacGate>
  );
}
