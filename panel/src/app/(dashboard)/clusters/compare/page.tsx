"use client";

import { PageHeader } from "@/components/layout/sidebar";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { ClusterCompareView } from "@/components/clusters/compare/cluster-compare-view";

export default function ClusterComparePage() {
  return (
    <PermissionGuard permission="cluster.read">
      <PageHeader
        title="Compare clusters"
        description="Side-by-side diff of templates, configurations, and instance counts across two configured clusters"
      />
      <ClusterCompareView />
    </PermissionGuard>
  );
}
