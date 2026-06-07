"use client";

import { PermissionGuard } from "@/components/layout/auth-guard";
import { PanelBackupPage } from "@/components/settings/panel-backup-settings";

export default function SettingsBackupPage() {
  return (
    <PermissionGuard permission="settings.view">
      <PanelBackupPage />
    </PermissionGuard>
  );
}
