import { randomUUID } from "crypto";
import {
  evaluateClusterHealth,
  type ClusterHealthResult,
  type HealthLevel,
} from "@/lib/panel/cluster-health";
import {
  getCluster,
  getClusterConnection,
  listClusters,
  type PanelCluster,
} from "@/lib/panel/clusters";
import { decryptSecret, encryptSecret } from "@/lib/panel/crypto";
import { getStore, saveStore } from "@/lib/panel/store";
import type { ClusterNode, InstanceInfo, NodeInfo, PingResponse } from "@/lib/api/types";
import type { UniverseMainConfiguration } from "@/lib/api/types";

export type WebhookType = "discord" | "generic";
export type AlertMinLevel = "warning" | "critical";

export interface AlertWebhookRow {
  id: string;
  name: string;
  url: string;
  type: WebhookType;
  enabled: boolean;
  cluster_ids: string[] | null;
  min_level: AlertMinLevel;
  notify_on_recovery: boolean;
  created_at: number;
}

export interface ClusterAlertStateRow {
  last_status: HealthLevel;
  last_notified_at: number;
  last_notified_status: HealthLevel;
}

export interface PanelAlertsRow {
  enabled: boolean;
  poll_interval_seconds: number;
  cooldown_minutes: number;
  webhooks: AlertWebhookRow[];
  cluster_states: Record<string, ClusterAlertStateRow>;
}

export interface AlertWebhook {
  id: string;
  name: string;
  type: WebhookType;
  enabled: boolean;
  clusterIds: string[] | null;
  minLevel: AlertMinLevel;
  notifyOnRecovery: boolean;
  createdAt: number;
  hasUrl: boolean;
  urlHint: string | null;
}

export interface PanelAlertsConfig {
  enabled: boolean;
  pollIntervalSeconds: number;
  cooldownMinutes: number;
  webhooks: AlertWebhook[];
}

export interface AlertEvaluationResult {
  evaluated: number;
  dispatched: number;
  skipped: number;
  errors: string[];
  clusters: {
    clusterId: string;
    clusterName: string;
    status: HealthLevel;
    notified: boolean;
  }[];
}

export const DEFAULT_ALERTS: PanelAlertsRow = {
  enabled: true,
  poll_interval_seconds: 60,
  cooldown_minutes: 15,
  webhooks: [],
  cluster_states: {},
};

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/i;

const globalForAlerts = globalThis as typeof globalThis & {
  __panelAlertEvaluatorStarted?: boolean;
  __panelAlertEvaluatorTimer?: ReturnType<typeof setInterval>;
};

function mapWebhook(row: AlertWebhookRow): AlertWebhook {
  let urlHint: string | null = null;
  try {
    const url = decryptSecret(row.url);
    const parsed = new URL(url);
    urlHint = `${parsed.hostname}${parsed.pathname.slice(-8)}`;
  } catch {
    urlHint = null;
  }
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    enabled: row.enabled,
    clusterIds: row.cluster_ids,
    minLevel: row.min_level,
    notifyOnRecovery: row.notify_on_recovery,
    createdAt: row.created_at,
    hasUrl: !!row.url,
    urlHint,
  };
}

export function getAlertsRow(): PanelAlertsRow {
  const store = getStore();
  const alerts = store.alerts;
  if (!alerts) return { ...DEFAULT_ALERTS, webhooks: [], cluster_states: {} };
  return {
    enabled: alerts.enabled ?? DEFAULT_ALERTS.enabled,
    poll_interval_seconds:
      alerts.poll_interval_seconds ?? DEFAULT_ALERTS.poll_interval_seconds,
    cooldown_minutes: alerts.cooldown_minutes ?? DEFAULT_ALERTS.cooldown_minutes,
    webhooks: alerts.webhooks ?? [],
    cluster_states: alerts.cluster_states ?? {},
  };
}

export function getAlertsConfig(): PanelAlertsConfig {
  const row = getAlertsRow();
  return {
    enabled: row.enabled,
    pollIntervalSeconds: row.poll_interval_seconds,
    cooldownMinutes: row.cooldown_minutes,
    webhooks: row.webhooks.map(mapWebhook),
  };
}

function saveAlertsRow(row: PanelAlertsRow) {
  const store = getStore();
  store.alerts = row;
  saveStore(store);
}

function getWebhookUrl(row: AlertWebhookRow): string | null {
  try {
    return decryptSecret(row.url);
  } catch {
    return null;
  }
}

