"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  evaluateClusterHealth,
  healthLevelBadgeVariant,
  healthLevelLabel,
  memoryLevel,
  nodeRamPercent,
  type ClusterHealthResult,
  type ClusterHealthSettings,
  type HealthLevel,
} from "@/lib/panel/cluster-health";
import type { ClusterNode, InstanceInfo, NodeInfo } from "@/lib/api/types";
import { getMemoryUsagePercent } from "@/lib/api/metrics";
import { cn } from "@/lib/utils";

export function ClusterHealthBadge({ status }: { status: HealthLevel }) {
  return (
    <Badge variant={healthLevelBadgeVariant(status)} className="font-mono text-[10px] normal-case">
      {status === "ok" && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
      )}
      {healthLevelLabel(status)}
    </Badge>
  );
}

interface ClusterHealthSummaryProps {
  settings: ClusterHealthSettings;
  ping?: { status?: string } | null;
  nodeInfo?: NodeInfo | null;
  nodes?: ClusterNode[] | null;
  instances?: InstanceInfo[] | null;
  maxRamMB?: number | null;
  compact?: boolean;
  className?: string;
}

export function useClusterHealthEvaluation(props: ClusterHealthSummaryProps): ClusterHealthResult {
  return evaluateClusterHealth(props.settings, {
    ping: props.ping,
    nodeInfo: props.nodeInfo,
    nodes: props.nodes,
    instances: props.instances,
    maxRamMB: props.maxRamMB,
  });
}

export function ClusterHealthSummary({
  settings,
  ping,
  nodeInfo,
  nodes,
  instances,
  maxRamMB,
  compact = false,
  className,
}: ClusterHealthSummaryProps) {
  const result = useClusterHealthEvaluation({
    settings,
    ping,
    nodeInfo,
    nodes,
    instances,
    maxRamMB,
  });

  const jvmMemPct = getMemoryUsagePercent(nodeInfo?.system);
  const totalUsed = nodes?.reduce((s, n) => s + (n.resources?.usedRamMB ?? 0), 0) ?? 0;
  const clusterMemPct =
    maxRamMB && nodes?.length
      ? nodeRamPercent(totalUsed, maxRamMB * nodes.length)
      : null;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <ClusterHealthBadge status={result.status} />
        <span className="text-xs text-zinc-500">{result.summary}</span>
      </div>
    );
  }

  return (
    <Card className={cn("glow-border-emerald", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-white/[0.06] pb-3">
        <CardTitle className="text-base">Cluster health</CardTitle>
        <ClusterHealthBadge status={result.status} />
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {!settings.healthCheckEnabled ? (
          <p className="text-sm text-zinc-500">
            Health checks are disabled for this cluster. Enable them in Settings → Clusters.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <HealthMetric
                label="API"
                value={ping?.status === "ok" ? "Reachable" : "Unreachable"}
                level={ping?.status === "ok" ? "ok" : "critical"}
              />
              <HealthMetric
                label="JVM memory"
                value={jvmMemPct !== null ? `${jvmMemPct}%` : "—"}
                level={
                  jvmMemPct !== null ? memoryLevel(jvmMemPct, settings) : "unknown"
                }
              />
              <HealthMetric
                label="Cluster RAM"
                value={clusterMemPct !== null ? `${clusterMemPct}%` : "—"}
                level={
                  clusterMemPct !== null ? memoryLevel(clusterMemPct, settings) : "unknown"
                }
              />
            </div>

            {result.issues.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {result.issues.map((issue) => (
                  <li
                    key={issue.message}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2 py-1.5",
                      issue.level === "critical"
                        ? "bg-red-500/10 text-red-300"
                        : "bg-amber-500/10 text-amber-300",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        issue.level === "critical" ? "bg-red-400" : "bg-amber-400",
                      )}
                    />
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">All configured health checks are passing.</p>
            )}

            <p className="text-xs text-zinc-600">
              Thresholds: warn {settings.memoryWarningPercent}% · critical{" "}
              {settings.memoryCriticalPercent}%
              {settings.instanceOfflineThresholdSeconds != null &&
                ` · offline ${settings.instanceOfflineThresholdSeconds}s`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HealthMetric({
  label,
  value,
  level,
}: {
  label: string;
  value: string;
  level: HealthLevel | "ok" | "warning" | "critical";
}) {
  const normalized: HealthLevel =
    level === "warning" ? "warning" : level === "critical" ? "critical" : level === "ok" ? "ok" : "unknown";

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-mono text-sm text-zinc-200">{value}</span>
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            normalized === "ok" && "bg-emerald-400 pulse-dot",
            normalized === "warning" && "bg-amber-400",
            normalized === "critical" && "bg-red-400",
            normalized === "unknown" && "bg-zinc-600",
          )}
        />
      </div>
    </div>
  );
}

export function nodeHealthBorderClass(
  usedRamMB: number,
  maxRamMB: number,
  settings: ClusterHealthSettings,
): string {
  if (!settings.healthCheckEnabled) return "border-white/[0.06]";
  const pct = nodeRamPercent(usedRamMB, maxRamMB);
  if (pct === null) return "border-white/[0.06]";
  const level = memoryLevel(pct, settings);
  if (level === "critical") return "border-red-500/40 hover:border-red-500/60";
  if (level === "warning") return "border-amber-500/40 hover:border-amber-500/60";
  return "border-emerald-500/20 hover:border-emerald-500/40";
}

export function ramBarColorClass(
  usedRamMB: number,
  maxRamMB: number,
  settings: ClusterHealthSettings,
): string {
  if (!settings.healthCheckEnabled) return "bg-sky-500";
  const pct = nodeRamPercent(usedRamMB, maxRamMB);
  if (pct === null) return "bg-sky-500";
  const level = memoryLevel(pct, settings);
  if (level === "critical") return "bg-red-500";
  if (level === "warning") return "bg-amber-500";
  return "bg-emerald-500";
}
