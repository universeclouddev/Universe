"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AlertMinLevel, AlertWebhook, WebhookType } from "@/lib/panel/alerts";

interface AlertsConfig {
  enabled: boolean;
  pollIntervalSeconds: number;
  cooldownMinutes: number;
  webhooks: AlertWebhook[];
}

interface ClusterOption {
  id: string;
  name: string;
}

export function PanelAlertsSettings() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("settings.universe");

  const [config, setConfig] = useState<AlertsConfig | null>(null);
  const [clusters, setClusters] = useState<ClusterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<WebhookType>("generic");
  const [minLevel, setMinLevel] = useState<AlertMinLevel>("warning");
  const [notifyOnRecovery, setNotifyOnRecovery] = useState(true);
  const [clusterScope, setClusterScope] = useState<"all" | "selected">("all");
  const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [alertsRes, clustersRes] = await Promise.all([
      fetch("/api/panel/alerts", { credentials: "include" }),
      fetch("/api/panel/clusters", { credentials: "include" }),
    ]);

    if (alertsRes.ok) {
      setConfig(await alertsRes.json());
    }
    if (clustersRes.ok) {
      const data = await clustersRes.json();
      setClusters(
        (data.clusters ?? []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetWebhookForm() {
    setName("");
    setUrl("");
    setType("generic");
    setMinLevel("warning");
    setNotifyOnRecovery(true);
    setClusterScope("all");
    setSelectedClusterIds([]);
    setEditingId(null);
    setShowAdd(false);
  }

  function startAdd() {
    resetWebhookForm();
    setShowAdd(true);
  }

  function startEdit(webhook: AlertWebhook) {
    setEditingId(webhook.id);
    setShowAdd(false);
    setName(webhook.name);
    setUrl("");
    setType(webhook.type);
    setMinLevel(webhook.minLevel);
    setNotifyOnRecovery(webhook.notifyOnRecovery);
    if (!webhook.clusterIds || webhook.clusterIds.length === 0) {
      setClusterScope("all");
      setSelectedClusterIds([]);
    } else {
      setClusterScope("selected");
      setSelectedClusterIds(webhook.clusterIds);
    }
  }

  async function saveGlobalConfig(patch: Partial<AlertsConfig>) {
    if (!canManage) return;
    setSaving(true);
    try {
      const res = await fetch("/api/panel/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabled: patch.enabled,
          pollIntervalSeconds: patch.pollIntervalSeconds,
          cooldownMinutes: patch.cooldownMinutes,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
      const next = await res.json();
      setConfig(next);
      toast.success("Alert settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleWebhookSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    setSaving(true);
    try {
      const clusterIds =
        clusterScope === "all" ? null : selectedClusterIds.length > 0 ? selectedClusterIds : null;

      const payload = {
        id: editingId ?? undefined,
        name: name.trim(),
        url: url.trim() || undefined,
        type,
        minLevel,
        notifyOnRecovery,
        clusterIds,
      };

      const res = await fetch("/api/panel/alerts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save webhook");
      }

      toast.success(editingId ? "Webhook updated" : "Webhook added");
      resetWebhookForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleWebhook(webhook: AlertWebhook) {
    if (!canManage) return;
    const res = await fetch("/api/panel/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: webhook.id, enabled: !webhook.enabled }),
    });
    if (!res.ok) {
      toast.error("Failed to update webhook");
      return;
    }
    await load();
  }

  async function deleteWebhook(id: string) {
    if (!canManage || !confirm("Remove this webhook?")) return;
    const res = await fetch(`/api/panel/alerts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      toast.error("Failed to delete webhook");
      return;
    }
    toast.success("Webhook removed");
    if (editingId === id) resetWebhookForm();
    await load();
  }

  async function testWebhook(webhook: AlertWebhook, testUrl?: string) {
    if (!canManage) return;
    setTestingId(webhook.id);
    try {
      const res = await fetch("/api/panel/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: testUrl ? undefined : webhook.id,
          url: testUrl,
          type: webhook.type,
          clusterName: clusters[0]?.name ?? "Test Cluster",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Test failed");
      }
      toast.success("Test notification sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingId(null);
    }
  }

  async function runEvaluation() {
    if (!canManage) return;
    setEvaluating(true);
    try {
      const res = await fetch("/api/panel/alerts/evaluate", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Evaluation failed");
      toast.success(
        `Evaluated ${body.evaluated} cluster(s), dispatched ${body.dispatched} notification(s)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  }

  function toggleClusterId(id: string) {
    setSelectedClusterIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  if (loading || !config) {
    return <p className="text-sm text-zinc-500">Loading alert settings...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
          <Bell className="h-5 w-5 text-violet-400" />
          Alerts &amp; notifications
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Webhook alerts when cluster health thresholds breach. Uses per-cluster health settings
          from Settings → Clusters. Supports Discord webhooks and generic JSON URLs.
        </p>
      </div>

      <div className="max-w-lg space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="font-medium text-zinc-200">Evaluator</h3>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={config.enabled}
            disabled={!canManage || saving}
            onChange={(e) => void saveGlobalConfig({ ...config, enabled: e.target.checked })}
            className="rounded border-zinc-600"
          />
          Enable background health evaluation
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="poll-interval">Poll interval (seconds)</Label>
            <Input
              id="poll-interval"
              type="number"
              min={15}
              max={3600}
              value={config.pollIntervalSeconds}
              disabled={!canManage}
              onChange={(e) =>
                setConfig({ ...config, pollIntervalSeconds: Number(e.target.value) })
              }
              onBlur={() =>
                void saveGlobalConfig({
                  pollIntervalSeconds: config.pollIntervalSeconds,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cooldown">Cooldown (minutes)</Label>
            <Input
              id="cooldown"
              type="number"
              min={1}
              max={1440}
              value={config.cooldownMinutes}
              disabled={!canManage}
              onChange={(e) => setConfig({ ...config, cooldownMinutes: Number(e.target.value) })}
              onBlur={() =>
                void saveGlobalConfig({
                  cooldownMinutes: config.cooldownMinutes,
                })
              }
            />
          </div>
        </div>
        {canManage && (
          <Button type="button" variant="outline" size="sm" disabled={evaluating} onClick={runEvaluation}>
            {evaluating ? "Evaluating..." : "Run evaluation now"}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-zinc-200">Webhooks</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Discord URLs are auto-detected. Generic webhooks receive a JSON payload with health
            details.
          </p>
        </div>
        {canManage && !showAdd && !editingId && (
          <Button type="button" variant="outline" size="sm" onClick={startAdd}>
            Add webhook
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 font-medium">Clusters</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canManage && <th className="px-4 py-3 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {config.webhooks.map((webhook) => (
              <tr key={webhook.id} className="border-b border-white/[0.04] last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-200">{webhook.name}</p>
                  {webhook.urlHint && (
                    <p className="font-mono text-xs text-zinc-500">{webhook.urlHint}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="muted" className="text-[10px]">
                    {webhook.type}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-zinc-400">{webhook.minLevel}</td>
                <td className="px-4 py-3 text-zinc-400">
                  {!webhook.clusterIds || webhook.clusterIds.length === 0
                    ? "All"
                    : `${webhook.clusterIds.length} selected`}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={webhook.enabled ? "success" : "muted"} className="text-[10px]">
                    {webhook.enabled ? "On" : "Off"}
                  </Badge>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(webhook)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={testingId === webhook.id}
                        onClick={() => void testWebhook(webhook)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Test
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void toggleWebhook(webhook)}>
                        {webhook.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void deleteWebhook(webhook.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {config.webhooks.length === 0 && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-4 py-6 text-center text-zinc-500">
                  No webhooks configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (showAdd || editingId) && (
        <form
          onSubmit={handleWebhookSubmit}
          className="max-w-lg space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
        >
          <h3 className="font-medium text-zinc-200">
            {editingId ? "Edit webhook" : "Add webhook"}
          </h3>
          <div className="space-y-2">
            <Label htmlFor="webhook-name">Name</Label>
            <Input
              id="webhook-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ops Discord"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-url">
              Webhook URL {editingId && "(leave blank to keep current)"}
            </Label>
            <Input
              id="webhook-url"
              type="password"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (e.target.value.includes("discord.com/api/webhooks")) {
                  setType("discord");
                }
              }}
              placeholder="https://discord.com/api/webhooks/..."
              required={!editingId}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="webhook-type">Type</Label>
              <Select
                id="webhook-type"
                value={type}
                onChange={(e) => setType(e.target.value as WebhookType)}
              >
                <option value="discord">Discord</option>
                <option value="generic">Generic JSON</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-level">Minimum level</Label>
              <Select
                id="webhook-level"
                value={minLevel}
                onChange={(e) => setMinLevel(e.target.value as AlertMinLevel)}
              >
                <option value="warning">Warning</option>
                <option value="critical">Critical only</option>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={notifyOnRecovery}
              onChange={(e) => setNotifyOnRecovery(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Notify when health recovers
          </label>
          <div className="space-y-2">
            <Label>Clusters</Label>
            <Select
              value={clusterScope}
              onChange={(e) => setClusterScope(e.target.value as "all" | "selected")}
            >
              <option value="all">All clusters</option>
              <option value="selected">Selected clusters</option>
            </Select>
            {clusterScope === "selected" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {clusters.map((cluster) => (
                  <label
                    key={cluster.id}
                    className="flex items-center gap-1.5 rounded-md border border-white/[0.06] px-2 py-1 text-xs text-zinc-300"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClusterIds.includes(cluster.id)}
                      onChange={() => toggleClusterId(cluster.id)}
                      className="rounded border-zinc-600"
                    />
                    {cluster.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={resetWebhookForm}>
              Cancel
            </Button>
            {url.trim() && (
              <Button
                type="button"
                variant="outline"
                disabled={!!testingId}
                onClick={() =>
                  void testWebhook(
                    {
                      id: "new",
                      name,
                      type,
                      enabled: true,
                      clusterIds: null,
                      minLevel,
                      notifyOnRecovery,
                      createdAt: 0,
                      hasUrl: true,
                      urlHint: null,
                    },
                    url.trim(),
                  )
                }
              >
                Test URL
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Add webhook"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