export function detectWebhookType(url: string): WebhookType {
  return DISCORD_WEBHOOK_RE.test(url.trim()) ? "discord" : "generic";
}

export function validateWebhookUrl(url: string): { ok: true } | { ok: false; error: string } {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: "Webhook URL is required" };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "Webhook URL must use http or https" };
    }
  } catch {
    return { ok: false, error: "Invalid webhook URL" };
  }
  return { ok: true };
}

export function validateAlertsPatch(patch: {
  enabled?: boolean;
  pollIntervalSeconds?: number;
  cooldownMinutes?: number;
}): { ok: true; value: Partial<PanelAlertsRow> } | { ok: false; error: string } {
  const result: Partial<PanelAlertsRow> = {};

  if (patch.enabled !== undefined) {
    if (typeof patch.enabled !== "boolean") {
      return { ok: false, error: "enabled must be a boolean" };
    }
    result.enabled = patch.enabled;
  }

  if (patch.pollIntervalSeconds !== undefined) {
    const v = patch.pollIntervalSeconds;
    if (!Number.isInteger(v) || v < 15 || v > 3600) {
      return { ok: false, error: "pollIntervalSeconds must be between 15 and 3600" };
    }
    result.poll_interval_seconds = v;
  }

  if (patch.cooldownMinutes !== undefined) {
    const v = patch.cooldownMinutes;
    if (!Number.isInteger(v) || v < 1 || v > 1440) {
      return { ok: false, error: "cooldownMinutes must be between 1 and 1440" };
    }
    result.cooldown_minutes = v;
  }

  return { ok: true, value: result };
}

export function validateWebhookInput(input: {
  name?: string;
  url?: string;
  type?: WebhookType;
  enabled?: boolean;
  clusterIds?: string[] | null;
  minLevel?: AlertMinLevel;
  notifyOnRecovery?: boolean;
}): { ok: true; value: Partial<AlertWebhookRow> } | { ok: false; error: string } {
  const result: Partial<AlertWebhookRow> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Webhook name is required" };
    result.name = name;
  }

  if (input.url !== undefined) {
    const validated = validateWebhookUrl(input.url);
    if (!validated.ok) return validated;
    result.url = encryptSecret(input.url.trim());
    result.type = input.type ?? detectWebhookType(input.url);
  }

  if (input.type !== undefined) {
    if (input.type !== "discord" && input.type !== "generic") {
      return { ok: false, error: "type must be discord or generic" };
    }
    result.type = input.type;
  }

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") {
      return { ok: false, error: "enabled must be a boolean" };
    }
    result.enabled = input.enabled;
  }

  if (input.clusterIds !== undefined) {
    if (input.clusterIds !== null) {
      if (!Array.isArray(input.clusterIds)) {
        return { ok: false, error: "clusterIds must be an array or null" };
      }
      for (const id of input.clusterIds) {
        if (!getCluster(id)) {
          return { ok: false, error: `Unknown cluster: ${id}` };
        }
      }
    }
    result.cluster_ids = input.clusterIds;
  }

  if (input.minLevel !== undefined) {
    if (input.minLevel !== "warning" && input.minLevel !== "critical") {
      return { ok: false, error: "minLevel must be warning or critical" };
    }
    result.min_level = input.minLevel;
  }

  if (input.notifyOnRecovery !== undefined) {
    if (typeof input.notifyOnRecovery !== "boolean") {
      return { ok: false, error: "notifyOnRecovery must be a boolean" };
    }
    result.notify_on_recovery = input.notifyOnRecovery;
  }

  return { ok: true, value: result };
}

export function updateAlertsConfig(patch: {
  enabled?: boolean;
  pollIntervalSeconds?: number;
  cooldownMinutes?: number;
}): PanelAlertsConfig {
  const validated = validateAlertsPatch(patch);
  if (!validated.ok) throw new Error(validated.error);

  const current = getAlertsRow();
  const next: PanelAlertsRow = { ...current, ...validated.value };
  saveAlertsRow(next);
  restartBackgroundAlertEvaluator();
  return getAlertsConfig();
}

