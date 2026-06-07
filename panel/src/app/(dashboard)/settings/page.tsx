"use client";

import { Suspense } from "react";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { SettingsShell } from "@/components/settings/settings-shell";

function SettingsContent() {
  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl">
        Settings
      </h1>
      <SettingsShell />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <PermissionGuard permission="settings.view">
      <Suspense fallback={<p className="text-zinc-500">Loading settings...</p>}>
        <SettingsContent />
      </Suspense>
    </PermissionGuard>
  );
}
