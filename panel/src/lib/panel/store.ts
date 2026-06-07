import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface PanelUserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  role: string;
  oidc_subject: string | null;
  created_at: number;
}

import type { ClusterHealthSettings } from "@/lib/panel/cluster-health";
import type { PanelAlertsRow } from "@/lib/panel/alerts";
import type { ScheduleRow } from "@/lib/panel/schedule-types";

export interface ClusterRow {
  id: string;
  name: string;
  api_url: string;
  api_token: string;
  created_at: number;
  sort_order: number;
  health?: ClusterHealthSettings;
}

export interface TemplateFileVersion {
  id: string;
  content: string;
  savedAt: number;
  savedBy?: string;
}

interface PanelStore {
  version: 1;
  users: PanelUserRow[];
  settings: Record<string, string>;
  clusters: ClusterRow[];
  alerts?: PanelAlertsRow;
  schedules: ScheduleRow[];
  templateVersions?: Record<string, TemplateFileVersion[]>;
}

const STORE_VERSION = 1 as const;

let cachedStore: PanelStore | null = null;

export function dataDir() {
  const dir =
    process.env.PANEL_DATA_DIR ??
    path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function storePath() {
  return path.join(dataDir(), "panel.json");
}

function defaultStore(): PanelStore {
  return { version: STORE_VERSION, users: [], settings: {}, clusters: [], schedules: [] };
}

function loadStoreFromDisk(): PanelStore {
  const file = storePath();
  let store: PanelStore;
  if (!fs.existsSync(file)) {
    store = defaultStore();
  } else {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as PanelStore;
      if (parsed.version !== STORE_VERSION) {
        throw new Error(`Unsupported panel store version: ${parsed.version}`);
      }
      store = {
        version: STORE_VERSION,
        users: parsed.users ?? [],
        settings: parsed.settings ?? {},
        clusters: parsed.clusters ?? [],
        alerts: parsed.alerts,
        schedules: parsed.schedules ?? [],
        templateVersions: parsed.templateVersions ?? {},
      };
    } catch {
      const backup = `${file}.broken-${Date.now()}`;
      fs.copyFileSync(file, backup);
      store = defaultStore();
    }
  }

  store = migrateLegacyConnectionSettings(store);
  store = migrateRoleHierarchyV2(store);
  store = normalizePrimaryUserRole(store);
  writeStore(store);
  return store;
}

function migrateLegacyConnectionSettings(store: PanelStore): PanelStore {
  const apiUrl = store.settings["universe.api_url"];
  const encToken = store.settings["universe.api_token"];
  if (store.clusters.length > 0 || !apiUrl || !encToken) return store;

  const id = randomUUID();
  return {
    ...store,
    clusters: [
      ...store.clusters,
      {
        id,
        name: "Default",
        api_url: apiUrl,
        api_token: encToken,
        created_at: Date.now(),
        sort_order: 0,
      },
    ],
    settings: (() => {
      const next: Record<string, string> = { ...store.settings, active_cluster_id: id };
      delete next["universe.api_url"];
      delete next["universe.api_token"];
      return next;
    })(),
  };
}

function writeStore(store: PanelStore) {
  const file = storePath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, file);
  cachedStore = store;
}

export function getStore(): PanelStore {
  if (!cachedStore) cachedStore = loadStoreFromDisk();
  return cachedStore;
}

export function saveStore(store: PanelStore) {
  writeStore(store);
}

export function countUsers(): number {
  return getStore().users.length;
}

export function getSetting(key: string): string | null {
  return getStore().settings[key] ?? null;
}

export function setSetting(key: string, value: string) {
  const store = getStore();
  store.settings[key] = value;
  saveStore(store);
}

export function deleteSetting(key: string) {
  const store = getStore();
  delete store.settings[key];
  saveStore(store);
}

/** Top-tier role — permanently assigned to the primary (first-created) user. */
export const PRIMARY_USER_ROLE = "operator" as const;

/**
 * Primary user = earliest `created_at` in the panel store (setup / auto-setup account).
 * Their role is always `operator`, cannot be deleted, and role changes are rejected by API + UI.
 */
export function getPrimaryUserId(): string | null {
  const users = [...getStore().users].sort((a, b) => a.created_at - b.created_at);
  return users[0]?.id ?? null;
}

