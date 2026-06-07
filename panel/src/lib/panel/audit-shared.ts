import type { PanelRole } from "@/lib/panel/permissions";
import { roleHasPermission } from "@/lib/panel/permissions";

/** Security-focused panel actions (not operational instance activity). */
export type AuditAction =
  | "auth.login"
  | "auth.login.oidc"
  | "config.edit"
  | "template.save"
  | "cluster.switch"
  | "import.configurations"
  | "import.templates";

export interface AuditEvent {
  id: string;
  timestamp: number;
  action: AuditAction;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: PanelRole;
  clusterId: string | null;
  clusterName: string | null;
  ip: string | null;
  details: Record<string, string | number | boolean | null>;
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "auth.login": "Signed in",
  "auth.login.oidc": "Signed in (SSO)",
  "config.edit": "Configuration saved",
  "template.save": "Template saved",
  "cluster.switch": "Cluster switched",
  "import.configurations": "Configurations imported",
  "import.templates": "Templates imported",
};

export const AUDIT_VIEW_PERMISSION = "audit.view" as const;

export function canViewAuditLog(role: PanelRole): boolean {
  return roleHasPermission(role, AUDIT_VIEW_PERMISSION);
}

export function formatAuditTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function summarizeAuditDetails(event: AuditEvent): string {
  const d = event.details;
  switch (event.action) {
    case "config.edit":
      return d.name ? String(d.name) : "configuration";
    case "template.save":
      if (d.group && d.name) return `${d.group}/${d.name}`;
      return d.path ? String(d.path) : "template";
    case "cluster.switch":
      return event.clusterName ?? (d.clusterName ? String(d.clusterName) : "cluster");
    case "import.configurations":
      return d.count != null ? `${d.count} configuration(s)` : "configurations";
    case "import.templates":
      return d.count != null ? `${d.count} template(s)` : "templates";
    case "auth.login":
    case "auth.login.oidc":
      return event.userEmail;
    default:
      return "";
  }
}

/** Detect security-relevant Universe API mutations for audit logging. */
export function detectUniverseAuditAction(
  method: string,
  apiPath: string,
): { action: AuditAction; details: Record<string, string> } | null {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD") return null;

  const segments = apiPath.replace(/^\/+/, "").split("/");
  const root = segments[0] ?? "";

  if (root === "configurations") {
    const name = segments[1] ? decodeURIComponent(segments[1]) : null;
    if (!name) return null;
    return { action: "config.edit", details: { name, method: m } };
  }

  if (root === "templates") {
    if (segments[1] === "import") {
      return { action: "template.save", details: { target: "import", method: m } };
    }
    const group = segments[1] ? decodeURIComponent(segments[1]) : null;
    const name = segments[2] ? decodeURIComponent(segments[2]) : null;
    if (!group || !name) return null;
    const sub = segments.slice(3).join("/");
    const details: Record<string, string> = { group, name, method: m };
    if (sub) details.path = sub;
    return { action: "template.save", details };
  }

  return null;
}
