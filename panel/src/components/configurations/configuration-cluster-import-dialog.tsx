"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/context";
import {
  fetchRemoteConfigurations,
  importConfigurationsFromCluster,
} from "@/lib/api/cross-cluster";
import { queryKeys } from "@/lib/api/queries";
import type { Configuration } from "@/lib/api/types";
import {
  ClusterSourceSelect,
  ImportDestinationHint,
} from "@/components/import/cluster-source-select";
import { cn } from "@/lib/utils";

interface ConfigurationClusterImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ConfigurationClusterImportDialog({
  open,
  onClose,
  onSuccess,
}: ConfigurationClusterImportDialogProps) {
  const queryClient = useQueryClient();
  const { activeClusterId, activeCluster } = useAuth();
  const [sourceClusterId, setSourceClusterId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overwrite, setOverwrite] = useState(true);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [importing, setImporting] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteConfigs, setRemoteConfigs] = useState<Configuration[]>([]);

  useEffect(() => {
    if (!open) {
      setSourceClusterId("");
      setSelected(new Set());
      setRemoteConfigs([]);
      setRemoteError(null);
      setOverwrite(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !sourceClusterId) {
      setRemoteConfigs([]);
      setSelected(new Set());
      return;
    }

    let cancelled = false;
    setLoadingRemote(true);
    setRemoteError(null);

    fetchRemoteConfigurations(sourceClusterId)
      .then((configs) => {
        if (cancelled) return;
        setRemoteConfigs(
          configs
            .filter((c) => c.name)
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setRemoteError(err instanceof Error ? err.message : "Failed to load configurations");
        setRemoteConfigs([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRemote(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, sourceClusterId]);

  function toggleName(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    const names = remoteConfigs.map((c) => c.name!).filter(Boolean);
    setSelected(checked ? new Set(names) : new Set());
  }

  async function handleImport() {
    if (!sourceClusterId || selected.size === 0) {
      toast.error("Select a source cluster and at least one configuration");
      return;
    }

    setImporting(true);
    try {
      const result = await importConfigurationsFromCluster({
        sourceClusterId,
        destinationClusterId: activeClusterId ?? undefined,
        names: Array.from(selected),
        overwrite,
      });

      if (result.failed > 0) {
        const firstError = result.results.find((r) => !r.ok)?.error;
        toast.warning(
          `Imported ${result.imported}, failed ${result.failed}${firstError ? `: ${firstError}` : ""}`,
        );
      } else {
        toast.success(
          `Imported ${result.imported} configuration${result.imported === 1 ? "" : "s"}`,
        );
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.configurations(activeClusterId) });
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  const allNames = remoteConfigs.map((c) => c.name!).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className={cn(
          "glass-panel glow-border flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl p-6",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
      >
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-5 w-5 text-sky-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Import from cluster</h2>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1">
          <ClusterSourceSelect
            value={sourceClusterId}
            onChange={setSourceClusterId}
            excludeClusterId={activeClusterId}
          />
          <ImportDestinationHint destinationName={activeCluster?.name} />

          {loadingRemote && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading configurations…
            </div>
          )}

          {remoteError && <p className="text-sm text-red-400">{remoteError}</p>}

          {!loadingRemote && sourceClusterId && remoteConfigs.length === 0 && !remoteError && (
            <p className="text-sm text-zinc-500">No configurations on the selected cluster.</p>
          )}

          {remoteConfigs.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <Label className="mb-0">Configurations</Label>
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    checked={selected.size === allNames.length && allNames.length > 0}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900"
                  />
                  Select all
                </label>
              </div>

              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/[0.06] p-3">
                {remoteConfigs.map((config) => {
                  const name = config.name!;
                  return (
                    <label
                      key={name}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.03]"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(name)}
                          onChange={() => toggleName(name)}
                          className="rounded border-zinc-700 bg-zinc-900"
                        />
                        <span className="text-sm text-zinc-200">{name}</span>
                      </span>
                      <span className="text-xs text-zinc-600">{config.runtime}</span>
                    </label>
                  );
                })}
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900"
                />
                Overwrite existing configurations on destination
              </label>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-white/[0.04] pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={importing || selected.size === 0 || !sourceClusterId}
          >
            {importing ? "Importing…" : `Import ${selected.size || ""}`.trim()}
          </Button>
        </div>
      </div>
    </div>
  );
}
