import type { Configuration, InstanceInfo, TemplateEntry } from "@/lib/api/types";
import { templateKey } from "@/lib/api/cross-cluster";

export type ComparePresence = "both" | "only-a" | "only-b";

export interface CompareRow {
  key: string;
  label: string;
  presence: ComparePresence;
}

export interface InstanceCountSnapshot {
  total: number;
  online: number;
  stopped: number;
  offline: number;
  creating: number;
  byConfiguration: Record<string, number>;
}

export function compareKeySets(keysA: string[], keysB: string[]): CompareRow[] {
  const setA = new Set(keysA);
  const setB = new Set(keysB);
  const all = [...new Set([...keysA, ...keysB])].sort((a, b) => a.localeCompare(b));

  return all.map((key) => ({
    key,
    label: key,
    presence: setA.has(key) && setB.has(key) ? "both" : setA.has(key) ? "only-a" : "only-b",
  }));
}

export function templateKeys(entries: TemplateEntry[]): string[] {
  return entries.map((entry) => templateKey(entry.group, entry.name));
}

export function configurationKeys(configs: Configuration[]): string[] {
  return configs.map((config) => config.name!).filter(Boolean);
}

export function summarizeInstances(instances: InstanceInfo[]): InstanceCountSnapshot {
  const byConfiguration: Record<string, number> = {};
  let online = 0;
  let stopped = 0;
  let offline = 0;
  let creating = 0;

  for (const instance of instances) {
    const configName = instance.configurationName ?? "unknown";
    byConfiguration[configName] = (byConfiguration[configName] ?? 0) + 1;

    switch (instance.state) {
      case "ONLINE":
        online += 1;
        break;
      case "CREATING":
        creating += 1;
        break;
      case "STOPPED":
        stopped += 1;
        break;
      case "OFFLINE":
        offline += 1;
        break;
    }
  }

  return {
    total: instances.length,
    online,
    stopped,
    offline,
    creating,
    byConfiguration,
  };
}

export function compareInstanceCounts(a: InstanceCountSnapshot, b: InstanceCountSnapshot): CompareRow[] {
  const keys = [
    ...new Set([...Object.keys(a.byConfiguration), ...Object.keys(b.byConfiguration)]),
  ].sort((x, y) => x.localeCompare(y));

  return keys.map((key) => {
    const countA = a.byConfiguration[key] ?? 0;
    const countB = b.byConfiguration[key] ?? 0;
    const presence: ComparePresence =
      countA > 0 && countB > 0 ? "both" : countA > 0 ? "only-a" : "only-b";

    return {
      key,
      label: key,
      presence,
    };
  });
}

export function countDiffRows(rows: CompareRow[]): number {
  return rows.filter((row) => row.presence !== "both").length;
}