export function createAlertWebhook(input: {
  name: string;
  url: string;
  type?: WebhookType;
  enabled?: boolean;
  clusterIds?: string[] | null;
  minLevel?: AlertMinLevel;
  notifyOnRecovery?: boolean;
}): AlertWebhook {
  const validated = validateWebhookInput({
    name: input.name,
    url: input.url,
    type: input.type,
    enabled: input.enabled,
    clusterIds: input.clusterIds ?? null,
    minLevel: input.minLevel ?? "warning",
    notifyOnRecovery: input.notifyOnRecovery ?? true,
  });
  if (!validated.ok) throw new Error(validated.error);
  if (!validated.value.name || !validated.value.url) {
    throw new Error("name and url are required");
  }

  const row: AlertWebhookRow = {
    id: randomUUID(),
    name: validated.value.name,
    url: validated.value.url,
    type: validated.value.type ?? detectWebhookType(input.url),
    enabled: validated.value.enabled ?? true,
    cluster_ids: validated.value.cluster_ids ?? null,
    min_level: validated.value.min_level ?? "warning",
    notify_on_recovery: validated.value.notify_on_recovery ?? true,
    created_at: Date.now(),
  };

  const current = getAlertsRow();
  saveAlertsRow({ ...current, webhooks: [...current.webhooks, row] });
  return mapWebhook(row);
}

export function updateAlertWebhook(
  id: string,
  patch: {
    name?: string;
    url?: string;
    type?: WebhookType;
    enabled?: boolean;
    clusterIds?: string[] | null;
    minLevel?: AlertMinLevel;
    notifyOnRecovery?: boolean;
  },
): AlertWebhook | null {
  const current = getAlertsRow();
  const index = current.webhooks.findIndex((w) => w.id === id);
  if (index < 0) return null;

  const validated = validateWebhookInput(patch);
  if (!validated.ok) throw new Error(validated.error);

  const existing = current.webhooks[index]!;
  const nextRow: AlertWebhookRow = {
    ...existing,
    ...validated.value,
    url: validated.value.url ?? existing.url,
  };

  const webhooks = [...current.webhooks];
  webhooks[index] = nextRow;
  saveAlertsRow({ ...current, webhooks });
  return mapWebhook(nextRow);
}

export function deleteAlertWebhook(id: string): boolean {
  const current = getAlertsRow();
  const before = current.webhooks.length;
  const webhooks = current.webhooks.filter((w) => w.id !== id);
  if (webhooks.length === before) return false;
  saveAlertsRow({ ...current, webhooks });
  return true;
}

function severityRank(status: HealthLevel): number {
  switch (status) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    case "ok":
      return 1;
    case "disabled":
    case "unknown":
    default:
      return 0;
  }
}

function meetsMinLevel(status: HealthLevel, minLevel: AlertMinLevel): boolean {
  if (status === "disabled" || status === "unknown") return false;
  if (minLevel === "critical") return status === "critical";
  return status === "warning" || status === "critical";
}

