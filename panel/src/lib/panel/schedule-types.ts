export type ScheduleTaskType =
  | "template_sync"
  | "instance_restart"
  | "instance_start"
  | "instance_stop"
  | "command";

export type ScheduleRunStatus = "success" | "failure";

export interface ScheduleRow {
  id: string;
  name: string;
  enabled: boolean;
  cluster_id: string;
  cron: string;
  task_type: ScheduleTaskType;
  payload: Record<string, string>;
  created_at: number;
  updated_at: number;
  last_run_at: number | null;
  last_run_status: ScheduleRunStatus | null;
  last_run_message: string | null;
}

export interface PanelSchedule {
  id: string;
  name: string;
  enabled: boolean;
  clusterId: string;
  cron: string;
  taskType: ScheduleTaskType;
  payload: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  lastRunAt: number | null;
  lastRunStatus: ScheduleRunStatus | null;
  lastRunMessage: string | null;
  nextRunAt: number | null;
}

export interface ScheduleRunResult {
  scheduleId: string;
  name: string;
  status: ScheduleRunStatus;
  message: string;
  ranAt: number;
}

/** Minimal cluster reference for schedule UI (client-safe). */
export interface ScheduleClusterOption {
  id: string;
  name: string;
}

const CRON_PRESETS: Record<string, string> = {
  "@hourly": "0 * * * *",
  "@daily": "0 0 * * *",
  "@weekly": "0 0 * * 0",
};

const TASK_LABELS: Record<ScheduleTaskType, string> = {
  template_sync: "Template sync",
  instance_restart: "Instance restart",
  instance_start: "Instance start",
  instance_stop: "Instance stop",
  command: "Console command",
};

export function taskTypeLabel(taskType: ScheduleTaskType): string {
  return TASK_LABELS[taskType];
}

export function normalizeCronExpression(input: string): string {
  const trimmed = input.trim();
  const preset = CRON_PRESETS[trimmed.toLowerCase()];
  if (preset) return preset;
  return trimmed.replace(/\s+/g, " ");
}

export function validateCronExpression(cron: string): { ok: true; value: string } | { ok: false; error: string } {
  const normalized = normalizeCronExpression(cron);
  const parts = normalized.split(" ");
  if (parts.length !== 5) {
    return { ok: false, error: "Cron must have 5 fields: minute hour day month weekday" };
  }

  const ranges = [
    { field: parts[0]!, min: 0, max: 59, label: "minute" },
    { field: parts[1]!, min: 0, max: 23, label: "hour" },
    { field: parts[2]!, min: 1, max: 31, label: "day" },
    { field: parts[3]!, min: 1, max: 12, label: "month" },
    { field: parts[4]!, min: 0, max: 7, label: "weekday" },
  ];

  for (const { field, min, max, label } of ranges) {
    if (!isValidCronField(field, min, max)) {
      return { ok: false, error: `Invalid ${label} field in cron expression` };
    }
  }

  return { ok: true, value: normalized };
}

function isValidCronField(field: string, min: number, max: number): boolean {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    if (!isValidCronPart(part, min, max)) return false;
  }
  return true;
}

function isValidCronPart(part: string, min: number, max: number): boolean {
  const stepMatch = part.match(/^(.+)\/(\d+)$/);
  const base = stepMatch ? stepMatch[1]! : part;
  const step = stepMatch ? Number(stepMatch[2]) : null;
  if (step !== null && (!Number.isInteger(step) || step <= 0)) return false;

  if (base === "*") return true;

  if (base.includes("-")) {
    const [startRaw, endRaw] = base.split("-");
    const start = Number(startRaw);
    const end = Number(endRaw);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      return false;
    }
    return true;
  }

  const value = Number(base);
  return Number.isInteger(value) && value >= min && value <= max;
}

function matchCronField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  return field.split(",").some((part) => matchCronPart(part, value, min, max));
}

function matchCronPart(part: string, value: number, min: number, max: number): boolean {
  const stepMatch = part.match(/^(.+)\/(\d+)$/);
  const base = stepMatch ? stepMatch[1]! : part;
  const step = stepMatch ? Number(stepMatch[2]) : 1;

  if (base === "*") {
    return (value - min) % step === 0;
  }

  if (base.includes("-")) {
    const [startRaw, endRaw] = base.split("-");
    const start = Number(startRaw);
    const end = Number(endRaw);
    if (value < start || value > end) return false;
    return (value - start) % step === 0;
  }

  const exact = Number(base);
  return exact === value;
}

function cronWeekday(date: Date): number {
  return date.getDay();
}

export function cronMatches(cron: string, date: Date = new Date()): boolean {
  const normalized = normalizeCronExpression(cron);
  const [minute, hour, day, month, weekday] = normalized.split(" ");
  const weekdayValue = cronWeekday(date);
  const weekdayMatch =
    matchCronField(weekday!, weekdayValue, 0, 7) ||
    (weekdayValue === 0 && matchCronField(weekday!, 7, 0, 7));

  return (
    matchCronField(minute!, date.getMinutes(), 0, 59) &&
    matchCronField(hour!, date.getHours(), 0, 23) &&
    matchCronField(day!, date.getDate(), 1, 31) &&
    matchCronField(month!, date.getMonth() + 1, 1, 12) &&
    weekdayMatch
  );
}

export function computeNextRun(cron: string, from: Date = new Date()): number | null {
  const normalized = normalizeCronExpression(cron);
  if (!validateCronExpression(normalized).ok) return null;

  const probe = new Date(from);
  probe.setSeconds(0, 0);
  probe.setMinutes(probe.getMinutes() + 1);

  const limit = probe.getTime() + 366 * 24 * 60 * 60 * 1000;
  while (probe.getTime() < limit) {
    if (cronMatches(normalized, probe)) return probe.getTime();
    probe.setMinutes(probe.getMinutes() + 1);
  }
  return null;
}

export const CRON_EXAMPLES = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every Sunday at midnight", value: "0 0 * * 0" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Weekdays at 6 AM", value: "0 6 * * 1-5" },
] as const;

export const SCHEDULE_TASK_TYPES: ScheduleTaskType[] = [
  "template_sync",
  "instance_restart",
  "instance_start",
  "instance_stop",
  "command",
];
