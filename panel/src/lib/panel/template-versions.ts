import { randomUUID } from "crypto";
import { getStore, saveStore, type TemplateFileVersion } from "@/lib/panel/store";

export type { TemplateFileVersion };

const MAX_VERSIONS_PER_FILE = 50;

export function templateVersionKey(group: string, name: string, filePath: string): string {
  return `${group}/${name}/${filePath}`;
}

export function listTemplateVersions(
  group: string,
  name: string,
  filePath: string,
): TemplateFileVersion[] {
  const store = getStore();
  const key = templateVersionKey(group, name, filePath);
  const versions = store.templateVersions?.[key] ?? [];
  return [...versions].sort((a, b) => b.savedAt - a.savedAt);
}

export function getTemplateVersion(
  group: string,
  name: string,
  filePath: string,
  versionId: string,
): TemplateFileVersion | null {
  return listTemplateVersions(group, name, filePath).find((v) => v.id === versionId) ?? null;
}

export function snapshotTemplateVersion(
  group: string,
  name: string,
  filePath: string,
  content: string,
  savedBy?: string,
): TemplateFileVersion | null {
  const trimmed = content;
  const store = getStore();
  if (!store.templateVersions) store.templateVersions = {};

  const key = templateVersionKey(group, name, filePath);
  const existing = store.templateVersions[key] ?? [];
  const latest = existing[existing.length - 1];
  if (latest?.content === trimmed) return null;

  const version: TemplateFileVersion = {
    id: randomUUID(),
    content: trimmed,
    savedAt: Date.now(),
    savedBy,
  };

  store.templateVersions[key] = [...existing, version].slice(-MAX_VERSIONS_PER_FILE);
  saveStore(store);
  return version;
}
