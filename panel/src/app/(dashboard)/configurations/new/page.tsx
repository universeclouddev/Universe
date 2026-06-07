"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/layout/sidebar";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfigurationEditor } from "@/components/configurations/configuration-editor";
import { ConfigurationValidationWarnings } from "@/components/configurations/configuration-validation-warnings";
import { useSaveConfiguration, useTemplates } from "@/lib/api/queries";
import type { Configuration } from "@/lib/api/types";
import { validateConfiguration } from "@/lib/panel/config-validator";

const defaultConfig: Configuration = {
  name: "new-config",
  runtime: "screen",
  command: "java -Xmx2048M -jar server.jar",
  static: false,
  ramMB: 2048,
  cpu: 100,
  instanceGroups: [],
  nodes: ["node-1"],
  hostAddress: "127.0.0.1",
  availablePorts: { min: 25565, max: 25570 },
  minimumServiceCount: 1,
  environmentVariables: { UNIVERSE_INSTANCE_ID: "%INSTANCE_ID%" },
  templateInstallationConfig: {
    allOf: [],
    allInGroups: [],
    oneOf: [],
    oneInGroups: [],
    onTemplatePasteOverridePresentFiles: false,
  },
  fileModifications: [],
  properties: {},
};

export default function NewConfigurationPage() {
  const router = useRouter();
  const saveConfig = useSaveConfiguration();
  const templatesQuery = useTemplates();
  const [name, setName] = useState("new-config");
  const [config, setConfig] = useState<Configuration>(defaultConfig);

  const templateEntries = useMemo(
    () => templatesQuery.data?.flatMap((group) => group.templates) ?? [],
    [templatesQuery.data],
  );

  const validation = useMemo(
    () =>
      validateConfiguration(
        { ...config, name },
        { templates: templateEntries, fileName: name },
      ),
    [config, name, templateEntries],
  );

  async function handleSave() {
    try {
      const payload = { ...config, name };
      await saveConfig.mutateAsync({ name, config: payload });
      toast.success("Configuration saved");
      router.push(`/configurations/${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <PermissionGuard permission="configurations.manage">
      <div>
        <Link href="/configurations" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <DashboardHeader title="New configuration" />

        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="max-w-md space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <ConfigurationValidationWarnings result={validation} className="mb-4" />

        <ConfigurationEditor value={config} onChange={setConfig} />
        <div className="mt-4">
          <Button onClick={handleSave} disabled={saveConfig.isPending}>
            Save configuration
          </Button>
        </div>
      </div>
    </PermissionGuard>
  );
}
