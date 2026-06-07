import { randomUUID } from "crypto";
import { fetchClusterApi } from "@/lib/panel/cluster-proxy";
import { findClusterRowById, getStore, saveStore } from "@/lib/panel/store";
import {
  computeNextRun,
  cronMatches,
  validateCronExpression,
  type PanelSchedule,
  type ScheduleRow,
  type ScheduleRunResult,
  type ScheduleTaskType,
} from "@/lib/panel/schedule-types";

export type {
  PanelSchedule,
  ScheduleRow,
  ScheduleRunResult,
  ScheduleRunStatus,
  ScheduleTaskType,
} from "@/lib/panel/schedule-types";

export {
  CRON_EXAMPLES,
  computeNextRun,
  cronMatches,
  normalizeCronExpression,
  taskTypeLabel,
  validateCronExpression,
} from "@/lib/panel/schedule-types";

let runnerStarted = false;
let runnerTimer: ReturnType<typeof setInterval> | null = null;

function mapSchedule(row: ScheduleRow): PanelSchedule {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    clusterId: row.cluster_id,
    cron: row.cron,
    taskType: row.task_type,
    payload: { ...row.payload },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    lastRunMessage: row.last_run_message,
    nextRunAt: row.enabled ? computeNextRun(row.cron) : null,
  };
}

export function listScheduleRows(): ScheduleRow[] {
  return [...(getStore().schedules ?? [])].sort((a, b) => b.created_at - a.created_at);
}

export function listSchedules(): PanelSchedule[] {
  return listScheduleRows().map(mapSchedule);
}

export function findScheduleRow(id: string): ScheduleRow | undefined {
  return listScheduleRows().find((s) => s.id === id);
}

export function getSchedule(id: string): PanelSchedule | null {
  const row = findScheduleRow(id);
  return row ? mapSchedule(row) : null;
}

function validatePayload(
  taskType: ScheduleTaskType,
  payload: Record<string, string>,
): { ok: true; value: Record<string, string> } | { ok: false; error: string } {
  switch (taskType) {
    case "template_sync": {
      const pattern = payload.pattern?.trim();
      if (!pattern) return { ok: false, error: "Template sync requires a pattern" };
      return { ok: true, value: { pattern } };
    }
    case "instance_restart":
    case "instance_start":
    case "instance_stop": {
      const instanceId = payload.instanceId?.trim();
      if (!instanceId) return { ok: false, error: "Instance task requires an instance ID" };
      return { ok: true, value: { instanceId } };
    }
    case "command": {
      const command = payload.command?.trim();
      if (!command) return { ok: false, error: "Command task requires a command string" };
      return { ok: true, value: { command } };
    }
    default:
      return { ok: false, error: "Unknown task type" };
  }
}

export function validateScheduleInput(input: {
  name?: string;
  enabled?: boolean;
  clusterId?: string;
  cron?: string;
  taskType?: ScheduleTaskType;
  payload?: Record<string, string>;
}): { ok: true; value: Omit<ScheduleRow, "id" | "created_at" | "updated_at" | "last_run_at" | "last_run_status" | "last_run_message"> } | { ok: false; error: string } {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required" };

  const clusterId = input.clusterId?.trim();
  if (!clusterId) return { ok: false, error: "Cluster is required" };
  if (!findClusterRowById(clusterId)) return { ok: false, error: "Cluster not found" };

  const cronRaw = input.cron?.trim();
  if (!cronRaw) return { ok: false, error: "Cron expression is required" };
  const cronResult = validateCronExpression(cronRaw);
  if (!cronResult.ok) return cronResult;

  const taskType = input.taskType;
  if (!taskType) return { ok: false, error: "Invalid task type" };

  const payloadResult = validatePayload(taskType, input.payload ?? {});
  if (!payloadResult.ok) return payloadResult;

  return {
    ok: true,
    value: {
      name,
      enabled: input.enabled ?? true,
      cluster_id: clusterId,
      cron: cronResult.value,
      task_type: taskType,
      payload: payloadResult.value,
    },
  };
}

export function createSchedule(input: {
  name: string;
  enabled?: boolean;
  clusterId: string;
  cron: string;
  taskType: ScheduleTaskType;
  payload: Record<string, string>;
}): PanelSchedule {
  const validated = validateScheduleInput(input);
  if (!validated.ok) throw new Error(validated.error);

  const now = Date.now();
  const row: ScheduleRow = {
    id: randomUUID(),
    created_at: now,
    updated_at: now,
    last_run_at: null,
    last_run_status: null,
    last_run_message: null,
    ...validated.value,
  };

  const store = getStore();
  store.schedules = [...(store.schedules ?? []), row];
  saveStore(store);
  return mapSchedule(row);
}

export function updateSchedule(
  id: string,
  patch: {
    name?: string;
    enabled?: boolean;
    clusterId?: string;
    cron?: string;
    taskType?: ScheduleTaskType;
    payload?: Record<string, string>;
  },
): PanelSchedule | null {
  const existing = findScheduleRow(id);
  if (!existing) return null;

  const merged = {
    name: patch.name ?? existing.name,
    enabled: patch.enabled ?? existing.enabled,
    clusterId: patch.clusterId ?? existing.cluster_id,
    cron: patch.cron ?? existing.cron,
    taskType: patch.taskType ?? existing.task_type,
    payload: patch.payload ?? existing.payload,
  };

  const validated = validateScheduleInput(merged);
  if (!validated.ok) throw new Error(validated.error);

  const store = getStore();
  const index = store.schedules?.findIndex((s) => s.id === id) ?? -1;
  if (index < 0) return null;

  const row: ScheduleRow = {
    ...existing,
    ...validated.value,
    updated_at: Date.now(),
  };
  store.schedules![index] = row;
  saveStore(store);
  return mapSchedule(row);
}

