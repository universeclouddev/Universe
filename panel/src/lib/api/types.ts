import type { components } from "./schema";

export type InstanceState = "CREATING" | "ONLINE" | "OFFLINE" | "STOPPED";
export type ApiPermission = "ALL" | "PUBLIC";

export type InstanceInfo = components["schemas"]["InstanceInfo"];
export type Configuration = components["schemas"]["Configuration"];
export type UniverseMainConfiguration = components["schemas"]["UniverseMainConfiguration"];
export type NodeResources = components["schemas"]["NodeResources"];

export interface PingResponse {
  status: string;
  nodeId: string;
  clusterName: string;
  master: boolean;
}

export interface NodeInfo {
  id: string;
  clusterName: string;
  version: string;
  master: boolean;
  address: string;
  port: number;
  apiPort: number;
  uptimeMs: number;
  system: {
    availableProcessors: number;
    systemLoadAverage?: number;
    freeMemory: number;
    totalMemory: number;
    maxMemory: number;
  };
}

export interface ClusterNode {
  id: string;
  name: string;
  address: string;
  port: number;
  local: boolean;
  resources: NodeResources;
}

export interface ClusterNodeDetail extends ClusterNode {
  instances: string[];
}

export interface InstanceLogsResponse {
  instanceId: string;
  lines: string[];
  totalLines: number;
  requestedLines: number;
}

export interface TemplateEntry {
  group: string;
  name: string;
  path: string;
}

export interface TemplateDetail {
  group: string;
  name: string;
  path: string;
}

export interface ApiError {
  error?: string;
  message?: string;
  retryAfterMs?: number;
}

export type ExtensionStatus = "LOADED" | "INSTALLED" | "SKIPPED";

export interface ExtensionInfo {
  id: string;
  version: string;
  status: ExtensionStatus;
  masterOnly: boolean;
  reloadable: boolean;
}
