import type { ClusterNode, InstanceInfo, NodeInfo } from "@/lib/api/types";
import { getMemoryUsagePercent } from "@/lib/api/metrics";

export type HealthLevel = "ok" | "warning" | "critical" | "disabled" | "unknown";

export interface ClusterHealthSettings {
  healthCheckEnabled: boolean;
  memoryWarningPercent: number;
  memoryCriticalPercent: number;
  instanceOfflineThresholdSeconds: number | null;
}

export const DEFAULT_CLUSTER_HEALTH: ClusterHealthSettings = {
  healthCheckEnabled: true,
  memoryWarningPercent: 75,
  memoryCriticalPercent: 90,
  instanceOfflineThresholdSeconds: 300,
};

export interface HealthIssue {
  level: "warning" | "critical";
  message: string;
}

export interface ClusterHealthResult {
  status: HealthLevel;
  issues: HealthIssue[];
  summary: string;
}

export function resolveClusterHealth(
  stored?: Partial<ClusterHealthSettings> | null,
): ClusterHealthSettings {
  if (!stored) return { ...DEFAULT_CLUSTER_HEALTH };
  return {
    healthCheckEnabled: stored.healthCheckEnabled ?? DEFAULT_CLUSTER_HEALTH.healthCheckEnabled,
    memoryWarningPercent:
      stored.memoryWarningPercent ?? DEFAULT_CLUSTER_HEALTH.memoryWarningPercent,
    memoryCriticalPercent:
      stored.memoryCriticalPercent ?? DEFAULT_CLUSTER_HEALTH.memoryCriticalPercent,
    instanceOfflineThresholdSeconds:
      stored.instanceOfflineThresholdSeconds !== undefined
        ? stored.instanceOfflineThresholdSeconds
        : DEFAULT_CLUSTER_HEALTH.instanceOfflineThresholdSeconds,
  };
}

export function validateClusterHealthPatch(
  patch: Partial<ClusterHealthSettings>,
): { ok: true; value: Partial<ClusterHealthSettings> } | { ok: false; error: string } {
  const result: Partial<ClusterHealthSettings> = {};

  if (patch.healthCheckEnabled !== undefined) {
    if (typeof patch.healthCheckEnabled !== "boolean") {
      return { ok: false, error: "healthCheckEnabled must be a boolean" };
    }
    result.healthCheckEnabled = patch.healthCheckEnabled;
  }

  if (patch.memoryWarningPercent !== undefined) {
    const v = patch.memoryWarningPercent;
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      return { ok: false, error: "memoryWarningPercent must be an integer between 0 and 100" };
    }
    result.memoryWarningPercent = v;
  }

  if (patch.memoryCriticalPercent !== undefined) {
    const v = patch.memoryCriticalPercent;
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      return { ok: false, error: "memoryCriticalPercent must be an integer between 0 and 100" };
    }
    result.memoryCriticalPercent = v;
  }

  if (patch.instanceOfflineThresholdSeconds !== undefined) {
    const v = patch.instanceOfflineThresholdSeconds;
    if (v !== null && (!Number.isInteger(v) || v <= 0)) {
      return {
        ok: false,
        error: "instanceOfflineThresholdSeconds must be a positive integer or null",
      };
    }
    result.instanceOfflineThresholdSeconds = v;
  }

  const warn = result.memoryWarningPercent;
  const crit = result.memoryCriticalPercent;
  if (warn !== undefined && crit !== undefined && warn >= crit) {
    return { ok: false, error: "memoryWarningPercent must be less than memoryCriticalPercent" };
  }

  return { ok: true, value: result };
}

export function mergeClusterHealth(
  existing: ClusterHealthSettings | undefined,
  patch: Partial<ClusterHealthSettings>,
): ClusterHealthSettings {
  const base = resolveClusterHealth(existing);
  const merged = { ...base, ...patch };
  if (merged.memoryWarningPercent >= merged.memoryCriticalPercent) {
    merged.memoryWarningPercent = Math.max(0, merged.memoryCriticalPercent - 1);
  }
  return merged;
}

function maxLevel(
  current: "ok" | "warning" | "critical",
  next: "warning" | "critical",
): "ok" | "warning" | "critical" {
  if (next === "critical") return "critical";
  if (current === "critical") return "critical";
  if (next === "warning") return "warning";
  return current;
}

export function memoryLevel(
  percent: number,
  settings: ClusterHealthSettings,
): "ok" | "warning" | "critical" {
  if (percent >= settings.memoryCriticalPercent) return "critical";
  if (percent >= settings.memoryWarningPercent) return "warning";
  return "ok";
}

