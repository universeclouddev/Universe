export const PANEL_PERMISSIONS = {
  "dashboard.view": "View dashboard and overview",
  "instances.read": "View instances and logs",
  "instances.manage": "Create, stop, delete, and command instances",
  "cluster.read": "View cluster nodes",
  "cluster.manage": "Execute commands on cluster nodes",
  "configurations.read": "View configurations",
  "configurations.manage": "Create and edit configurations",
  "templates.read": "View and edit templates",
  "templates.manage": "Import templates and sync to cluster",
  "console.use": "Use the master WebSocket console",
  "metrics.view": "View Prometheus metrics",
  "schedules.read": "View scheduled tasks",
  "schedules.manage": "Create and manage scheduled tasks",
  "settings.view": "View node settings",
  "settings.universe": "Configure Universe API connection",
  "settings.oidc": "Configure OIDC / SSO",
  "users.manage": "Manage panel users and roles",
  "audit.view": "View security audit log",
} as const;

export type PanelPermission = keyof typeof PANEL_PERMISSIONS;

export type PanelRole = "admin" | "operator" | "viewer";

/** Ascending privilege — use reversed order when showing top role first. */
export const PANEL_ROLES_ORDERED: PanelRole[] = ["viewer", "admin", "operator"];

export const ROLE_LABELS: Record<PanelRole, string> = {
  viewer: "Viewer",
  admin: "Admin",
  operator: "Operator",
};

export const ROLE_DESCRIPTIONS: Record<PanelRole, string> = {
  operator: "Full panel control including users, SSO, Universe connection, and audit log.",
  admin: "Manage instances, templates, and cluster operations. No user or SSO admin.",
  viewer: "Read-only access to dashboard, instances, and metrics.",
};

/** Middle tier — operational control without panel administration. */
const ADMIN_PERMISSIONS: PanelPermission[] = [
  "dashboard.view",
  "instances.read",
  "instances.manage",
  "cluster.read",
  "cluster.manage",
  "configurations.read",
  "configurations.manage",
  "templates.read",
  "templates.manage",
  "console.use",
  "metrics.view",
  "schedules.read",
  "schedules.manage",
  "settings.view",
];

const VIEWER_PERMISSIONS: PanelPermission[] = [
  "dashboard.view",
  "instances.read",
  "cluster.read",
  "configurations.read",
  "templates.read",
  "metrics.view",
  "schedules.read",
  "settings.view",
];

export const ROLE_PERMISSIONS: Record<PanelRole, PanelPermission[]> = {
  operator: Object.keys(PANEL_PERMISSIONS) as PanelPermission[],
  admin: ADMIN_PERMISSIONS,
  viewer: VIEWER_PERMISSIONS,
};

export function roleHasPermission(role: PanelRole, permission: PanelPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function requiredPermissionForUniverseRoute(
  method: string,
  path: string,
): PanelPermission | null {
  const m = method.toUpperCase();
  const segments = path.replace(/^\/+/, "").split("/");
  const root = segments[0] ?? "";

  if (root === "ping") return "dashboard.view";

  if (root === "instances") {
    if (m === "GET") return "instances.read";
    return "instances.manage";
  }
  if (root === "cluster") {
    if (m === "GET") return "cluster.read";
    return "cluster.manage";
  }
  if (root === "configurations") {
    if (m === "GET") return "configurations.read";
    return "configurations.manage";
  }
  if (root === "templates") {
    if (m === "GET") return "templates.read";
    return "templates.manage";
  }
  if (root === "commands") return "console.use";
  if (root === "metrics") return "metrics.view";
  if (root === "node") return "settings.view";
  if (root === "extensions") return "settings.view";

  return "dashboard.view";
}

/** Nav item → minimum permission */
export const ROUTE_PERMISSIONS: Record<string, PanelPermission> = {
  "/dashboard": "dashboard.view",
  "/activity": "dashboard.view",
  "/wizard": "dashboard.view",
  "/instances": "instances.read",
  "/instances/lifecycle": "instances.read",
  "/cluster": "cluster.read",
  "/configurations": "configurations.read",
  "/templates": "templates.read",
  "/console": "console.use",
  "/schedules": "schedules.read",
  "/metrics": "metrics.view",
  "/extensions": "settings.view",
  "/settings": "settings.view",
  "/settings/backup": "settings.view",
  "/alerts": "settings.view",
};
