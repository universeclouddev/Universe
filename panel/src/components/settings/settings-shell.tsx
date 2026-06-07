"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Link2,
  Shield,
  Users,
  KeyRound,
  Server,
  Lock,
  ScrollText,
  Archive,
  Bell,
} from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { useCanViewAuditLog } from "@/lib/panel/rbac-ui";
import { cn } from "@/lib/utils";
import {
  PanelUniverseSettings,
  PanelOidcSettings,
  PanelUsersSettings,
} from "@/components/settings/panel-settings";
import { PanelAccessSettings } from "@/components/settings/panel-access-settings";
import { PanelAuditSettings } from "@/components/settings/panel-audit-settings";
import { NodeSettingsTab } from "@/components/settings/node-settings-tab";
import { PanelAlertsSettings } from "@/components/settings/panel-alerts-settings";

export type SettingsTabId = "connection" | "sso" | "users" | "access" | "audit" | "node" | "alerts";

interface TabDef {
  id: SettingsTabId;
  label: string;
  icon: typeof Link2;
  visible: boolean;
}

export function SettingsShell() {
  const { hasPermission } = useAuth();
  const canViewAudit = useCanViewAuditLog();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabs = useMemo<TabDef[]>(
    () =>
      [
        {
          id: "connection" as const,
          label: "Clusters",
          icon: Link2,
          visible: hasPermission("settings.universe"),
        },
        {
          id: "sso" as const,
          label: "SSO",
          icon: KeyRound,
          visible: hasPermission("settings.oidc"),
        },
        {
          id: "users" as const,
          label: "Users",
          icon: Users,
          visible: hasPermission("users.manage"),
        },
        {
          id: "access" as const,
          label: "Access",
          icon: Shield,
          visible: hasPermission("settings.view"),
        },
        {
          id: "audit" as const,
          label: "Audit",
          icon: ScrollText,
          visible: canViewAudit,
        },
        {
          id: "node" as const,
          label: "Node",
          icon: Server,
          visible: hasPermission("settings.view"),
        },
        {
          id: "alerts" as const,
          label: "Alerts",
          icon: Bell,
          visible: hasPermission("settings.view"),
        },
      ].filter((t) => t.visible),
    [hasPermission, canViewAudit],
  );

  const requested = searchParams.get("tab") as SettingsTabId | null;
  const activeTab =
    tabs.find((t) => t.id === requested)?.id ?? tabs[0]?.id ?? "node";

  function setTab(id: SettingsTabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (tabs.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
        <Lock className="h-4 w-4 shrink-0" />
        You don&apos;t have permission to view any settings sections.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] pb-1 lg:w-40 lg:flex-col lg:gap-0.5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {active && (
                <span className="absolute bottom-0 left-2.5 right-2.5 h-px bg-violet-400/80 lg:bottom-auto lg:left-0 lg:top-1/2 lg:h-4 lg:w-0.5 lg:-translate-y-1/2 lg:rounded-full lg:bg-violet-400" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-violet-400" : "text-zinc-600",
                )}
              />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        {activeTab === "connection" && <PanelUniverseSettings />}
        {activeTab === "sso" && <PanelOidcSettings />}
        {activeTab === "users" && <PanelUsersSettings />}
        {activeTab === "access" && <PanelAccessSettings />}
        {activeTab === "audit" && <PanelAuditSettings />}
        {activeTab === "node" && <NodeSettingsTab />}
        {activeTab === "alerts" && <PanelAlertsSettings />}
        {hasPermission("settings.universe") && (
          <div className="mt-8 border-t border-white/[0.06] pt-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Archive className="h-4 w-4" />
              <Link
                href="/settings/backup"
                className="text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
              >
                Backup &amp; restore →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
