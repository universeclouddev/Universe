"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/sidebar";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { LifecycleDashboard } from "@/components/instances/lifecycle/lifecycle-dashboard";
import { useInstances, useConfigurations } from "@/lib/api/queries";

export default function InstanceLifecyclePage() {
  const instances = useInstances();
  const configurations = useConfigurations();
  const loading = instances.isLoading || configurations.isLoading;

  return (
    <PermissionGuard permission="instances.read">
      <div>
        <Link
          href="/instances"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Instances
        </Link>

        <PageHeader
          title="Instance lifecycle"
          description="Group instances by configuration — compare running counts against desired minimums and run bulk lifecycle actions"
        />

        <LifecycleDashboard
          instances={instances.data ?? []}
          configurations={configurations.data ?? []}
          loading={loading}
        />
      </div>
    </PermissionGuard>
  );
}
