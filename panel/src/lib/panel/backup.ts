import JSZip from "jszip";
import {
  deleteClusterRow,
  findClusterRowById,
  getSetting,
  insertClusterRow,
  listClusterRows,
  setSetting,
  updateClusterRow,
  type ClusterRow,
} from "@/lib/panel/store";
import { fetchClusterApi, readClusterApiJson } from "@/lib/panel/cluster-proxy";
import { resolveClusterHealth, type ClusterHealthSettings } from "@/lib/panel/cluster-health";
import type { TemplateEntry } from "@/lib/api/types";

export const PANEL_BACKUP_VERSION = 1 as const;
export const PANEL_BACKUP_FORMAT = "universe-panel-backup" as const;

export interface PanelBackupCluster {
  id: string;
  name: string;
  apiUrl: string;
  apiTokenEncrypted: string;
  createdAt: number;
  sortOrder: number;
  health: ClusterHealthSettings;
}

export interface PanelBackupTemplateMeta {
  clusterId: string;
  clusterName: string;
  group: string;
  name: string;
  path: string;
}

export interface PanelBackupTemplateExport {
  clusterId: string;
  group: string;
  name: string;
  exported: boolean;
  error?: string;
  zipBase64?: string;
}

export interface PanelBackupManifest {
  version: typeof PANEL_BACKUP_VERSION;
  format: typeof PANEL_BACKUP_FORMAT;
  exportedAt: string;
  activeClusterId: string | null;
  clusters: PanelBackupCluster[];
  templates: PanelBackupTemplateMeta[];
  templateExports?: PanelBackupTemplateExport[];
}

export interface BuildBackupOptions {
  includeTemplates?: boolean;
}

export interface RestoreBackupOptions {
  restoreClusters?: boolean;
  restoreTemplates?: boolean;
  clusterMode?: "merge" | "replace";
  templateClusterId?: string;
  overwriteTemplates?: boolean;
}

export interface RestoreBackupResult {
  clustersRestored: number;
  clustersSkipped: number;
  templatesImported: number;
  templatesFailed: number;
  templateResults: { group: string; name: string; ok: boolean; error?: string }[];
  warnings: string[];
}

function templateZipPath(clusterId: string, group: string, name: string) {
  return `templates/${clusterId}/${group}__${name}.zip`;
}

function mapClusterRow(row: ClusterRow): PanelBackupCluster {
  return {
    id: row.id,
    name: row.name,
    apiUrl: row.api_url,
    apiTokenEncrypted: row.api_token,
    createdAt: row.created_at,
    sortOrder: row.sort_order,
    health: resolveClusterHealth(row.health),
  };
}

async function fetchClusterTemplates(clusterId: string): Promise<PanelBackupTemplateMeta[]> {
  const cluster = findClusterRowById(clusterId);
  if (!cluster) return [];

  try {
    const entries = await readClusterApiJson<TemplateEntry[]>(clusterId, "templates");
    return entries.map((entry) => ({
      clusterId,
      clusterName: cluster.name,
      group: entry.group,
      name: entry.name,
      path: entry.path,
    }));
  } catch {
    return [];
  }
}