export function deleteSchedule(id: string): boolean {
  const store = getStore();
  const before = store.schedules?.length ?? 0;
  store.schedules = (store.schedules ?? []).filter((s) => s.id !== id);
  if ((store.schedules?.length ?? 0) === before) return false;
  saveStore(store);
  return true;
}

function lifecycleTarget(taskType: ScheduleTaskType): "start" | "stop" | "restart" | null {
  switch (taskType) {
    case "instance_start":
      return "start";
    case "instance_stop":
      return "stop";
    case "instance_restart":
      return "restart";
    default:
      return null;
  }
}

async function readResponseMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return response.statusText;
  try {
    const body = JSON.parse(text) as { message?: string; error?: string; output?: string };
    return body.message ?? body.error ?? body.output ?? text;
  } catch {
    return text;
  }
}

export async function executeScheduleRow(row: ScheduleRow): Promise<ScheduleRunResult> {
  const ranAt = Date.now();

  try {
    switch (row.task_type) {
      case "template_sync": {
        const response = await fetchClusterApi(row.cluster_id, "templates/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pattern: row.payload.pattern }),
        });
        if (!response.ok) {
          throw new Error(await readResponseMessage(response));
        }
        const message = await readResponseMessage(response);
        return { scheduleId: row.id, name: row.name, status: "success", message, ranAt };
      }
      case "instance_start":
      case "instance_stop":
      case "instance_restart": {
        const target = lifecycleTarget(row.task_type)!;
        const instanceId = row.payload.instanceId!;
        const response = await fetchClusterApi(
          row.cluster_id,
          `instances/${encodeURIComponent(instanceId)}/lifecycle?target=${target}`,
          { method: "PATCH" },
        );
        if (!response.ok) {
          throw new Error(await readResponseMessage(response));
        }
        const message = await readResponseMessage(response);
        return {
          scheduleId: row.id,
          name: row.name,
          status: "success",
          message: message || `Instance ${instanceId} ${target}`,
          ranAt,
        };
      }
      case "command": {
        const response = await fetchClusterApi(row.cluster_id, "commands/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: row.payload.command }),
        });
        if (!response.ok) {
          throw new Error(await readResponseMessage(response));
        }
        const message = await readResponseMessage(response);
        return { scheduleId: row.id, name: row.name, status: "success", message, ranAt };
      }
      default:
        throw new Error(`Unsupported task type: ${row.task_type}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Schedule execution failed";
    return { scheduleId: row.id, name: row.name, status: "failure", message, ranAt };
  }
}

function recordScheduleRun(row: ScheduleRow, result: ScheduleRunResult) {
  const store = getStore();
  const index = store.schedules?.findIndex((s) => s.id === row.id) ?? -1;
  if (index < 0) return;
  store.schedules![index] = {
    ...store.schedules![index]!,
    last_run_at: result.ranAt,
    last_run_status: result.status,
    last_run_message: result.message,
    updated_at: Date.now(),
  };
  saveStore(store);
}

function sameMinute(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate() &&
    da.getHours() === db.getHours() &&
    da.getMinutes() === db.getMinutes()
  );
}

function isScheduleDue(row: ScheduleRow, now: Date): boolean {
  if (!row.enabled) return false;
  if (!cronMatches(row.cron, now)) return false;
  if (row.last_run_at && sameMinute(row.last_run_at, now.getTime())) return false;
  return true;
}

export async function runDueSchedules(now: Date = new Date()): Promise<ScheduleRunResult[]> {
  const due = listScheduleRows().filter((row) => isScheduleDue(row, now));
  const results: ScheduleRunResult[] = [];

  for (const row of due) {
    const result = await executeScheduleRow(row);
    recordScheduleRun(row, result);
    results.push(result);
  }

  return results;
}

export async function runScheduleNow(id: string): Promise<ScheduleRunResult | null> {
  const row = findScheduleRow(id);
  if (!row) return null;
  const result = await executeScheduleRow(row);
  recordScheduleRun(row, result);
  return result;
}

let runnerInFlight = false;

export async function tickScheduleRunner(): Promise<ScheduleRunResult[]> {
  if (runnerInFlight) return [];
  runnerInFlight = true;
  try {
    return await runDueSchedules();
  } finally {
    runnerInFlight = false;
  }
}

export function startScheduleRunner() {
  if (runnerStarted || typeof setInterval !== "function") return;
  runnerStarted = true;

  void tickScheduleRunner();
  runnerTimer = setInterval(() => {
    void tickScheduleRunner();
  }, 60_000);

  if (typeof runnerTimer === "object" && runnerTimer && "unref" in runnerTimer) {
    (runnerTimer as NodeJS.Timeout).unref();
  }
}

export function stopScheduleRunner() {
  if (runnerTimer) clearInterval(runnerTimer);
  runnerTimer = null;
  runnerStarted = false;
}
