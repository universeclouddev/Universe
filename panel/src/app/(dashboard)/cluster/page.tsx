"use client";

import Link from "next/link";
import { DashboardHeader } from "@/components/layout/sidebar";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClusterHealthSummary,
  nodeHealthBorderClass,
  ramBarColorClass,
} from "@/components/clusters/cluster-health-summary";
import { nodeRamPercent } from "@/lib/panel/cluster-health";
import { useAuth } from "@/lib/auth/context";
import { useClusterNodes, useInstances, useNodeConfig, useNodeInfo, usePing } from "@/lib/api/queries";

export default function ClusterPage() {
  const { activeClusterHealth } = useAuth();
  const nodes = useClusterNodes();
  const ping = usePing();
  const nodeInfo = useNodeInfo();
  const instances = useInstances();
  const nodeConfig = useNodeConfig();

  const maxRamMB = nodeConfig.data?.maxRamMB ?? 8192;

  return (
    <PermissionGuard permission="cluster.read">
      <div>
        <DashboardHeader title="Cluster" description="Hazelcast cluster nodes" />

        <div className="mb-6">
          <ClusterHealthSummary
            settings={activeClusterHealth}
            ping={ping.data}
            nodeInfo={nodeInfo.data}
            nodes={nodes.data}
            instances={instances.data}
            maxRamMB={maxRamMB}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {nodes.isLoading && <p className="text-zinc-500">Loading nodes...</p>}
          {nodes.data?.map((node) => {
            const usedRam = node.resources?.usedRamMB ?? 0;
            const ramPct = nodeRamPercent(usedRam, maxRamMB) ?? 0;

            return (
              <Link key={node.id} href={`/cluster/${node.id}`}>
                <Card
                  className={`transition-colors ${nodeHealthBorderClass(usedRam, maxRamMB, activeClusterHealth)}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{node.name}</CardTitle>
                      <div className="flex gap-1">
                        {node.local && <Badge variant="success">Local</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-zinc-500">Address</p>
                      <p className="font-mono">
                        {node.address}:{node.port}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-zinc-500">RAM used</p>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full ${ramBarColorClass(usedRam, maxRamMB, activeClusterHealth)}`}
                          style={{ width: `${Math.min(100, ramPct)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">
                        {usedRam} MB
                        {activeClusterHealth.healthCheckEnabled && ramPct > 0 && (
                          <span className="text-zinc-600"> · {ramPct}%</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">CPU used</p>
                      <p>{node.resources?.usedCpu ?? 0} units</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </PermissionGuard>
  );
}