async function exportTemplateZip(
  clusterId: string,
  group: string,
  name: string,
): Promise<{ ok: true; data: ArrayBuffer } | { ok: false; error: string }> {
  try {
    const path = `templates/${encodeURIComponent(group)}/${encodeURIComponent(name)}/export`;
    const response = await fetchClusterApi(clusterId, path);
    if (!response.ok) {
      let message = response.statusText;
      try {
        const body = (await response.json()) as { error?: string };
        message = body.error ?? message;
      } catch {
        // ignore
      }
      return { ok: false, error: message };
    }
    return { ok: true, data: await response.arrayBuffer() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Export failed" };
  }
}

export async function buildBackupManifest(
  options: BuildBackupOptions = {},
): Promise<PanelBackupManifest> {
  const includeTemplates = options.includeTemplates ?? false;
  const rows = listClusterRows();
  const clusters = rows.map(mapClusterRow);
  const activeClusterId = getSetting("active_cluster_id");

  const templates: PanelBackupTemplateMeta[] = [];
  for (const row of rows) {
    const clusterTemplates = await fetchClusterTemplates(row.id);
    templates.push(...clusterTemplates);
  }

  const templateExports: PanelBackupTemplateExport[] = [];

  if (includeTemplates) {
    for (const meta of templates) {
      const result = await exportTemplateZip(meta.clusterId, meta.group, meta.name);
      if (result.ok) {
        templateExports.push({
          clusterId: meta.clusterId,
          group: meta.group,
          name: meta.name,
          exported: true,
          zipBase64: Buffer.from(result.data).toString("base64"),
        });
      } else {
        templateExports.push({
          clusterId: meta.clusterId,
          group: meta.group,
          name: meta.name,
          exported: false,
          error: result.error,
        });
      }
    }
  }

  return {
    version: PANEL_BACKUP_VERSION,
    format: PANEL_BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    activeClusterId,
    clusters,
    templates,
    ...(includeTemplates ? { templateExports } : {}),
  };
}

export async function manifestToJson(manifest: PanelBackupManifest): Promise<string> {
  return JSON.stringify(manifest, null, 2);
}

export async function manifestToZip(manifest: PanelBackupManifest): Promise<Buffer> {
  const zip = new JSZip();
  const manifestForZip: PanelBackupManifest = {
    ...manifest,
    templateExports: manifest.templateExports?.map((entry) => {
      if (!entry.exported || !entry.zipBase64) {
        return { clusterId: entry.clusterId, group: entry.group, name: entry.name, exported: entry.exported, error: entry.error };
      }
      const { zipBase64: _, ...rest } = entry;
      return rest;
    }),
  };

  zip.file("manifest.json", JSON.stringify(manifestForZip, null, 2));

  for (const entry of manifest.templateExports ?? []) {
    if (!entry.exported || !entry.zipBase64) continue;
    zip.file(
      templateZipPath(entry.clusterId, entry.group, entry.name),
      Buffer.from(entry.zipBase64, "base64"),
    );
  }

  const blob = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return blob;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateBackupManifest(data: unknown): PanelBackupManifest | null {
  if (!isRecord(data)) return null;
  if (data.format !== PANEL_BACKUP_FORMAT) return null;
  if (data.version !== PANEL_BACKUP_VERSION) return null;
  if (!Array.isArray(data.clusters) || !Array.isArray(data.templates)) return null;
  if (typeof data.exportedAt !== "string") return null;

  return data as unknown as PanelBackupManifest;
}

export async function parseBackupFile(
  buffer: Buffer,
  filename: string,
): Promise<{ manifest: PanelBackupManifest; templateZips: Map<string, Buffer> }> {
  const lower = filename.toLowerCase();
  const templateZips = new Map<string, Buffer>();

  if (lower.endsWith(".json")) {
    const manifest = validateBackupManifest(JSON.parse(buffer.toString("utf8")));
    if (!manifest) throw new Error("Invalid backup JSON manifest");
    return { manifest, templateZips };
  }

  const zip = await JSZip.loadAsync(buffer);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("Backup zip missing manifest.json");

  const manifest = validateBackupManifest(JSON.parse(await manifestFile.async("string")));
  if (!manifest) throw new Error("Invalid backup manifest in zip");

  for (const [path, file] of Object.entries(zip.files)) {
    if (path === "manifest.json" || file.dir) continue;
    if (!path.startsWith("templates/")) continue;
    templateZips.set(path, Buffer.from(await file.async("arraybuffer")));
  }

  if (manifest.templateExports?.length) {
    for (const entry of manifest.templateExports) {
      if (!entry.exported) continue;
      const zipPath = templateZipPath(entry.clusterId, entry.group, entry.name);
      const zipData = templateZips.get(zipPath);
      if (zipData) {
        entry.zipBase64 = zipData.toString("base64");
      }
    }
  }

  return { manifest, templateZips };
}

function restoreClustersFromManifest(
  manifest: PanelBackupManifest,
  mode: "merge" | "replace",
): { restored: number; skipped: number; warnings: string[] } {
  const warnings: string[] = [];
  let restored = 0;
  let skipped = 0;

  if (mode === "replace") {
    const store = { clusters: listClusterRows() };
    if (store.clusters.length > 0 && manifest.clusters.length === 0) {
      warnings.push("Replace mode skipped — backup contains no clusters");
      return { restored: 0, skipped: store.clusters.length, warnings };
    }
    for (const row of [...store.clusters]) {
      deleteClusterRow(row.id);
    }
  }

  for (const cluster of manifest.clusters) {
    const existing = findClusterRowById(cluster.id);
    const row: ClusterRow = {
      id: cluster.id,
      name: cluster.name,
      api_url: cluster.apiUrl,
      api_token: cluster.apiTokenEncrypted,
      created_at: cluster.createdAt,
      sort_order: cluster.sortOrder,
      health: cluster.health,
    };

    if (existing) {
      updateClusterRow(cluster.id, row);
      restored++;
    } else {
      insertClusterRow(row);
      restored++;
    }
  }

  if (manifest.activeClusterId) {
    const exists = findClusterRowById(manifest.activeClusterId);
    if (exists) {
      setSetting("active_cluster_id", manifest.activeClusterId);
    } else {
      warnings.push("Active cluster from backup was not found after restore");
    }
  }

  return { restored, skipped, warnings };
}

async function importTemplateToCluster(
  clusterId: string,
  group: string,
  name: string,
  zipBytes: Buffer,
  overwrite: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { getClusterConnection } = await import("@/lib/panel/clusters");
  const connection = getClusterConnection(clusterId);
  if (!connection) return { ok: false, error: "Destination cluster not found" };

  const form = new FormData();
  form.append("group", group);
  form.append("name", name);
  form.append("overwrite", String(overwrite));
  form.append(
    "file",
    new Blob([new Uint8Array(zipBytes)], { type: "application/zip" }),
    `${name}.zip`,
  );

  const importUrl = `${connection.apiUrl.replace(/\/$/, "")}/api/templates/import`;
  const response = await fetch(importUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${connection.apiToken}` },
    body: form,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // ignore
    }
    return { ok: false, error: message };
  }

  return { ok: true };
}

export async function restoreBackup(
  manifest: PanelBackupManifest,
  options: RestoreBackupOptions = {},
): Promise<RestoreBackupResult> {
  const restoreClusters = options.restoreClusters ?? true;
  const restoreTemplates = options.restoreTemplates ?? false;
  const clusterMode = options.clusterMode ?? "merge";
  const overwriteTemplates = options.overwriteTemplates ?? true;

  const warnings: string[] = [];
  let clustersRestored = 0;
  let clustersSkipped = 0;

  if (restoreClusters) {
    const clusterResult = restoreClustersFromManifest(manifest, clusterMode);
    clustersRestored = clusterResult.restored;
    clustersSkipped = clusterResult.skipped;
    warnings.push(...clusterResult.warnings);
  }

  const templateResults: RestoreBackupResult["templateResults"] = [];
  let templatesImported = 0;
  let templatesFailed = 0;

  if (restoreTemplates && manifest.templateExports?.length) {
    const { getDefaultActiveClusterId } = await import("@/lib/panel/clusters");
    const targetClusterId = options.templateClusterId ?? getDefaultActiveClusterId();
    if (!targetClusterId) {
      warnings.push("Template restore skipped — no destination cluster configured");
    } else {
      for (const entry of manifest.templateExports) {
        if (!entry.exported || !entry.zipBase64) {
          templateResults.push({
            group: entry.group,
            name: entry.name,
            ok: false,
            error: entry.error ?? "Template was not exported in backup",
          });
          templatesFailed++;
          continue;
        }

        const zipBytes = Buffer.from(entry.zipBase64, "base64");
        const result = await importTemplateToCluster(
          targetClusterId,
          entry.group,
          entry.name,
          zipBytes,
          overwriteTemplates,
        );

        if (result.ok) {
          templateResults.push({ group: entry.group, name: entry.name, ok: true });
          templatesImported++;
        } else {
          templateResults.push({
            group: entry.group,
            name: entry.name,
            ok: false,
            error: result.error,
          });
          templatesFailed++;
        }
      }
    }
  } else if (restoreTemplates && !manifest.templateExports?.length) {
    warnings.push("Template restore requested but backup contains no template archives");
  }

  return {
    clustersRestored,
    clustersSkipped,
    templatesImported,
    templatesFailed,
    templateResults,
    warnings,
  };
}

export function backupFilename(format: "json" | "zip", exportedAt?: string) {
  const stamp = (exportedAt ?? new Date().toISOString()).replace(/[:.]/g, "-").slice(0, 19);
  return `universe-panel-backup-${stamp}.${format}`;
}
