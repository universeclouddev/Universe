"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ExportFormat = "json" | "zip";
type ClusterMode = "merge" | "replace";

export function PanelBackupSettings() {
  const { hasPermission, clusters, activeClusterId } = useAuth();
  const canManage = hasPermission("settings.universe");

  const [exportFormat, setExportFormat] = useState<ExportFormat>("zip");
  const [includeTemplates, setIncludeTemplates] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreClusters, setRestoreClusters] = useState(true);
  const [restoreTemplates, setRestoreTemplates] = useState(false);
  const [clusterMode, setClusterMode] = useState<ClusterMode>("merge");
  const [templateClusterId, setTemplateClusterId] = useState("");
  const [overwriteTemplates, setOverwriteTemplates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    clustersRestored: number;
    templatesImported: number;
    templatesFailed: number;
    warnings: string[];
  } | null>(null);

  useEffect(() => {
    if (activeClusterId && !templateClusterId) {
      setTemplateClusterId(activeClusterId);
    }
  }, [activeClusterId, templateClusterId]);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        format: exportFormat,
        includeTemplates: String(includeTemplates),
      });
      const response = await fetch(`/api/panel/backup/export?${params}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Export failed");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `universe-panel-backup.${exportFormat}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success("Backup exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreFile) {
      toast.error("Select a backup file");
      return;
    }

    setImporting(true);
    setLastResult(null);
    try {
      const form = new FormData();
      form.append("file", restoreFile);
      form.append("restoreClusters", String(restoreClusters));
      form.append("restoreTemplates", String(restoreTemplates));
      form.append("clusterMode", clusterMode);
      form.append("overwriteTemplates", String(overwriteTemplates));
      if (templateClusterId) form.append("templateClusterId", templateClusterId);

      const response = await fetch("/api/panel/backup/import", {
        method: "POST",
        credentials: "include",
        body: form,
      });

      const body = (await response.json()) as {
        error?: string;
        clustersRestored?: number;
        templatesImported?: number;
        templatesFailed?: number;
        warnings?: string[];
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Restore failed");
      }

      setLastResult({
        clustersRestored: body.clustersRestored ?? 0,
        templatesImported: body.templatesImported ?? 0,
        templatesFailed: body.templatesFailed ?? 0,
        warnings: body.warnings ?? [],
      });

      toast.success("Backup restored");
      setRestoreFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setImporting(false);
    }
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200/90">
        You need cluster configuration permission to export or restore panel backups.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Archive className="h-5 w-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Backup &amp; restore</h2>
        </div>
        <p className="text-sm text-zinc-500">
          Export cluster connections, health rules, and template metadata. Optionally include
          Universe template archives from each connected cluster.
        </p>
      </div>

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-4 w-4 text-teal-400" />
          <h3 className="font-medium text-zinc-200">Export</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Format</Label>
            <Select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            >
              <option value="zip">Zip archive (.zip)</option>
              <option value="json">JSON (.json)</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Template archives</Label>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={includeTemplates}
                onChange={(e) => setIncludeTemplates(e.target.checked)}
                className="rounded border-white/20 bg-white/5"
              />
              Export Universe template zips where reachable
            </label>
          </div>
        </div>

        <p className="mt-3 text-xs text-zinc-600">
          Includes {clusters.length} cluster{clusters.length === 1 ? "" : "s"} with encrypted API
          tokens. Restore on the same panel instance to preserve token decryption.
        </p>

        <Button className="mt-4" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting..." : "Download backup"}
        </Button>
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <form onSubmit={handleRestore}>
          <div className="mb-4 flex items-center gap-2">
            <Upload className="h-4 w-4 text-violet-400" />
            <h3 className="font-medium text-zinc-200">Restore</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Backup file</Label>
              <Input
                type="file"
                accept=".zip,.json,application/zip,application/json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={restoreClusters}
                  onChange={(e) => setRestoreClusters(e.target.checked)}
                  className="rounded border-white/20 bg-white/5"
                />
                Restore cluster settings &amp; health rules
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={restoreTemplates}
                  onChange={(e) => setRestoreTemplates(e.target.checked)}
                  className="rounded border-white/20 bg-white/5"
                />
                Import template archives to cluster
              </label>
            </div>

            {restoreClusters && (
              <div className="space-y-2">
                <Label>Cluster merge mode</Label>
                <Select
                  value={clusterMode}
                  onChange={(e) => setClusterMode(e.target.value as ClusterMode)}
                >
                  <option value="merge">Merge — update matching IDs, add new</option>
                  <option value="replace">Replace — remove existing clusters first</option>
                </Select>
              </div>
            )}

            {restoreTemplates && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Template destination cluster</Label>
                  <Select
                    value={templateClusterId}
                    onChange={(e) => setTemplateClusterId(e.target.value)}
                  >
                    {clusters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Overwrite existing templates</Label>
                  <label className="flex items-center gap-2 text-sm text-zinc-400">
                    <input
                      type="checkbox"
                      checked={overwriteTemplates}
                      onChange={(e) => setOverwriteTemplates(e.target.checked)}
                      className="rounded border-white/20 bg-white/5"
                    />
                    Replace templates with the same group/name
                  </label>
                </div>
              </div>
            )}
          </div>

          <Button type="submit" variant="secondary" className="mt-4" disabled={importing}>
            {importing ? "Restoring..." : "Restore from backup"}
          </Button>
        </form>

        {lastResult && (
          <div className="mt-4 space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{lastResult.clustersRestored} clusters restored</Badge>
              <Badge variant="accent">{lastResult.templatesImported} templates imported</Badge>
              {lastResult.templatesFailed > 0 && (
                <Badge variant="danger">{lastResult.templatesFailed} template failures</Badge>
              )}
            </div>
            {lastResult.warnings.map((warning) => (
              <p key={warning} className="text-xs text-amber-400/90">
                {warning}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function PanelBackupPage() {
  return (
    <div>
      <Link
        href="/settings"
        className={cn(
          "mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors",
          "hover:text-zinc-300",
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Settings
      </Link>
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl">
        Backup &amp; restore
      </h1>
      <PanelBackupSettings />
    </div>
  );
}
