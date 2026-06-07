"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNodeInfo, useNodeConfig, useReloadNodeConfig } from "@/lib/api/queries";
import { formatSystemLoadAverage } from "@/lib/api/metrics";
import { formatBytes, formatUptime, cn } from "@/lib/utils";

export function NodeSettingsTab() {
  const nodeInfo = useNodeInfo();
  const nodeConfig = useNodeConfig();
  const reloadConfig = useReloadNodeConfig();

  async function handleReload() {
    try {
      await reloadConfig.mutateAsync();
      toast.success("Configuration reloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reload failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Node</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Live statistics and on-disk configuration for the connected Universe master.
        </p>
      </div>

      {nodeInfo.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Node ID", nodeInfo.data.id, true],
            ["Cluster", nodeInfo.data.clusterName, false],
            ["Uptime", formatUptime(nodeInfo.data.uptimeMs), false],
            [
              "Memory",
              `${formatBytes(nodeInfo.data.system.freeMemory)} free / ${formatBytes(nodeInfo.data.system.maxMemory)} max`,
              false,
            ],
            ["Processors", String(nodeInfo.data.system.availableProcessors), false],
            ["Load average", formatSystemLoadAverage(nodeInfo.data.system.systemLoadAverage), false],
          ].map(([label, value, mono]) => (
            <Card key={label as string}>
              <CardContent className="pt-4">
                <p className="text-xs text-zinc-500">{label as string}</p>
                <p className={cn("mt-1 text-sm", mono ? "font-mono" : "")}>{value as string}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 className="text-sm font-medium text-zinc-300">Configuration file</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReload}
            disabled={reloadConfig.isPending}
            title="Not yet implemented in Universe API"
          >
            Reload from disk
          </Button>
        </div>
        <pre className="max-h-[480px] overflow-auto rounded-xl border border-white/[0.06] bg-[#0a0c12] p-4 font-mono text-xs text-zinc-400">
          {nodeConfig.data ? JSON.stringify(nodeConfig.data, null, 2) : "Loading..."}
        </pre>
      </div>
    </div>
  );
}
