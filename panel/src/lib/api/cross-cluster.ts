import type { Configuration, InstanceInfo, TemplateEntry } from "@/lib/api/types";

export interface ImportResultItem {
  ok: boolean;
  error?: string;
}

export interface TemplateImportResult extends ImportResultItem {
  group: string;
  name: string;
}

export interface ConfigurationImportResult extends ImportResultItem {
  name: string;
}

export interface BatchImportResponse<T extends ImportResultItem> {
  results: T[];
  imported: number;
  failed: number;
  error?: string;
}

export async function fetchRemoteTemplates(clusterId: string): Promise<TemplateEntry[]> {
  const response = await fetch(
    `/api/panel/clusters/${encodeURIComponent(clusterId)}/universe/templates`,
    { credentials: "include" },
  );
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.json() as Promise<TemplateEntry[]>;
}

export async function fetchRemoteConfigurations(clusterId: string): Promise<Configuration[]> {
  const response = await fetch(
    `/api/panel/clusters/${encodeURIComponent(clusterId)}/universe/configurations`,
    { credentials: "include" },
  );
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.json() as Promise<Configuration[]>;
}

export async function fetchRemoteInstances(clusterId: string): Promise<InstanceInfo[]> {
  const response = await fetch(
    `/api/panel/clusters/${encodeURIComponent(clusterId)}/universe/instances`,
    { credentials: "include" },
  );
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.json() as Promise<InstanceInfo[]>;
}

export async function importTemplatesFromCluster(input: {
  sourceClusterId: string;
  destinationClusterId?: string;
  templates: { group: string; name: string }[];
  overwrite?: boolean;
}): Promise<BatchImportResponse<TemplateImportResult>> {
  const response = await fetch("/api/panel/import/templates", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body = (await response.json()) as BatchImportResponse<TemplateImportResult> & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "Template import failed");
  }
  return body;
}

export async function importConfigurationsFromCluster(input: {
  sourceClusterId: string;
  destinationClusterId?: string;
  names: string[];
  overwrite?: boolean;
}): Promise<BatchImportResponse<ConfigurationImportResult>> {
  const response = await fetch("/api/panel/import/configurations", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body = (await response.json()) as BatchImportResponse<ConfigurationImportResult> & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "Configuration import failed");
  }
  return body;
}

export function templateKey(group: string, name: string) {
  return `${group}/${name}`;
}

export function parseTemplateKey(key: string): { group: string; name: string } | null {
  const slash = key.indexOf("/");
  if (slash <= 0 || slash === key.length - 1) return null;
  return { group: key.slice(0, slash), name: key.slice(slash + 1) };
}

export function groupTemplates(entries: TemplateEntry[]) {
  const grouped = new Map<string, TemplateEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.group) ?? [];
    list.push(entry);
    grouped.set(entry.group, list);
  }
  return Array.from(grouped.entries()).map(([group, templates]) => ({
    group,
    templates: templates.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