export function nodeRamPercent(usedRamMB: number, maxRamMB: number): number | null {
  if (maxRamMB <= 0) return null;
  const pct = Math.round((usedRamMB / maxRamMB) * 100);
  if (!Number.isFinite(pct)) return null;
  return Math.min(100, Math.max(0, pct));
}

export function evaluateClusterHealth(
  settings: ClusterHealthSettings,
  input: {
    ping?: { status?: string } | null;
    nodeInfo?: NodeInfo | null;
    nodes?: ClusterNode[] | null;
    instances?: InstanceInfo[] | null;
    maxRamMB?: number | null;
  },
): ClusterHealthResult {
  if (!settings.healthCheckEnabled) {
    return { status: "disabled", issues: [], summary: "Health checks disabled" };
  }

  const issues: HealthIssue[] = [];
  let status: "ok" | "warning" | "critical" = "ok";

  if (!input.ping || input.ping.status !== "ok") {
    issues.push({ level: "critical", message: "REST API unreachable or unhealthy" });
    status = "critical";
  }

  const jvmMemPct = getMemoryUsagePercent(input.nodeInfo?.system);
  if (jvmMemPct !== null) {
    const level = memoryLevel(jvmMemPct, settings);
    if (level === "critical") {
      issues.push({
        level: "critical",
        message: `Master JVM memory at ${jvmMemPct}% (critical ≥ ${settings.memoryCriticalPercent}%)`,
      });
      status = "critical";
    } else if (level === "warning") {
      issues.push({
        level: "warning",
        message: `Master JVM memory at ${jvmMemPct}% (warning ≥ ${settings.memoryWarningPercent}%)`,
      });
      status = maxLevel(status, "warning");
    }
  }

  if (input.maxRamMB && input.maxRamMB > 0 && input.nodes && input.nodes.length > 0) {
    const totalUsed = input.nodes.reduce((s, n) => s + (n.resources?.usedRamMB ?? 0), 0);
    const totalCapacity = input.maxRamMB * input.nodes.length;
    const clusterPct = nodeRamPercent(totalUsed, totalCapacity);
    if (clusterPct !== null) {
      const level = memoryLevel(clusterPct, settings);
      if (level === "critical") {
        issues.push({
          level: "critical",
          message: `Cluster RAM at ${clusterPct}% (critical ≥ ${settings.memoryCriticalPercent}%)`,
        });
        status = "critical";
      } else if (level === "warning") {
        issues.push({
          level: "warning",
          message: `Cluster RAM at ${clusterPct}% (warning ≥ ${settings.memoryWarningPercent}%)`,
        });
        status = maxLevel(status, "warning");
      }
    }
  }

  const offlineInstances = input.instances?.filter((i) => i.state === "OFFLINE") ?? [];
  if (offlineInstances.length > 0) {
    const thresholdSec = settings.instanceOfflineThresholdSeconds;
    const now = Date.now();
    const stale =
      thresholdSec != null
        ? offlineInstances.filter((i) => {
            if (!i.lastHeartbeat) return true;
            return now - i.lastHeartbeat > thresholdSec * 1000;
          })
        : offlineInstances;

    if (stale.length > 0) {
      const msg =
        thresholdSec != null
          ? `${stale.length} instance(s) offline longer than ${thresholdSec}s`
          : `${stale.length} instance(s) offline`;
      issues.push({ level: "warning", message: msg });
      status = maxLevel(status, "warning");
    }
  }

  if (input.nodes && input.nodes.length === 0 && input.ping?.status === "ok") {
    issues.push({ level: "warning", message: "No cluster nodes reported" });
    status = maxLevel(status, "warning");
  }

  const summary =
    status === "ok"
      ? "All checks passing"
      : status === "warning"
        ? `${issues.length} warning${issues.length === 1 ? "" : "s"}`
        : `${issues.filter((i) => i.level === "critical").length || issues.length} issue${issues.length === 1 ? "" : "s"}`;

  return { status, issues, summary };
}

export function healthLevelLabel(status: HealthLevel): string {
  switch (status) {
    case "ok":
      return "OK";
    case "warning":
      return "WARN";
    case "critical":
      return "CRITICAL";
    case "disabled":
      return "Disabled";
    default:
      return "Unknown";
  }
}

export function healthLevelBadgeVariant(
  status: HealthLevel,
): "success" | "warning" | "danger" | "muted" | "default" {
  switch (status) {
    case "ok":
      return "success";
    case "warning":
      return "warning";
    case "critical":
      return "danger";
    case "disabled":
      return "muted";
    default:
      return "default";
  }
}
