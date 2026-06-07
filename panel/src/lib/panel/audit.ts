import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { SessionPayload } from "@/lib/panel/session";
import type { PanelRole } from "@/lib/panel/permissions";
import { dataDir } from "@/lib/panel/store";
import {
  detectUniverseAuditAction,
  type AuditAction,
  type AuditEvent,
} from "@/lib/panel/audit-shared";

export type { AuditAction, AuditEvent } from "@/lib/panel/audit-shared";
export {
  AUDIT_ACTION_LABELS,
  AUDIT_VIEW_PERMISSION,
  canViewAuditLog,
  formatAuditTimestamp,
  summarizeAuditDetails,
  detectUniverseAuditAction,
} from "@/lib/panel/audit-shared";

const MAX_AUDIT_ENTRIES = 2000;

interface AuditStore {
  version: 1;
  entries: AuditEvent[];
}

let cachedAudit: AuditStore | null = null;

function auditPath() {
  return path.join(dataDir(), "audit.json");
}

function defaultAuditStore(): AuditStore {
  return { version: 1, entries: [] };
}

function loadAuditStore(): AuditStore {
  if (cachedAudit) return cachedAudit;
  const file = auditPath();
  if (!fs.existsSync(file)) {
    cachedAudit = defaultAuditStore();
    return cachedAudit;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as AuditStore;
    cachedAudit = {
      version: 1,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    cachedAudit = defaultAuditStore();
  }
  return cachedAudit;
}

function writeAuditStore(store: AuditStore) {
  const file = auditPath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, file);
  cachedAudit = store;
}

export function requestClientIp(request?: Request): string | null {
  if (!request) return null;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

export interface RecordAuditInput {
  action: AuditAction;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: PanelRole;
  clusterId?: string | null;
  clusterName?: string | null;
  ip?: string | null;
  details?: Record<string, string | number | boolean | null>;
}

export function recordAuditEvent(input: RecordAuditInput): AuditEvent {
  const event: AuditEvent = {
    id: randomUUID(),
    timestamp: Date.now(),
    action: input.action,
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    userRole: input.userRole,
    clusterId: input.clusterId ?? null,
    clusterName: input.clusterName ?? null,
    ip: input.ip ?? null,
    details: input.details ?? {},
  };

  const store = loadAuditStore();
  store.entries.unshift(event);
  if (store.entries.length > MAX_AUDIT_ENTRIES) {
    store.entries.length = MAX_AUDIT_ENTRIES;
  }
  writeAuditStore(store);
  return event;
}

export function recordAuditFromSession(
  session: SessionPayload,
  input: Omit<RecordAuditInput, "userId" | "userEmail" | "userName" | "userRole"> & {
    request?: Request;
  },
): AuditEvent {
  return recordAuditEvent({
    ...input,
    userId: session.sub,
    userEmail: session.email,
    userName: session.name,
    userRole: session.role,
    ip: input.ip ?? requestClientIp(input.request),
  });
}

export interface ListAuditOptions {
  limit?: number;
  offset?: number;
  action?: AuditAction;
  clusterId?: string;
  userId?: string;
}

export function listAuditEvents(options: ListAuditOptions = {}): {
  events: AuditEvent[];
  total: number;
} {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);

  let entries = loadAuditStore().entries;
  if (options.action) entries = entries.filter((e) => e.action === options.action);
  if (options.clusterId) entries = entries.filter((e) => e.clusterId === options.clusterId);
  if (options.userId) entries = entries.filter((e) => e.userId === options.userId);

  const total = entries.length;
  return { events: entries.slice(offset, offset + limit), total };
}

export async function maybeAuditUniverseMutation(
  session: SessionPayload,
  request: Request,
  apiPath: string,
  upstreamStatus: number,
  cluster?: { id: string; name: string } | null,
) {
  if (upstreamStatus < 200 || upstreamStatus >= 300) return;

  const detected = detectUniverseAuditAction(request.method, apiPath);
  if (!detected) return;

  recordAuditFromSession(session, {
    action: detected.action,
    request,
    clusterId: cluster?.id ?? null,
    clusterName: cluster?.name ?? null,
    details: detected.details,
  });
}
