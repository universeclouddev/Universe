import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { dataDir } from "@/lib/panel/store";
import type { SessionPayload } from "@/lib/panel/session";
import type {
  ActivityEvent,
  ActivityFilters,
} from "@/lib/panel/activity-types";

export type {
  ActivityEvent,
  ActivityFilters,
  ActivitySeverity,
  ActivityType,
} from "@/lib/panel/activity-types";

export {
  ACTIVITY_SEVERITY_LABELS,
  ACTIVITY_TYPE_LABELS,
} from "@/lib/panel/activity-types";

interface ActivityStore {
  version: 1;
  events: ActivityEvent[];
}

const STORE_VERSION = 1 as const;
const MAX_EVENTS = 500;

let cachedStore: ActivityStore | null = null;

function activityPath() {
  return path.join(dataDir(), "activity.json");
}

function defaultStore(): ActivityStore {
  return { version: STORE_VERSION, events: [] };
}

function loadStoreFromDisk(): ActivityStore {
  const file = activityPath();
  if (!fs.existsSync(file)) return defaultStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as ActivityStore;
    if (parsed.version !== STORE_VERSION) return defaultStore();
    return { version: STORE_VERSION, events: parsed.events ?? [] };
  } catch {
    return defaultStore();
  }
}

function writeStore(store: ActivityStore) {
  const file = activityPath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, file);
  cachedStore = store;
}

function getStore(): ActivityStore {
  if (!cachedStore) cachedStore = loadStoreFromDisk();
  return cachedStore;
}

export function recordActivity(
  input: Omit<ActivityEvent, "id" | "timestamp"> & { id?: string; timestamp?: number },
): ActivityEvent {
  const event: ActivityEvent = {
    id: input.id ?? randomUUID(),
    timestamp: input.timestamp ?? Date.now(),
    type: input.type,
    severity: input.severity,
    clusterId: input.clusterId,
    clusterName: input.clusterName,
    message: input.message,
    actorEmail: input.actorEmail,
    metadata: input.metadata,
  };

  const store = getStore();
  store.events.unshift(event);
  if (store.events.length > MAX_EVENTS) {
    store.events = store.events.slice(0, MAX_EVENTS);
  }
  writeStore(store);
  return event;
}

export function listActivityEvents(filters: ActivityFilters = {}): ActivityEvent[] {
  let events = [...getStore().events];

  if (filters.clusterId) {
    events = events.filter((e) => e.clusterId === filters.clusterId);
  }
  if (filters.severity) {
    events = events.filter((e) => e.severity === filters.severity);
  }
  if (filters.type) {
    events = events.filter((e) => e.type === filters.type);
  }

  const limit = filters.limit ?? 100;
  return events.slice(0, limit);
}

export function recordProxyActivityIfApplicable(input: {
  session: SessionPayload | null;
  cluster: { id: string; name: string };
  method: string;
  apiPath: string;
  searchParams: URLSearchParams;
  status: number;
}): void {
  if (input.status < 200 || input.status >= 300 || !input.session) return;

  const { method, apiPath, searchParams, session, cluster } = input;
  const segments = apiPath.split("/").filter(Boolean);
  const base = {
    clusterId: cluster.id,
    clusterName: cluster.name,
    actorEmail: session.email,
  };

  if (method === "PATCH" && segments[0] === "instances" && segments[2] === "lifecycle") {
    const instanceId = segments[1] ?? "unknown";
    const target = searchParams.get("target") ?? "change";
    recordActivity({
      ...base,
      type: "instance.lifecycle",
      severity: target === "stop" ? "warning" : "success",
      message: `Instance ${instanceId} → ${target}`,
      metadata: { instanceId, target },
    });
    return;
  }

  if (method === "PUT" && segments[0] === "configurations" && segments.length === 2) {
    const name = decodeURIComponent(segments[1]!);
    recordActivity({
      ...base,
      type: "config.save",
      severity: "info",
      message: `Configuration "${name}" saved`,
      metadata: { name },
    });
    return;
  }

  if (method === "POST" && segments[0] === "instances" && segments.length === 1) {
    recordActivity({
      ...base,
      type: "instance.lifecycle",
      severity: "success",
      message: "New instance created",
    });
    return;
  }

  if (method === "DELETE" && segments[0] === "instances" && segments.length === 2) {
    const instanceId = segments[1] ?? "unknown";
    recordActivity({
      ...base,
      type: "instance.lifecycle",
      severity: "warning",
      message: `Instance ${instanceId} deleted`,
      metadata: { instanceId, target: "delete" },
    });
  }
}
