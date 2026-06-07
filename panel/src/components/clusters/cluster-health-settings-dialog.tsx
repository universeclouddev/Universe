"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  DEFAULT_CLUSTER_HEALTH,
  resolveClusterHealth,
  type ClusterHealthSettings,
} from "@/lib/panel/cluster-health";

export interface ClusterHealthTarget {
  id: string;
  name: string;
  health?: ClusterHealthSettings;
}

interface ClusterHealthSettingsDialogProps {
  cluster: ClusterHealthTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClusterHealthSettingsDialog({
  cluster,
  open,
  onOpenChange,
}: ClusterHealthSettingsDialogProps) {
  const queryClient = useQueryClient();
  const { refreshSession } = useAuth();
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(true);
  const [memoryWarningPercent, setMemoryWarningPercent] = useState(
    String(DEFAULT_CLUSTER_HEALTH.memoryWarningPercent),
  );
  const [memoryCriticalPercent, setMemoryCriticalPercent] = useState(
    String(DEFAULT_CLUSTER_HEALTH.memoryCriticalPercent),
  );
  const [offlineThresholdEnabled, setOfflineThresholdEnabled] = useState(true);
  const [instanceOfflineThresholdSeconds, setInstanceOfflineThresholdSeconds] = useState(
    String(DEFAULT_CLUSTER_HEALTH.instanceOfflineThresholdSeconds ?? 300),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && cluster) {
      const h = resolveClusterHealth(cluster.health);
      setHealthCheckEnabled(h.healthCheckEnabled);
      setMemoryWarningPercent(String(h.memoryWarningPercent));
      setMemoryCriticalPercent(String(h.memoryCriticalPercent));
      const hasThreshold = h.instanceOfflineThresholdSeconds != null;
      setOfflineThresholdEnabled(hasThreshold);
      setInstanceOfflineThresholdSeconds(
        String(h.instanceOfflineThresholdSeconds ?? 300),
      );
    }
  }, [open, cluster]);

  if (!open || !cluster) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const warn = parseInt(memoryWarningPercent, 10);
    const crit = parseInt(memoryCriticalPercent, 10);
    const offlineSec = offlineThresholdEnabled
      ? parseInt(instanceOfflineThresholdSeconds, 10)
      : null;

    if (!Number.isInteger(warn) || warn < 0 || warn > 100) {
      toast.error("Warning threshold must be 0–100");
      return;
    }
    if (!Number.isInteger(crit) || crit < 0 || crit > 100) {
      toast.error("Critical threshold must be 0–100");
      return;
    }
    if (warn >= crit) {
      toast.error("Warning threshold must be less than critical");
      return;
    }
    if (offlineSec !== null && (!Number.isInteger(offlineSec) || offlineSec <= 0)) {
      toast.error("Offline threshold must be a positive number of seconds");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/panel/clusters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: cluster!.id,
          health: {
            healthCheckEnabled,
            memoryWarningPercent: warn,
            memoryCriticalPercent: crit,
            instanceOfflineThresholdSeconds: offlineSec,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save health settings");
      }
      toast.success("Health settings saved");
      onOpenChange(false);
      await refreshSession();
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save health settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onOpenChange(false);
      }}
    >
      <form
        onSubmit={handleSubmit}
        className={cn(
          "glass-panel glow-border w-full max-w-lg rounded-2xl p-6",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
      >
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Health settings</h2>
        </div>
        <p className="mb-4 text-sm text-zinc-500">
          Configure health thresholds for <strong className="text-zinc-300">{cluster.name}</strong>.
          These apply only in the panel — evaluation uses live API metrics from this cluster.
        </p>

        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={healthCheckEnabled}
              onChange={(e) => setHealthCheckEnabled(e.target.checked)}
              className="rounded border-zinc-600"
              disabled={saving}
            />
            Enable health checks
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="health-warn-pct">Memory warning (%)</Label>
              <Input
                id="health-warn-pct"
                type="number"
                min={0}
                max={100}
                value={memoryWarningPercent}
                onChange={(e) => setMemoryWarningPercent(e.target.value)}
                disabled={saving || !healthCheckEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="health-crit-pct">Memory critical (%)</Label>
              <Input
                id="health-crit-pct"
                type="number"
                min={0}
                max={100}
                value={memoryCriticalPercent}
                onChange={(e) => setMemoryCriticalPercent(e.target.value)}
                disabled={saving || !healthCheckEnabled}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={offlineThresholdEnabled}
                onChange={(e) => setOfflineThresholdEnabled(e.target.checked)}
                className="rounded border-zinc-600"
                disabled={saving || !healthCheckEnabled}
              />
              Alert on instances offline longer than
            </label>
            <Input
              type="number"
              min={1}
              value={instanceOfflineThresholdSeconds}
              onChange={(e) => setInstanceOfflineThresholdSeconds(e.target.value)}
              disabled={saving || !healthCheckEnabled || !offlineThresholdEnabled}
              placeholder="300"
            />
            <p className="text-xs text-zinc-600">
              Seconds before an OFFLINE instance triggers a warning.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save health settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
