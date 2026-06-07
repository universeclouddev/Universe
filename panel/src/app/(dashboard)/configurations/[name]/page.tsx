"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/layout/sidebar";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { Button } from "@/components/ui/button";
import { ConfigurationEditor } from "@/components/configurations/configuration-editor";
import { ConfigurationValidationWarnings } from "@/components/configurations/configuration-validation-warnings";
import { useConfiguration, useSaveConfiguration, useTemplates } from "@/lib/api/queries";
import type { Configuration } from "@/lib/api/types";
import { validateConfiguration } from "@/lib/panel/config-validator";

export default function ConfigurationDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const configQuery = useConfiguration(name);
  const templatesQuery = useTemplates();
  const saveConfig = useSaveConfiguration();
  const [edited, setEdited] = useState<Configuration | null>(null);

  const config = edited ?? configQuery.data;

  const templateEntries = useMemo(
    () => templatesQuery.data?.flatMap((group) => group.templates) ?? [],
    [templatesQuery.data],
  );

  const validation = useMemo(
    () =>
      config
        ? validateConfiguration(config, { templates: templateEntries, fileName: name })
        : null,
    [config, templateEntries, name],
  );

  async function handleSave() {
    if (!config) return;
    try {
      await saveConfig.mutateAsync({ name, config });
      toast.success("Configuration saved");
      setEdited(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <PermissionGuard permission="configurations.read">
      <div>
        <Link href="/configurations" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mb-6 flex items-center justify-between">
          <DashboardHeader title={name} description="Edit instance configuration JSON" />
          <Button onClick={handleSave} disabled={saveConfig.isPending || !config}>
            Save
          </Button>
        </div>

        {configQuery.isLoading && <p className="text-zinc-500">Loading...</p>}
        {validation && <ConfigurationValidationWarnings result={validation} className="mb-4" />}
        {config && <ConfigurationEditor value={config} onChange={setEdited} />}
      </div>
    </PermissionGuard>
  );
}
