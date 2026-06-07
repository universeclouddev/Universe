"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, apiFetch } from "@/lib/api/client";
import type {
  ClusterNode,
  ClusterNodeDetail,
  Configuration,
  InstanceInfo,
  InstanceLogsResponse,
  NodeInfo,
  PingResponse,
  TemplateDetail,
  TemplateEntry,
  UniverseMainConfiguration,
  ExtensionInfo,
} from "@/lib/api/types";
import type { ActivityEvent, ActivitySeverity, ActivityType } from "@/lib/panel/activity-types";
import { useAuth } from "@/lib/auth/context";

export const queryKeys = {
  ping: (clusterId: string | null) => ["ping", clusterId] as const,
  instances: (clusterId: string | null) => ["instances", clusterId] as const,
  instance: (clusterId: string | null, id: string) => ["instance", clusterId, id] as const,
  instanceLogs: (clusterId: string | null, id: string, lines: number) =>
    ["instance-logs", clusterId, id, lines] as const,
  nodes: (clusterId: string | null) => ["cluster-nodes", clusterId] as const,
  node: (clusterId: string | null, id: string) => ["cluster-node", clusterId, id] as const,
  configurations: (clusterId: string | null) => ["configurations", clusterId] as const,
  configuration: (clusterId: string | null, name: string) =>
    ["configuration", clusterId, name] as const,
  templates: (clusterId: string | null) => ["templates", clusterId] as const,
  template: (clusterId: string | null, group: string, name: string) =>
    ["template", clusterId, group, name] as const,
  nodeInfo: (clusterId: string | null) => ["node-info", clusterId] as const,
  nodeConfig: (clusterId: string | null) => ["node-config", clusterId] as const,
  metrics: (clusterId: string | null) => ["metrics", clusterId] as const,
  extensions: (clusterId: string | null) => ["extensions", clusterId] as const,
  activity: (filters: {
    clusterId?: string;
    severity?: ActivitySeverity;
    type?: ActivityType;
    limit?: number;
  }) => ["activity", filters] as const,
};

function useClient() {
  return createApiClient();
}

export function usePing() {
  const { hasPermission, isAuthenticated, activeClusterId } = useAuth();
  const client = useClient();
  return useQuery({
    queryKey: queryKeys.ping(activeClusterId),
    queryFn: async () => {
      const { data, error } = await client.GET("/ping");
      if (error) throw new Error("Failed to fetch ping");
      return data as PingResponse;
    },
    enabled: isAuthenticated && hasPermission("dashboard.view") && !!activeClusterId,
    refetchInterval: 30000,
  });
}

export function useInstances() {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.instances(activeClusterId),
    queryFn: async () => {
      const { data, error } = await client.GET("/instances");
      if (error) throw new Error("Failed to fetch instances");
      return data as InstanceInfo[];
    },
    enabled: hasPermission("instances.read") && !!activeClusterId,
    refetchInterval: 5000,
  });
}

export function useInstance(id: string) {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.instance(activeClusterId, id),
    queryFn: async () => {
      const { data, error } = await client.GET("/instances/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error("Instance not found");
      return data as InstanceInfo;
    },
    enabled: hasPermission("instances.read") && !!id && !!activeClusterId,
    refetchInterval: 3000,
  });
}

export function useInstanceLogs(id: string, lines = 100) {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.instanceLogs(activeClusterId, id, lines),
    queryFn: async () => {
      const { data, error } = await client.GET("/instances/{id}/logs", {
        params: { path: { id }, query: { lines } },
      });
      if (error) throw new Error("Failed to fetch logs");
      return data as InstanceLogsResponse;
    },
    enabled: hasPermission("instances.read") && !!id && !!activeClusterId,
    refetchInterval: 5000,
  });
}

export function useClusterNodes() {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.nodes(activeClusterId),
    queryFn: async () => {
      const { data, error } = await client.GET("/cluster/nodes");
      if (error) throw new Error("Failed to fetch nodes");
      return data as ClusterNode[];
    },
    enabled: hasPermission("cluster.read") && !!activeClusterId,
    refetchInterval: 10000,
  });
}