function shouldNotify(input: {
  currentStatus: HealthLevel;
  previousStatus: HealthLevel;
  lastNotifiedAt: number;
  lastNotifiedStatus: HealthLevel;
  cooldownMinutes: number;
  minLevel: AlertMinLevel;
  notifyOnRecovery: boolean;
}): { notify: boolean; reason: "breach" | "escalation" | "recovery" | null } {
  const now = Date.now();
  const cooldownMs = input.cooldownMinutes * 60 * 1000;
  const inCooldown = now - input.lastNotifiedAt < cooldownMs;

  const breach = meetsMinLevel(input.currentStatus, input.minLevel);
  const wasBreach = meetsMinLevel(input.previousStatus, input.minLevel);

  if (input.notifyOnRecovery && input.currentStatus === "ok" && wasBreach) {
    if (inCooldown && input.lastNotifiedStatus === "ok") {
      return { notify: false, reason: null };
    }
    return { notify: true, reason: "recovery" };
  }

  if (!breach) return { notify: false, reason: null };

  if (!wasBreach) return { notify: true, reason: "breach" };

  if (severityRank(input.currentStatus) > severityRank(input.lastNotifiedStatus)) {
    return { notify: true, reason: "escalation" };
  }

  if (inCooldown) return { notify: false, reason: null };

  if (input.currentStatus !== input.lastNotifiedStatus) {
    return { notify: true, reason: "breach" };
  }

  return { notify: false, reason: null };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchClusterHealthSnapshot(cluster: PanelCluster): Promise<{
  ping: PingResponse | null;
  nodeInfo: NodeInfo | null;
  nodes: ClusterNode[] | null;
  instances: InstanceInfo[] | null;
  maxRamMB: number | null;
}> {
  const connection = getClusterConnection(cluster.id);
  if (!connection) {
    return { ping: null, nodeInfo: null, nodes: null, instances: null, maxRamMB: null };
  }

  const base = connection.apiUrl.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${connection.apiToken}` };

  const [ping, nodeInfo, nodes, instances, config] = await Promise.all([
    fetchJson<PingResponse>(`${base}/api/ping`),
    fetchJson<NodeInfo>(`${base}/api/node`, { headers }),
    fetchJson<ClusterNode[]>(`${base}/api/cluster/nodes`, { headers }),
    fetchJson<InstanceInfo[]>(`${base}/api/instances`, { headers }),
    fetchJson<UniverseMainConfiguration>(`${base}/api/node/config`, { headers }),
  ]);

  return {
    ping,
    nodeInfo,
    nodes,
    instances,
    maxRamMB: config?.maxRamMB ?? null,
  };
}

function buildDiscordPayload(input: {
  clusterName: string;
  status: HealthLevel;
  result: ClusterHealthResult;
  reason: "breach" | "escalation" | "recovery";
}): Record<string, unknown> {
  const color =
    input.reason === "recovery"
      ? 0x22c55e
      : input.status === "critical"
        ? 0xef4444
        : 0xf59e0b;

  const title =
    input.reason === "recovery"
      ? `✅ ${input.clusterName} recovered`
      : input.status === "critical"
        ? `🔴 ${input.clusterName} — CRITICAL`
        : `⚠️ ${input.clusterName} — Warning`;

  const description =
    input.reason === "recovery"
      ? "All health checks are passing again."
      : input.result.issues.map((i) => `• ${i.message}`).join("\n") || input.result.summary;

  return {
    embeds: [
      {
        title,
        description,
        color,
        timestamp: new Date().toISOString(),
        footer: { text: "Universe Panel" },
      },
    ],
  };
}

function buildGenericPayload(input: {
  clusterId: string;
  clusterName: string;
  status: HealthLevel;
  result: ClusterHealthResult;
  reason: "breach" | "escalation" | "recovery";
}): Record<string, unknown> {
  return {
    event: input.reason === "recovery" ? "health.recovery" : "health.breach",
    reason: input.reason,
    cluster: { id: input.clusterId, name: input.clusterName },
    health: {
      status: input.status,
      summary: input.result.summary,
      issues: input.result.issues,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function dispatchWebhook(
  webhook: AlertWebhookRow,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = getWebhookUrl(webhook);
  if (!url) throw new Error("Webhook URL unavailable");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webhook returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
}

export async function sendTestWebhook(input: {
  url: string;
  type?: WebhookType;
  clusterName?: string;
}): Promise<void> {
  const validated = validateWebhookUrl(input.url);
  if (!validated.ok) throw new Error(validated.error);

  const type = input.type ?? detectWebhookType(input.url);
  const clusterName = input.clusterName ?? "Test Cluster";
  const result: ClusterHealthResult = {
    status: "warning",
    summary: "1 warning",
    issues: [{ level: "warning", message: "Test alert from Universe Panel" }],
  };

  const payload =
    type === "discord"
      ? buildDiscordPayload({ clusterName, status: "warning", result, reason: "breach" })
      : buildGenericPayload({
          clusterId: "test",
          clusterName,
          status: "warning",
          result,
          reason: "breach",
        });

  const res = await fetch(input.url.trim(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webhook returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
}

function webhookAppliesToCluster(webhook: AlertWebhookRow, clusterId: string): boolean {
  if (!webhook.enabled) return false;
  if (!webhook.cluster_ids || webhook.cluster_ids.length === 0) return true;
  return webhook.cluster_ids.includes(clusterId);
}

export async function evaluateAndDispatchAlerts(): Promise<AlertEvaluationResult> {
  const config = getAlertsRow();
  const result: AlertEvaluationResult = {
    evaluated: 0,
    dispatched: 0,
    skipped: 0,
    errors: [],
    clusters: [],
  };

  if (!config.enabled || config.webhooks.length === 0) {
    return result;
  }

  const activeWebhooks = config.webhooks.filter((w) => w.enabled);
  if (activeWebhooks.length === 0) return result;

  const clusters = listClusters();
  const clusterStates = { ...config.cluster_states };
  let stateDirty = false;

  for (const cluster of clusters) {
    result.evaluated += 1;
    let healthResult: ClusterHealthResult;
    let currentStatus: HealthLevel;

    try {
      const snapshot = await fetchClusterHealthSnapshot(cluster);
      healthResult = evaluateClusterHealth(cluster.health, {
        ping: snapshot.ping,
        nodeInfo: snapshot.nodeInfo,
        nodes: snapshot.nodes,
        instances: snapshot.instances,
        maxRamMB: snapshot.maxRamMB,
      });
      currentStatus = healthResult.status;
    } catch (err) {
      result.errors.push(
        `${cluster.name}: ${err instanceof Error ? err.message : "evaluation failed"}`,
      );
      continue;
    }

    const prev = clusterStates[cluster.id] ?? {
      last_status: "unknown" as HealthLevel,
      last_notified_at: 0,
      last_notified_status: "unknown" as HealthLevel,
    };

    const applicableWebhooks = activeWebhooks.filter((w) =>
      webhookAppliesToCluster(w, cluster.id),
    );

    let clusterNotified = false;

    for (const webhook of applicableWebhooks) {
      const decision = shouldNotify({
        currentStatus,
        previousStatus: prev.last_status,
        lastNotifiedAt: prev.last_notified_at,
        lastNotifiedStatus: prev.last_notified_status,
        cooldownMinutes: config.cooldown_minutes,
        minLevel: webhook.min_level,
        notifyOnRecovery: webhook.notify_on_recovery,
      });

      if (!decision.notify || !decision.reason) {
        result.skipped += 1;
        continue;
      }

      const payload =
        webhook.type === "discord"
          ? buildDiscordPayload({
              clusterName: cluster.name,
              status: currentStatus,
              result: healthResult,
              reason: decision.reason,
            })
          : buildGenericPayload({
              clusterId: cluster.id,
              clusterName: cluster.name,
              status: currentStatus,
              result: healthResult,
              reason: decision.reason,
            });

      try {
        await dispatchWebhook(webhook, payload);
        result.dispatched += 1;
        clusterNotified = true;
        prev.last_notified_at = Date.now();
        prev.last_notified_status = currentStatus;
      } catch (err) {
        result.errors.push(
          `${cluster.name} → ${webhook.name}: ${err instanceof Error ? err.message : "dispatch failed"}`,
        );
      }
    }

    if (prev.last_status !== currentStatus || clusterNotified) {
      prev.last_status = currentStatus;
      clusterStates[cluster.id] = prev;
      stateDirty = true;
    }

    result.clusters.push({
      clusterId: cluster.id,
      clusterName: cluster.name,
      status: currentStatus,
      notified: clusterNotified,
    });
  }

  if (stateDirty) {
    saveAlertsRow({ ...config, cluster_states: clusterStates });
  }

  return result;
}

let evaluating = false;

export async function runAlertEvaluationOnce(): Promise<AlertEvaluationResult> {
  if (evaluating) {
    return { evaluated: 0, dispatched: 0, skipped: 0, errors: ["Evaluation already in progress"], clusters: [] };
  }
  evaluating = true;
  try {
    return await evaluateAndDispatchAlerts();
  } finally {
    evaluating = false;
  }
}

export function startBackgroundAlertEvaluator() {
  if (globalForAlerts.__panelAlertEvaluatorStarted) return;
  globalForAlerts.__panelAlertEvaluatorStarted = true;

  const tick = () => {
    void runAlertEvaluationOnce().catch((err) => {
      console.error("[panel-alerts] evaluation failed:", err);
    });
  };

  const config = getAlertsRow();
  const intervalMs = Math.max(15, config.poll_interval_seconds) * 1000;
  globalForAlerts.__panelAlertEvaluatorTimer = setInterval(tick, intervalMs);

  setTimeout(tick, 5000);
}

export function restartBackgroundAlertEvaluator() {
  if (globalForAlerts.__panelAlertEvaluatorTimer) {
    clearInterval(globalForAlerts.__panelAlertEvaluatorTimer);
    globalForAlerts.__panelAlertEvaluatorTimer = undefined;
  }
  globalForAlerts.__panelAlertEvaluatorStarted = false;
  startBackgroundAlertEvaluator();
}

export function isAlertsCronAuthorized(request: Request): boolean {
  const secret = process.env.PANEL_ALERTS_CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("x-panel-cron-secret");
  return header === secret;
}
