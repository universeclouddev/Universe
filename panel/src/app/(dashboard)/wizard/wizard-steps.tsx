"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  Loader2,
  RefreshCw,
  Server,
  Terminal,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InstanceStateBadge } from "@/components/ui/badge";
import {
  usePing,
  useTemplates,
  useSaveConfiguration,
  useCreateInstance,
  useInstance,
  useInstanceLogs,
} from "@/lib/api/queries";
import { useCreateTemplate, useImportTemplate } from "@/lib/api/template-queries";
import { useAuth } from "@/lib/auth/context";
import type { Configuration } from "@/lib/api/types";
import { defaultWizardConfig, type WizardTemplateSelection } from "./wizard-state";

interface StepShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function StepShell({ title, description, children }: StepShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="glow-border overflow-hidden">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

interface ConnectStepProps {
  onContinue: () => void;
}

export function ConnectStep({ onContinue }: ConnectStepProps) {
  const { activeCluster, universeConfigured } = useAuth();
  const ping = usePing();
  const connected = ping.isSuccess && ping.data?.status === "ok";

  return (
    <StepShell
      title="Connect to your Universe cluster"
      description="The panel talks to Universe over its REST API. If you ran the one-click setup, you're already linked — we just need to confirm the cluster is reachable."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          {ping.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking cluster connection...
            </div>
          ) : connected ? (
            <div className="flex items-start gap-3">
              <Wifi className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="font-medium text-slate-100">
                  Connected to {ping.data?.clusterName ?? activeCluster?.name ?? "Universe"}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  Node {ping.data?.nodeId} · {activeCluster?.apiUrl ?? "local API"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-medium text-slate-100">Cluster not reachable</p>
                <p className="mt-1 text-sm text-slate-500">
                  Start the Universe jar, then check again. If this is a fresh install, finish{" "}
                  <Link href="/setup" className="text-teal-400 hover:underline">
                    panel setup
                  </Link>{" "}
                  first.
                </p>
                {!universeConfigured && (
                  <p className="mt-2 text-sm text-amber-400/90">
                    No cluster is configured in Settings → Clusters yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => ping.refetch()} disabled={ping.isFetching}>
            <RefreshCw className={ping.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Check again
          </Button>
          <Button type="button" onClick={onContinue} disabled={!connected}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </StepShell>
  );
}

interface TemplateStepProps {
  selected: WizardTemplateSelection | null;
  onSelect: (template: WizardTemplateSelection) => void;
  onContinue: () => void;
}

export function TemplateStep({ selected, onSelect, onContinue }: TemplateStepProps) {
  const templates = useTemplates();
  const importTemplate = useImportTemplate();
  const createTemplate = useCreateTemplate();
  const [mode, setMode] = useState<"pick" | "import" | "create">("pick");
  const [group, setGroup] = useState("default");
  const [name, setName] = useState("lobby");
  const [file, setFile] = useState<File | null>(null);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Choose a zip file first");
      return;
    }
    try {
      const g = group.trim();
      const n = name.trim();
      await importTemplate.mutateAsync({ group: g, name: n, file });
      toast.success(`Imported ${g}/${n}`);
      onSelect({ group: g, name: n });
      setMode("pick");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const g = group.trim();
      const n = name.trim();
      await createTemplate.mutateAsync({ group: g, name: n });
      toast.success(`Created ${g}/${n}`);
      onSelect({ group: g, name: n });
      setMode("pick");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }

  const flatTemplates =
    templates.data?.flatMap((g) => g.templates.map((t) => ({ group: g.group, name: t.name }))) ?? [];

  return (
    <StepShell
      title="Choose a server template"
      description="Templates are the files Universe copies before starting your server — usually a Paper/Spigot jar, plugins, and config. Pick an existing one or import a zip you downloaded."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "pick" ? "default" : "outline"}
          onClick={() => setMode("pick")}
        >
          <FolderOpen className="h-4 w-4" />
          Pick existing
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "import" ? "default" : "outline"}
          onClick={() => setMode("import")}
        >
          <Upload className="h-4 w-4" />
          Import zip
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "create" ? "default" : "outline"}
          onClick={() => setMode("create")}
        >
          New empty
        </Button>
      </div>

      {mode === "pick" && (
        <div className="space-y-3">
          {templates.isLoading && (
            <p className="text-sm text-slate-500">Loading templates...</p>
          )}
          {flatTemplates.length === 0 && !templates.isLoading && (
            <p className="rounded-lg border border-dashed border-white/[0.08] px-4 py-8 text-center text-sm text-slate-500">
              No templates yet — import a zip or create an empty folder to continue.
            </p>
          )}
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {flatTemplates.map((t) => {
              const active = selected?.group === t.group && selected?.name === t.name;
              return (
                <button
                  key={`${t.group}/${t.name}`}
                  type="button"
                  onClick={() => onSelect(t)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-teal-400/40 bg-teal-400/10"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <div>
                    <p className="font-medium text-slate-100">
                      {t.group}/{t.name}
                    </p>
                    <p className="text-xs text-slate-500">Template folder on the node</p>
                  </div>
                  {active && <CheckCircle2 className="h-5 w-5 text-teal-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === "import" && (
        <form onSubmit={handleImport} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Group</Label>
              <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="default" required />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="lobby" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Zip file</Label>
            <Input
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <Button type="submit" disabled={importTemplate.isPending}>
            {importTemplate.isPending ? "Importing..." : "Import and select"}
          </Button>
        </form>
      )}

      {mode === "create" && (
        <form onSubmit={handleCreate} className="space-y-4">
          <p className="text-sm text-slate-500">
            Creates an empty template folder — add your server jar and configs in Templates later, or
            upload files now and come back.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Group</Label>
              <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="default" required />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="lobby" required />
            </div>
          </div>
          <Button type="submit" disabled={createTemplate.isPending}>
            {createTemplate.isPending ? "Creating..." : "Create and select"}
          </Button>
        </form>
      )}

      <div className="mt-6 flex justify-end">
        <Button type="button" onClick={onContinue} disabled={!selected}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </StepShell>
  );
}

interface ConfigStepProps {
  template: WizardTemplateSelection;
  configName: string;
  config: Configuration;
  onConfigNameChange: (name: string) => void;
  onConfigChange: (config: Configuration) => void;
  onContinue: () => void;
}

export function ConfigStep({
  template,
  configName,
  config,
  onConfigNameChange,
  onConfigChange,
  onContinue,
}: ConfigStepProps) {
  const saveConfig = useSaveConfiguration();
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = configName.trim();
    if (!trimmed) {
      toast.error("Configuration name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...config, name: trimmed };
      await saveConfig.mutateAsync({ name: trimmed, config: payload });
      toast.success("Configuration saved");
      onContinue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepShell
      title="Create a configuration"
      description="A configuration tells Universe how to run your server — memory, start command, and which template to copy. We've pre-filled sensible defaults for a typical Minecraft server."
    >
      <form onSubmit={handleSave} className="space-y-5">
        <div className="rounded-lg border border-teal-400/20 bg-teal-400/5 px-4 py-3 text-sm text-slate-300">
          Using template <span className="font-mono text-teal-300">{template.group}/{template.name}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cfg-name">Configuration name</Label>
            <Input
              id="cfg-name"
              value={configName}
              onChange={(e) => onConfigNameChange(e.target.value)}
              placeholder="my-first-server"
              required
            />
            <p className="text-xs text-slate-600">Saved as configuration/{configName || "..."}.json on the node</p>
          </div>

          <div className="space-y-2">
            <Label>Runtime</Label>
            <Select
              value={config.runtime}
              onChange={(e) => onConfigChange({ ...config, runtime: e.target.value })}
            >
              <option value="screen">screen</option>
              <option value="tmux">tmux</option>
              <option value="process">process</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cfg-ram">RAM (MB)</Label>
            <Input
              id="cfg-ram"
              type="number"
              min={512}
              value={config.ramMB}
              onChange={(e) => onConfigChange({ ...config, ramMB: Number(e.target.value) || 2048 })}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cfg-cmd">Start command</Label>
            <Input
              id="cfg-cmd"
              value={config.command}
              onChange={(e) => onConfigChange({ ...config, command: e.target.value })}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={saving || saveConfig.isPending}>
            {saving ? "Saving..." : "Save & continue"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </StepShell>
  );
}

interface DeployStepProps {
  configName: string;
  template: WizardTemplateSelection;
  instanceId: string | null;
  onDeployed: (instanceId: string) => void;
  onContinue: () => void;
}

export function DeployStep({
  configName,
  template,
  instanceId,
  onDeployed,
  onContinue,
}: DeployStepProps) {
  const createInstance = useCreateInstance();
  const [deploying, setDeploying] = useState(false);

  async function handleDeploy() {
    setDeploying(true);
    try {
      const created = await createInstance.mutateAsync(configName);
      if (!created.id) throw new Error("Instance created without an id");
      toast.success(`Instance ${created.id} is starting`);
      onDeployed(created.id);
      onContinue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <StepShell
      title="Deploy your first instance"
      description="Universe will copy your template, allocate a port, and start the process on an available node. This usually takes a few seconds."
    >
      <div className="space-y-4">
        <dl className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Configuration</dt>
            <dd className="font-mono text-slate-100">{configName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Template</dt>
            <dd className="font-mono text-slate-100">
              {template.group}/{template.name}
            </dd>
          </div>
        </dl>

        {instanceId ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Instance <span className="font-mono">{instanceId}</span> was created.
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-slate-400">
            <Server className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
            Ready to deploy — click below when you're set.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!instanceId && (
            <Button type="button" onClick={handleDeploy} disabled={deploying || createInstance.isPending}>
              {deploying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  Deploy instance
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
          {instanceId && (
            <Button type="button" onClick={onContinue}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </StepShell>
  );
}

interface HealthStepProps {
  instanceId: string;
  onContinue: () => void;
}

export function HealthStep({ instanceId, onContinue }: HealthStepProps) {
  const instance = useInstance(instanceId);
  const logs = useInstanceLogs(instanceId, 20);
  const state = instance.data?.state;
  const online = state === "ONLINE";
  const failed = state === "OFFLINE" || state === "STOPPED";

  useEffect(() => {
    if (online) {
      toast.success("Server is online!");
    }
  }, [online]);

  const statusMessage = online
    ? "Your instance reported healthy — you're ready for the console."
    : failed
      ? "The instance stopped or went offline. Check the logs below, fix your template or command, then try again from Deploy."
      : "Waiting for the Minecraft process to start and report in...";

  return (
    <StepShell
      title="Verify instance health"
      description="Universe tracks each instance's state. We'll refresh automatically until the server is online or we know something went wrong."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Instance</p>
            <p className="font-mono text-lg text-slate-100">{instanceId}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!online && !failed && <Loader2 className="h-4 w-4 animate-spin text-teal-400" />}
            {state && <InstanceStateBadge state={state} />}
          </div>
        </div>

        <p className="text-sm text-slate-400">{statusMessage}</p>

        {logs.data?.lines && logs.data.lines.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-black/40">
            <div className="border-b border-white/[0.06] px-3 py-2 text-xs text-slate-500">Recent logs</div>
            <pre className="max-h-48 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-slate-400">
              {logs.data.lines.join("\n")}
            </pre>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => instance.refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button type="button" onClick={onContinue} disabled={!online && !failed}>
            {online ? "Continue" : failed ? "Continue anyway" : "Waiting..."}
            {(online || failed) && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </StepShell>
  );
}

interface ConsoleStepProps {
  instanceId: string;
  configName: string;
}

export function ConsoleStep({ instanceId, configName }: ConsoleStepProps) {
  return (
    <StepShell
      title="You're live — open the console"
      description="Send commands to your instance or use the master console for cluster-wide management. Your first server is ready to explore."
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-100">First server wizard complete</p>
            <p className="mt-1 text-sm text-emerald-200/80">
              Instance <span className="font-mono">{instanceId}</span> running configuration{" "}
              <span className="font-mono">{configName}</span>.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/instances/${instanceId}`}
            className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 transition-colors hover:border-teal-400/30 hover:bg-teal-400/5"
          >
            <Server className="h-5 w-5 text-teal-400" />
            <div>
              <p className="font-medium text-slate-100 group-hover:text-teal-200">Instance detail</p>
              <p className="text-xs text-slate-500">Logs, lifecycle, and commands</p>
            </div>
          </Link>
          <Link
            href="/console"
            className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 transition-colors hover:border-violet-400/30 hover:bg-violet-400/5"
          >
            <Terminal className="h-5 w-5 text-violet-400" />
            <div>
              <p className="font-medium text-slate-100 group-hover:text-violet-200">Master console</p>
              <p className="text-xs text-slate-500">Cluster-wide Universe commands</p>
            </div>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={`/instances/${instanceId}`}>
            <Button type="button">
              Open instance
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button type="button" variant="outline">
              Go to dashboard
            </Button>
          </Link>
        </div>
      </div>
    </StepShell>
  );
}

export function syncConfigWithTemplate(
  config: Configuration,
  configName: string,
  template: WizardTemplateSelection | null,
): Configuration {
  if (!template) return config;
  return {
    ...defaultWizardConfig(template, configName),
    runtime: config.runtime,
    command: config.command,
    ramMB: config.ramMB,
    cpu: config.cpu,
    name: configName,
  };
}