export function useClusterNode(id: string) {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.node(activeClusterId, id),
    queryFn: async () => {
      const { data, error } = await client.GET("/cluster/nodes/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error("Node not found");
      return data as ClusterNodeDetail;
    },
    enabled: hasPermission("cluster.read") && !!id && !!activeClusterId,
  });
}

export function useConfigurations() {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.configurations(activeClusterId),
    queryFn: async () => {
      const { data, error } = await client.GET("/configurations");
      if (error) throw new Error("Failed to fetch configurations");
      return data as Configuration[];
    },
    enabled: hasPermission("configurations.read") && !!activeClusterId,
  });
}

export function useConfiguration(name: string) {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.configuration(activeClusterId, name),
    queryFn: async () => {
      const { data, error } = await client.GET("/configurations/{name}", {
        params: { path: { name } },
      });
      if (error) throw new Error("Configuration not found");
      return data as Configuration;
    },
    enabled: hasPermission("configurations.read") && !!name && !!activeClusterId,
  });
}

export function useTemplates() {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.templates(activeClusterId),
    queryFn: async () => {
      const { data, error } = await client.GET("/templates");
      if (error) throw new Error("Failed to fetch templates");
      const entries = data as TemplateEntry[];
      const grouped = new Map<string, TemplateEntry[]>();
      for (const entry of entries) {
        const list = grouped.get(entry.group) ?? [];
        list.push(entry);
        grouped.set(entry.group, list);
      }
      return Array.from(grouped.entries()).map(([group, templates]) => ({ group, templates }));
    },
    enabled: hasPermission("templates.read") && !!activeClusterId,
  });
}

export function useTemplate(group: string, name: string) {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.template(activeClusterId, group, name),
    queryFn: async () => {
      const { data, error } = await client.GET("/templates/{group}/{name}", {
        params: { path: { group, name } },
      });
      if (error) throw new Error("Template not found");
      return data as TemplateDetail;
    },
    enabled: hasPermission("templates.read") && !!group && !!name && !!activeClusterId,
  });
}

export function useNodeInfo() {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.nodeInfo(activeClusterId),
    queryFn: async () => {
      const { data, error } = await client.GET("/node");
      if (error) throw new Error("Failed to fetch node info");
      return data as NodeInfo;
    },
    enabled: hasPermission("settings.view") && !!activeClusterId,
    refetchInterval: 30000,
  });
}

export function useNodeConfig() {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.nodeConfig(activeClusterId),
    queryFn: async () => {
      const { data, error } = await client.GET("/node/config");
      if (error) throw new Error("Failed to fetch node config");
      return data as UniverseMainConfiguration;
    },
    enabled: hasPermission("settings.view") && !!activeClusterId,
  });
}

export function useMetrics() {
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.metrics(activeClusterId),
    queryFn: async () => {
      const response = await fetch("/api/universe/metrics", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch metrics");
      return response.text();
    },
    enabled: hasPermission("metrics.view") && !!activeClusterId,
    refetchInterval: 15000,
  });
}

export function useExtensions() {
  const client = useClient();
  const { hasPermission, activeClusterId } = useAuth();
  return useQuery({
    queryKey: queryKeys.extensions(activeClusterId),
    queryFn: async () => {
      const { data, error } = await client.GET("/extensions");
      if (error) throw new Error("Failed to fetch extensions");
      return data as ExtensionInfo[];
    },
    enabled: hasPermission("settings.view") && !!activeClusterId,
    refetchInterval: 30000,
  });
}

export function useCreateInstance() {
  const client = useClient();
  const qc = useQueryClient();
  const { activeClusterId } = useAuth();
  return useMutation({
    mutationFn: async (configurationName: string) => {
      const { data, error } = await client.POST("/instances", {
        body: { configurationName },
      });
      if (error) throw new Error("Failed to create instance");
      return data as InstanceInfo;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.instances(activeClusterId) }),
  });
}

