"use client";

import {
  PANEL_PERMISSIONS,
  PANEL_ROLES_ORDERED,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type PanelPermission,
  type PanelRole,
} from "@/lib/panel/permissions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function roleBadgeVariant(role: PanelRole) {
  if (role === "operator") return "success" as const;
  if (role === "admin") return "accent" as const;
  return "muted" as const;
}

export function PanelAccessSettings() {
  const permissions = Object.entries(PANEL_PERMISSIONS) as [PanelPermission, string][];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Roles & permissions</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Panel access is enforced separately from the Universe API key. Assign roles to users on
          the Users tab.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left">
              <th className="px-4 py-3 font-medium text-zinc-400">Permission</th>
              {PANEL_ROLES_ORDERED.map((role) => (
                <th key={role} className="px-4 py-3 text-center font-medium text-zinc-400">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map(([key, desc]) => (
              <tr key={key} className="border-b border-white/[0.04] last:border-0">
                <td className="px-4 py-3">
                  <code className="text-xs text-violet-400">{key}</code>
                  <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>
                </td>
                {PANEL_ROLES_ORDERED.map((role) => {
                  const allowed = ROLE_PERMISSIONS[role].includes(key);
                  return (
                    <td key={role} className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          allowed ? "bg-emerald-400" : "bg-zinc-700",
                        )}
                        title={allowed ? "Allowed" : "Denied"}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[...PANEL_ROLES_ORDERED].reverse().map((role) => (
          <div
            key={role}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <Badge variant={roleBadgeVariant(role)} className="text-[10px]">
              {ROLE_LABELS[role]}
            </Badge>
            <p className="mt-2 text-xs text-zinc-500">{ROLE_DESCRIPTIONS[role]}</p>
            <p className="mt-2 text-[11px] text-zinc-600">
              {ROLE_PERMISSIONS[role].length} permissions
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
