export type ActivitySeverity = "info" | "success" | "warning" | "error";

export type ActivityType =
  | "instance.lifecycle"
  | "import.templates"
  | "import.configurations"
  | "config.save"
  | "health.change";

export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: ActivityType;
  severity: ActivitySeverity;
  clusterId: string;
  clusterName: string;
  message: string;
  actorEmail?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ActivityFilters {
  clusterId?: string;
  severity?: ActivitySeverity;
  type?: ActivityType;
  limit?: number;
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  "instance.lifecycle": "Instance lifecycle",
  "import.templates": "Template import",
  "import.configurations": "Configuration import",
  "config.save": "Config save",
  "health.change": "Health change",
};

export const ACTIVITY_SEVERITY_LABELS: Record<ActivitySeverity, string> = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  error: "Error",
};