export function useDeleteInstance() {
  const client = useClient();
  const qc = useQueryClient();
  const { activeClusterId } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.DELETE("/instances/{id}", {
        params: { path: { id } },
      });
      if (error) throw new Error("Failed to delete instance");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.instances(activeClusterId) }),
  });
}

export function useInstanceLifecycle() {
  const qc = useQueryClient();
  const { activeClusterId } = useAuth();
  return useMutation({
    mutationFn: async ({ id, target }: { id: string; target: "start" | "stop" | "restart" }) => {
      await apiFetch(`/instances/${id}/lifecycle?target=${target}`, {
        method: "PATCH",
      });
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.instances(activeClusterId) });
      qc.invalidateQueries({ queryKey: queryKeys.instance(activeClusterId, id) });
    },
  });
}

export function useExecuteInstanceCommand() {
  const client = useClient();
  return useMutation({
    mutationFn: async ({ id, command }: { id: string; command: string }) => {
      const { error } = await client.POST("/instances/{id}/execute", {
        params: { path: { id } },
        body: { command },
      });
      if (error) throw new Error("Failed to execute command");
    },
  });
}

export function useSaveConfiguration() {
  const client = useClient();
  const qc = useQueryClient();
  const { activeClusterId } = useAuth();
  return useMutation({
    mutationFn: async ({ name, config }: { name: string; config: Configuration }) => {
      const { error } = await client.PUT("/configurations/{name}", {
        params: { path: { name } },
        body: config,
      });
      if (error) throw new Error("Failed to save configuration");
    },
    onSuccess: (_, { name }) => {
      qc.invalidateQueries({ queryKey: queryKeys.configurations(activeClusterId) });
      qc.invalidateQueries({ queryKey: queryKeys.configuration(activeClusterId, name) });
    },
  });
}

export function useDeleteConfiguration() {
  const client = useClient();
  const qc = useQueryClient();
  const { activeClusterId } = useAuth();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await client.DELETE("/configurations/{name}", {
        params: { path: { name } },
      });
      if (error) throw new Error("Failed to delete configuration");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.configurations(activeClusterId) }),
  });
}

export function useSyncTemplates() {
  const client = useClient();
  return useMutation({
    mutationFn: async (pattern: string) => {
      const { error } = await client.POST("/templates/sync", {
        body: { pattern },
      });
      if (error) throw new Error("Failed to sync templates");
    },
  });
}

export function useExecuteCommand() {
  const client = useClient();
  return useMutation({
    mutationFn: async (command: string) => {
      const { data, error } = await client.POST("/commands/execute", {
        body: { command },
      });
      if (error) throw new Error("Failed to execute command");
      return data as { command: string; output: string };
    },
  });
}

export function useNodeCommand() {
  const client = useClient();
  return useMutation({
    mutationFn: async ({ id, command }: { id: string; command: string }) => {
      const { data, error, response } = await client.POST("/cluster/nodes/{id}/command", {
        params: { path: { id } },
        body: { command },
      });
      if (error) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to execute node command");
      }
      return data;
    },
  });
}

export function useReloadNodeConfig() {
  const client = useClient();
  return useMutation({
    mutationFn: async () => {
      const { error, response } = await client.POST("/node/reload");
      if (error) {
        if (response.status === 501) {
          throw new Error("Configuration reload is not yet implemented in the Universe API");
        }
        throw new Error("Failed to reload configuration");
      }
    },
  });
}

export function useActivityEvents(filters: {
  clusterId?: string;
  severity?: ActivitySeverity;
  type?: ActivityType;
  limit?: number;
}) {
  const { isAuthenticated, hasPermission } = useAuth();
  return useQuery({
    queryKey: queryKeys.activity(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.clusterId) params.set("clusterId", filters.clusterId);
      if (filters.severity) params.set("severity", filters.severity);
      if (filters.type) params.set("type", filters.type);
      if (filters.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      const res = await fetch(`/api/panel/activity${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json() as Promise<{ events: ActivityEvent[]; total: number }>;
    },
    enabled: isAuthenticated && hasPermission("dashboard.view"),
    refetchInterval: 30000,
  });
}
