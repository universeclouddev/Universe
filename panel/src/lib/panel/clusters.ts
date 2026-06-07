import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import {
  countClusterRows,
  deleteClusterRow,
  findClusterRowById,
  getSetting,
  insertClusterRow,
  listClusterRows,
  setSetting,
  deleteSetting,
  updateClusterRow,
  type ClusterRow,
} from "@/lib/panel/store";
import { decryptSecret, encryptSecret } from "@/lib/panel/crypto";
import {
  mergeClusterHealth,
  resolveClusterHealth,
  type ClusterHealthSettings,
} from "@/lib/panel/cluster-health";

export const ACTIVE_CLUSTER_COOKIE = "panel_active_cluster";

export type { ClusterHealthSettings };

export interface PanelCluster {
  id: string;
  name: string;
  apiUrl: string;
  hasToken: boolean;
  createdAt: number;
  sortOrder: number;
  health: ClusterHealthSettings;
}

export interface PanelClusterConnection {
  id: string;
  name: string;
  apiUrl: string;
  apiToken: string;
}

function mapCluster(row: ClusterRow): PanelCluster {
  return {
    id: row.id,
    name: row.name,
    apiUrl: row.api_url,
    hasToken: !!row.api_token,
    createdAt: row.created_at,
    sortOrder: row.sort_order,
    health: resolveClusterHealth(row.health),
  };
}

function migrateLegacySingleConnection() {
  // handled in store.ts on load
}

export function migrateClustersTable() {
  migrateLegacySingleConnection();
}

export function listClusters(): PanelCluster[] {
  return listClusterRows().map(mapCluster);
}

export function getCluster(id: string): PanelCluster | null {
  const row = findClusterRowById(id);
  return row ? mapCluster(row) : null;
}

export function getClusterConnection(id: string): PanelClusterConnection | null {
  const row = findClusterRowById(id);
  if (!row) return null;
  try {
    return {
      id: row.id,
      name: row.name,
      apiUrl: row.api_url,
      apiToken: decryptSecret(row.api_token),
    };
  } catch {
    return null;
  }
}

export async function getActiveClusterIdFromCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACTIVE_CLUSTER_COOKIE)?.value ?? null;
}

export function getDefaultActiveClusterId(): string | null {
  const clusters = listClusters();
  if (clusters.length === 0) return null;
  const stored = getSetting("active_cluster_id");
  if (stored && clusters.some((c) => c.id === stored)) return stored;
  return clusters[0]!.id;
}

export async function resolveActiveClusterConnection(): Promise<PanelClusterConnection | null> {
  const cookieId = await getActiveClusterIdFromCookie();
  const clusters = listClusters();
  if (clusters.length === 0) return null;

  let id = cookieId;
  if (!id || !clusters.some((c) => c.id === id)) {
    id = getDefaultActiveClusterId();
  }
  if (!id) return null;
  return getClusterConnection(id);
}

export async function setActiveClusterCookie(clusterId: string) {
  const jar = await cookies();
  jar.set(ACTIVE_CLUSTER_COOKIE, clusterId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  setSetting("active_cluster_id", clusterId);
}

export async function fetchClusterPing(apiUrl: string): Promise<{
  clusterName: string;
  nodeId: string;
  master: boolean;
} | null> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/ping`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      clusterName?: string;
      nodeId?: string;
      master?: boolean;
    };
    if (!data.clusterName) return null;
    return {
      clusterName: data.clusterName,
      nodeId: data.nodeId ?? "",
      master: !!data.master,
    };
  } catch {
    return null;
  }
}

function resolveClusterName(apiUrl: string, explicitName?: string): Promise<string> {
  const trimmed = explicitName?.trim();
  if (trimmed) return Promise.resolve(trimmed);
  return fetchClusterPing(apiUrl).then((ping) => ping?.clusterName ?? "Universe cluster");
}

export async function validateUniverseKey(apiUrl: string, apiToken: string): Promise<void> {
  const probe = await fetch(`${apiUrl.replace(/\/$/, "")}/api/node`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!probe.ok) {
    throw new Error("API key validation failed — ensure the key has ALL permissions");
  }
}

export async function createCluster(input: {
  name?: string;
  apiUrl: string;
  apiToken: string;
}): Promise<PanelCluster> {
  const apiUrl = input.apiUrl.replace(/\/$/, "");
  await validateUniverseKey(apiUrl, input.apiToken);
  const name = await resolveClusterName(apiUrl, input.name);

  const id = randomUUID();
  const sortOrder = countClusterRows();

  insertClusterRow({
    id,
    name,
    api_url: apiUrl,
    api_token: encryptSecret(input.apiToken),
    created_at: Date.now(),
    sort_order: sortOrder,
  });

  if (sortOrder === 0) {
    setSetting("active_cluster_id", id);
  }

  return getCluster(id)!;
}

export async function updateCluster(
  id: string,
  patch: {
    name?: string;
    apiUrl?: string;
    apiToken?: string;
    health?: Partial<ClusterHealthSettings>;
  },
): Promise<PanelCluster | null> {
  const existing = findClusterRowById(id);
  if (!existing) return null;

  const apiUrl = patch.apiUrl?.replace(/\/$/, "") ?? existing.api_url;
  let apiToken = existing.api_token;

  if (patch.apiToken) {
    await validateUniverseKey(apiUrl, patch.apiToken);
    apiToken = encryptSecret(patch.apiToken);
  } else if (patch.apiUrl && patch.apiUrl !== existing.api_url) {
    const decrypted = decryptSecret(existing.api_token);
    await validateUniverseKey(apiUrl, decrypted);
  }

  const name =
    patch.name !== undefined
      ? patch.name.trim() || (await resolveClusterName(apiUrl))
      : patch.apiUrl && patch.apiUrl !== existing.api_url
        ? await resolveClusterName(apiUrl)
        : existing.name;

  const health =
    patch.health !== undefined
      ? mergeClusterHealth(existing.health, patch.health)
      : existing.health;

  updateClusterRow(id, { name, api_url: apiUrl, api_token: apiToken, health });
  return getCluster(id);
}

export function deleteCluster(id: string): boolean {
  if (!deleteClusterRow(id)) return false;

  const remaining = listClusters();
  const active = getSetting("active_cluster_id");
  if (active === id) {
    if (remaining[0]) {
      setSetting("active_cluster_id", remaining[0].id);
    } else {
      deleteSetting("active_cluster_id");
    }
  }
  return true;
}

export function hasAnyCluster(): boolean {
  return listClusters().length > 0;
}
