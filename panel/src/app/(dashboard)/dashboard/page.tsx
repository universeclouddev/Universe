"use client";

import Link from "next/link";
import { Plus, RefreshCw, Server, Network, Cpu, MemoryStick, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { UtilisationChart } from "@/components/dashboard/utilisation-chart";
import { MetricsCharts } from "@/components/dashboard/metrics-charts";
import { InstanceDistributionChart } from "@/components/dashboard/instance-distribution-chart";
import { ResourceGauges } from "@/components/dashboard/resource-gauges";
import { NodeComparisonChart } from "@/components/dashboard/node-comparison-chart";
import { NodesPanel } from "@/components/dashboard/nodes-panel";
import { InstancesTable } from "@/components/dashboard/instances-table";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { SystemStatus } from "@/components/dashboard/system-status";
import { usePing, useInstances, useClusterNodes, useNodeInfo, useNodeConfig } from "@/lib/api/queries";
import { getMemoryUsagePercent, getValidSystemLoadAverage } from "@/lib/api/metrics";
import { useAuth } from "@/lib/auth/context";
import { useSparklineHistory } from "@/hooks/use-metric-history";
import type { InstanceState } from "@/lib/api/types";
import { MotionItem, StaggerGrid } from "@/components/motion";
import {
  evaluateClusterHealth,
  healthLevelBadgeVariant,
  healthLevelLabel,
} from "@/lib/panel/cluster-health";

function countByState(instances: { state?: InstanceState }[]) {
  return instances.reduce(
    (acc, i) => {
      if (i.state) acc[i.state] = (acc[i.state] ?? 0) + 1;
      return acc;
    },
    {} as Record<InstanceState, number>,
  );
}

export default function DashboardPage() {
  const { hasPermission, activeClusterHealth } = useAuth();
  const ping = usePing();
  const instances = useInstances();
  const nodes = useClusterNodes();
  const nodeInfo = useNodeInfo();
  const nodeConfig = useNodeConfig();

  const canViewInstances = hasPermission("instances.read");
  const canViewCluster = hasPermission("cluster.read");

  const stateCounts: Partial<Record<InstanceState, number>> = instances.data
    ? countByState(instances.data)
    : {};
  const onlineCount = (stateCounts.ONLINE ?? 0) + (stateCounts.CREATING ?? 0);
  const instanceTotal = instances.data?.length ?? 0;

  const totalRam = nodes.data?.reduce((s, n) => s + (n.resources?.usedRamMB ?? 0), 0) ?? 0;
  const totalCpu = nodes.data?.reduce((s, n) => s + (n.resources?.usedCpu ?? 0), 0) ?? 0;
  const maxRam = Math.max(totalRam, 8192);
  const maxCpu = Math.max(totalCpu, 100);

  const systemLoad = getValidSystemLoadAverage(nodeInfo.data?.system.systemLoadAverage);
  const memFromNode = getMemoryUsagePercent(nodeInfo.data?.system);

  const memPct = memFromNode ?? (totalRam / maxRam) * 100;

  const cpuPct =
    systemLoad !== null ? Math.min(100, systemLoad * 25) : (totalCpu / maxCpu) * 100;

  const instanceSpark = useSparklineHistory(instanceTotal);
  const nodeSpark = useSparklineHistory(nodes.data?.length ?? 0);
  const memSpark = useSparklineHistory(memPct);
  const cpuSpark = useSparklineHistory(cpuPct);

  const healthResult = evaluateClusterHealth(activeClusterHealth, {
    ping: ping.data,
    nodeInfo: nodeInfo.data,
    nodes: nodes.data,
    instances: instances.data,
    maxRamMB: nodeConfig.data?.maxRamMB,
  });

  function refreshAll() {
    ping.refetch();
    instances.refetch();
    nodes.refetch();
    nodeInfo.refetch();
  }

  return (
    <div>
      <PageHeader
        title="Command Center"
        description="Real-time status of your Universe cluster"
        meta={
          healthResult.status === "ok" ? (
            <Badge variant="success" className="font-mono text-[10px] normal-case tracking-normal">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
              operational
            </Badge>
          ) : healthResult.status === "disabled" ? (
            <Badge variant="muted" className="font-mono text-[10px] normal-case tracking-normal">
              health off
            </Badge>
          ) : (
            <Badge
              variant={healthLevelBadgeVariant(healthResult.status)}
              className="font-mono text-[10px] normal-case tracking-normal"
            >
              {healthResult.status === "critical" ? "critical" : "degraded"}
            </Badge>
          )
        }
        actions={
          <>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={refreshAll}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {hasPermission("instances.manage") && (
              <Link href="/instances" className="w-full sm:w-auto">
                <Button size="sm" className="w-full">
                  <Plus className="h-4 w-4" />
                  New instance
                </Button>
              </Link>
            )}
          </>
        }
      />

      <StaggerGrid className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
        {canViewInstances && (
          <MotionItem className="h-full">
            <StatCard
              label="Instances"
              value={instanceTotal}
              numericValue={instanceTotal}
              sub={`${onlineCount} online · ${stateCounts.STOPPED ?? 0} stopped`}
              icon={Server}
              glow="purple"
              trend={
                onlineCount > 0 ? { label: `${onlineCount} active`, positive: true } : undefined
              }
              sparkData={instanceSpark}
              delay={0}
            />
          </MotionItem>
        )}
        {canViewCluster && (
          <MotionItem className="h-full">
            <StatCard
              label="Nodes"
              value={nodes.data?.length ?? "—"}
              numericValue={nodes.data?.length}
              sub="Hazelcast cluster members"
              icon={Network}
              glow="emerald"
              sparkData={nodeSpark}
              delay={0.05}
            />
          </MotionItem>
        )}
        <MotionItem className="h-full">
          <StatCard
            label="Memory"
            value={`${(memFromNode ?? memPct).toFixed(0)}%`}
            numericValue={memFromNode ?? memPct}
            sub={
              nodeInfo.data
                ? `${Math.round(nodeInfo.data.system.freeMemory / 1_048_576)} MB free`
                : "Cluster RAM allocated"
            }
            icon={MemoryStick}
            glow="sky"
            sparkData={memSpark}
            delay={0.1}
          />
        </MotionItem>
        <MotionItem className="h-full">
          <StatCard
            label="CPU load"
            value={
              systemLoad !== null
                ? systemLoad.toFixed(2)
                : nodeInfo.data
                  ? "N/A"
                  : `${totalCpu}`
            }
            sub={ping.data?.master ? "Master node" : "Wrapper node"}
            icon={Cpu}
            glow="amber"
            sparkData={cpuSpark}
            delay={0.15}
          />
        </MotionItem>
        <MotionItem className="h-full">
          <StatCard
            label="Cluster health"
            value={healthLevelLabel(healthResult.status)}
            sub={
              healthResult.status === "disabled"
                ? "Checks disabled"
                : healthResult.summary
            }
            icon={Zap}
            glow={
              healthResult.status === "ok"
                ? "emerald"
                : healthResult.status === "warning"
                  ? "amber"
                  : healthResult.status === "critical"
                    ? "sky"
                    : "emerald"
            }
            trend={
              healthResult.status === "ok"
                ? { label: "Healthy", positive: true }
                : healthResult.status === "warning"
                  ? { label: healthResult.summary, positive: false }
                  : healthResult.status === "critical"
                    ? { label: healthResult.summary, positive: false }
                    : undefined
            }
            delay={0.2}
          />
        </MotionItem>
      </StaggerGrid>

      {(canViewInstances || canViewCluster) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <UtilisationChart cpuPercent={cpuPct} memoryPercent={memPct} />
            {canViewCluster && <NodeComparisonChart nodes={nodes.data ?? []} />}
          </div>
          <div className="space-y-4">
            <ResourceGauges cpuPercent={cpuPct} memoryPercent={memPct} />
            {canViewInstances && (
              <InstanceDistributionChart counts={stateCounts} total={instanceTotal} />
            )}
            {canViewCluster && <NodesPanel nodes={nodes.data ?? []} loading={nodes.isLoading} />}
          </div>
        </div>
      )}

      {canViewInstances && (
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <InstancesTable instances={instances.data ?? []} loading={instances.isLoading} compact />
        </motion.div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {canViewInstances && <RecentActivity instances={instances.data ?? []} />}
        <SystemStatus
          ping={ping.data}
          nodeInfo={nodeInfo.data}
          healthSettings={activeClusterHealth}
        />
      </div>
    </div>
  );
}
