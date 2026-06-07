"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  Network,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/context";
import { useClusterNodes, usePing } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  RenameClusterDialog,
  type RenameClusterTarget,
} from "@/components/clusters/rename-cluster-dialog";

export function ClusterMenu() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addName, setAddName] = useState("");
  const [addApiUrl, setAddApiUrl] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_API_URL ?? "http://localhost:7000",
  );
  const [addApiToken, setAddApiToken] = useState("");
  const [renameTarget, setRenameTarget] = useState<RenameClusterTarget | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    apiUrl,
    clusters,
    activeClusterId,
    activeCluster,
    hasPermission,
    switchCluster,
    refreshSession,
  } = useAuth();
  const ping = usePing();
  const nodes = useClusterNodes();

  const canManage = hasPermission("settings.universe");
  const connected = ping.data?.status === "ok";
  const displayName = activeCluster?.name ?? ping.data?.clusterName ?? "No cluster";

  useEffect(() => {
    if (!open) {
      setShowAddForm(false);
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  async function handleSwitch(clusterId: string) {
    if (clusterId === activeClusterId) return;
    setSwitching(clusterId);
    try {
      await switchCluster(clusterId);
      toast.success("Switched cluster");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch cluster");
    } finally {
      setSwitching(null);
    }
  }

  async function handleRemove(clusterId: string, clusterName: string) {
    if (clusters.length <= 1) {
      toast.error("Cannot remove the last cluster");
      return;
    }
    if (!confirm(`Remove "${clusterName}" from the panel?`)) return;

    setRemoving(clusterId);
    try {
      const res = await fetch(`/api/panel/clusters?id=${encodeURIComponent(clusterId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to remove cluster");
      }
      toast.success("Cluster removed");
      await refreshSession();
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove cluster");
    } finally {
      setRemoving(null);
    }
  }

  async function handleAddCluster(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/panel/clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: addName.trim() || undefined,
          apiUrl: addApiUrl.trim(),
          apiToken: addApiToken.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to add cluster");
      }
      toast.success("Cluster added");
      setAddName("");
      setAddApiToken("");
      setShowAddForm(false);
      await refreshSession();
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add cluster");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-zinc-300 transition-colors",
          open
            ? "border-white/[0.12] bg-white/[0.06]"
            : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]",
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            connected ? "bg-emerald-400 pulse-dot" : "bg-zinc-600",
          )}
        />
        <span className="max-w-[140px] truncate">{displayName}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-zinc-600 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[100] w-80 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0f1117] shadow-2xl shadow-black/40"
        >
          <div className="p-3">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{displayName}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {connected ? "Connected" : ping.isError ? "Unreachable" : "Connecting..."}
                </p>
              </div>
              {ping.data && (
                <Badge variant={ping.data.master ? "accent" : "muted"} className="shrink-0 text-[10px]">
                  {ping.data.master ? "Master" : "Wrapper"}
                </Badge>
              )}
            </div>

            {(clusters.length > 0 || canManage) && (
              <div className="mb-3 border-b border-white/[0.06] pb-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    Clusters
                  </p>
                  {canManage && !showAddForm && (
                    <button
                      type="button"
                      onClick={() => setShowAddForm(true)}
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-violet-400 transition-colors hover:bg-violet-500/10 hover:text-violet-300"
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </button>
                  )}
                </div>

                {showAddForm && canManage && (
                  <form
                    onSubmit={handleAddCluster}
                    className="mb-3 space-y-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-zinc-300">New cluster</p>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="rounded p-0.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
                        aria-label="Close"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cluster-menu-name" className="text-[10px] text-zinc-500">
                        Name (optional)
                      </Label>
                      <Input
                        id="cluster-menu-name"
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        placeholder="Auto from Universe"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cluster-menu-url" className="text-[10px] text-zinc-500">
                        API URL
                      </Label>
                      <Input
                        id="cluster-menu-url"
                        value={addApiUrl}
                        onChange={(e) => setAddApiUrl(e.target.value)}
                        placeholder="http://localhost:7000"
                        required
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cluster-menu-token" className="text-[10px] text-zinc-500">
                        Service API key (ALL)
                      </Label>
                      <Input
                        id="cluster-menu-token"
                        type="password"
                        value={addApiToken}
                        onChange={(e) => setAddApiToken(e.target.value)}
                        placeholder="unv_…"
                        required
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button type="submit" size="sm" className="h-8 w-full text-xs" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Adding…
                        </>
                      ) : (
                        "Add cluster"
                      )}
                    </Button>
                  </form>
                )}

                <ul className="space-y-1">
                  {clusters.map((cluster) => {
                    const active = cluster.id === activeClusterId;
                    const busy = switching === cluster.id || removing === cluster.id;
                    return (
                      <li key={cluster.id}>
                        <div
                          className={cn(
                            "flex items-center gap-1 rounded-lg transition-colors",
                            active ? "bg-violet-500/10" : "hover:bg-white/[0.04]",
                          )}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            disabled={busy || switching !== null || removing !== null}
                            onClick={() => handleSwitch(cluster.id)}
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm",
                              active ? "text-violet-200" : "text-zinc-300",
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                active ? "bg-violet-400" : "bg-zinc-600",
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate">{cluster.name}</span>
                            {busy && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-zinc-500" />}
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              disabled={busy || removing !== null}
                              onClick={() => setRenameTarget({ id: cluster.id, name: cluster.name })}
                              className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
                              aria-label={`Rename ${cluster.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canManage && clusters.length > 1 && (
                            <button
                              type="button"
                              disabled={busy || removing !== null}
                              onClick={() => handleRemove(cluster.id, cluster.name)}
                              className="mr-1 rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
                              aria-label={`Remove ${cluster.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {clusters.length === 0 && (
                    <li className="px-2 py-1.5 text-xs text-zinc-500">No clusters linked yet.</li>
                  )}
                </ul>
              </div>
            )}

            <dl className="space-y-2 border-b border-white/[0.06] pb-3 text-xs">
              {apiUrl && (
                <div>
                  <dt className="text-zinc-600">API URL</dt>
                  <dd className="mt-0.5 truncate font-mono text-zinc-400">{apiUrl}</dd>
                </div>
              )}
              {ping.data?.nodeId && (
                <div>
                  <dt className="text-zinc-600">This node</dt>
                  <dd className="mt-0.5 font-mono text-zinc-400">{ping.data.nodeId}</dd>
                </div>
              )}
              {hasPermission("cluster.read") && nodes.data && (
                <div>
                  <dt className="text-zinc-600">Cluster members</dt>
                  <dd className="mt-0.5 text-zinc-400">{nodes.data.length} node(s)</dd>
                </div>
              )}
            </dl>

            <div className="mt-3 space-y-1">
              {hasPermission("cluster.read") && (
                <Link
                  href="/cluster"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-zinc-100"
                >
                  <Network className="h-4 w-4 text-zinc-500" />
                  View cluster nodes
                </Link>
              )}
              {apiUrl && (
                <a
                  href={apiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-zinc-100"
                >
                  <ExternalLink className="h-4 w-4 text-zinc-500" />
                  Open API in browser
                </a>
              )}
            </div>
          </div>
        </div>
      )}
      <RenameClusterDialog
        cluster={renameTarget}
        open={renameTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRenameTarget(null);
        }}
      />
    </div>
  );
}
