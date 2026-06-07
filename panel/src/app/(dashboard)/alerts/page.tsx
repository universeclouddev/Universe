"use client";

import { PermissionGuard } from "@/components/layout/auth-guard";
import { PanelAlertsSettings } from "@/components/settings/panel-alerts-settings";

export default function AlertsPage() {
  return (
    <PermissionGuard permission="settings.view">
      <div>
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl">Alerts</h1>
        <PanelAlertsSettings />
      </div>
    </PermissionGuard>
  );
}