/** One-time swap: old `admin` (top) → `operator`, old `operator` (middle) → `admin`. */
function migrateRoleHierarchyV2(store: PanelStore): PanelStore {
  if (store.settings["roles.hierarchy_v2"] === "true") return store;

  const primaryId = [...store.users].sort((a, b) => a.created_at - b.created_at)[0]?.id;
  let changed = false;
  const users = store.users.map((u) => {
    if (u.id === primaryId) {
      if (u.role !== PRIMARY_USER_ROLE) {
        changed = true;
        return { ...u, role: PRIMARY_USER_ROLE };
      }
      return u;
    }
    if (u.role === "admin") {
      changed = true;
      return { ...u, role: "operator" };
    }
    if (u.role === "operator") {
      changed = true;
      return { ...u, role: "admin" };
    }
    return u;
  });

  return {
    ...store,
    users: changed ? users : store.users,
    settings: { ...store.settings, "roles.hierarchy_v2": "true" },
  };
}

export function isPrimaryUserId(id: string): boolean {
  const primaryId = getPrimaryUserId();
  return primaryId !== null && primaryId === id;
}

export function isPrimaryUserRow(row: Pick<PanelUserRow, "id">): boolean {
  return isPrimaryUserId(row.id);
}

function normalizePrimaryUserRole(store: PanelStore): PanelStore {
  const primaryId = [...store.users].sort((a, b) => a.created_at - b.created_at)[0]?.id;
  if (!primaryId) return store;

  let changed = false;
  const users = store.users.map((u) => {
    if (u.id === primaryId && u.role !== PRIMARY_USER_ROLE) {
      changed = true;
      return { ...u, role: PRIMARY_USER_ROLE };
    }
    return u;
  });
  return changed ? { ...store, users } : store;
}

export function listUserRows(): PanelUserRow[] {
  return [...getStore().users].sort((a, b) => a.created_at - b.created_at);
}

export function findUserRowByEmail(email: string): PanelUserRow | undefined {
  const normalized = email.toLowerCase();
  return getStore().users.find((u) => u.email === normalized);
}

export function findUserRowById(id: string): PanelUserRow | undefined {
  return getStore().users.find((u) => u.id === id);
}

export function findUserRowByOidcSubject(subject: string): PanelUserRow | undefined {
  return getStore().users.find((u) => u.oidc_subject === subject);
}

export function insertUserRow(row: PanelUserRow) {
  const store = getStore();
  store.users.push(row);
  saveStore(store);
}

export function updateUserRow(id: string, patch: Partial<PanelUserRow>) {
  const store = getStore();
  const index = store.users.findIndex((u) => u.id === id);
  if (index < 0) return;
  const next = { ...store.users[index]!, ...patch };
  if (isPrimaryUserId(id)) {
    next.role = PRIMARY_USER_ROLE;
  }
  store.users[index] = next;
  saveStore(store);
}

export function deleteUserRow(id: string): boolean {
  if (isPrimaryUserId(id)) return false;
  const store = getStore();
  const before = store.users.length;
  store.users = store.users.filter((u) => u.id !== id);
  if (store.users.length === before) return false;
  saveStore(store);
  return true;
}

export function listClusterRows(): ClusterRow[] {
  return [...getStore().clusters].sort((a, b) => a.sort_order - b.sort_order || a.created_at - b.created_at);
}

export function findClusterRowById(id: string): ClusterRow | undefined {
  return getStore().clusters.find((c) => c.id === id);
}

export function insertClusterRow(row: ClusterRow) {
  const store = getStore();
  store.clusters.push(row);
  saveStore(store);
}

export function updateClusterRow(id: string, patch: Partial<ClusterRow>) {
  const store = getStore();
  const index = store.clusters.findIndex((c) => c.id === id);
  if (index < 0) return;
  store.clusters[index] = { ...store.clusters[index]!, ...patch };
  saveStore(store);
}

export function deleteClusterRow(id: string): boolean {
  const store = getStore();
  const before = store.clusters.length;
  store.clusters = store.clusters.filter((c) => c.id !== id);
  if (store.clusters.length === before) return false;
  saveStore(store);
  return true;
}

export function countClusterRows(): number {
  return getStore().clusters.length;
}
