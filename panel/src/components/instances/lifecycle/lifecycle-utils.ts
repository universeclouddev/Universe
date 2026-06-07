import type { Configuration, InstanceInfo } from "@/lib/api/types";

export function isRunningInstance(instance: InstanceInfo): boolean {
  return instance.state === "ONLINE" || instance.state === "CREATING";
}

export interface LifecycleGroup {
  configurationName: string;
  configuration?: Configuration;
  desired: number;
  running: number;
  total: number;
  stopped: number;
  offline: number;
  creating: number;
  instances: InstanceInfo[];
  drift: number;
}

export function buildLifecycleGroups(
  instances: InstanceInfo[],
  configurations: Configuration[],
): LifecycleGroup[] {
  const configMap = new Map(
    configurations.filter((c) => c.name).map((c) => [c.name!, c]),
  );
  const instancesByConfig = new Map<string, InstanceInfo[]>();

  for (const instance of instances) {
    const name = instance.configurationName ?? "unknown";
    const list = instancesByConfig.get(name) ?? [];
    list.push(instance);
    instancesByConfig.set(name, list);
  }

  const names = new Set<string>([
    ...configurations.map((c) => c.name!).filter(Boolean),
    ...instancesByConfig.keys(),
  ]);

  return Array.from(names)
    .sort((a, b) => a.localeCompare(b))
    .map((configurationName) => {
      const configuration = configMap.get(configurationName);
      const groupInstances = instancesByConfig.get(configurationName) ?? [];
      const running = groupInstances.filter(isRunningInstance).length;
      const stopped = groupInstances.filter((i) => i.state === "STOPPED").length;
      const offline = groupInstances.filter((i) => i.state === "OFFLINE").length;
      const creating = groupInstances.filter((i) => i.state === "CREATING").length;
      const desired = configuration?.minimumServiceCount ?? Math.max(running, 1);

      return {
        configurationName,
        configuration,
        desired,
        running,
        total: groupInstances.length,
        stopped,
        offline,
        creating,
        instances: groupInstances,
        drift: running - desired,
      };
    });
}

export function lifecycleHealthVariant(group: LifecycleGroup): "success" | "warning" | "danger" {
  if (group.running >= group.desired) return "success";
  if (group.running === 0 && group.desired > 0) return "danger";
  return "warning";
}
