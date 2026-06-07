"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PANEL_ROLES_ORDERED, ROLE_LABELS, type PanelRole } from "@/lib/panel/permissions";
import type { ClusterHealthSettings } from "@/lib/panel/cluster-health";
import {
  RenameClusterDialog,
  type RenameClusterTarget,
} from "@/components/clusters/rename-cluster-dialog";
import {
  ClusterHealthSettingsDialog,
  type ClusterHealthTarget,
} from "@/components/clusters/cluster-health-settings-dialog";

interface PanelUserRow {
  id: string;
  email: string;
  name: string;
  role: PanelRole;
  isPrimary?: boolean;
  hasPassword: boolean;
  oidcSubject: string | null;
  createdAt: number;
}

export function PanelUniverseSettings() {
  const queryClient = useQueryClient();
  const { refreshSession, activeClusterId, clusters: sessionClusters } = useAuth();
  const [clusters, setClusters] = useState<
    { id: string; name: string; apiUrl: string; hasToken: boolean; health?: ClusterHealthSettings }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [healthTarget, setHealthTarget] = useState<ClusterHealthTarget | null>(null);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [renameTarget, setRenameTarget] = useState<RenameClusterTarget | null>(null);

  async function loadClusters() {
    const res = await fetch("/api/panel/clusters", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setClusters(data.clusters ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadClusters();
  }, [sessionClusters.length, activeClusterId]);

  function resetForm() {
    setName("");
    setApiUrl("");
    setApiToken("");
    setEditingId(null);
    setShowAdd(false);
  }

  function startEdit(cluster: { id: string; name: string; apiUrl: string; hasToken: boolean }) {
    setEditingId(cluster.id);
    setShowAdd(false);
    setName(cluster.name);
    setApiUrl(cluster.apiUrl);
    setApiToken("");
  }

  function startAdd() {
    resetForm();
    setShowAdd(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const isEdit = !!editingId;
      const res = await fetch("/api/panel/clusters", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: editingId ?? undefined,
          name: name.trim(),
          apiUrl: apiUrl.trim(),
          apiToken: apiToken.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
      toast.success(isEdit ? "Cluster updated" : "Cluster added");
      resetForm();
      await loadClusters();
      await refreshSession();
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this cluster from the panel?")) return;
    const res = await fetch(`/api/panel/clusters?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Failed to delete cluster");
      return;
    }
    toast.success("Cluster removed");
    if (editingId === id) resetForm();
    await loadClusters();
    await refreshSession();
    await queryClient.invalidateQueries();
  }

  function startHealth(cluster: ClusterHealthTarget) {
    setHealthTarget(cluster);
    setHealthDialogOpen(true);
  }

  const editingCluster = editingId ? clusters.find((c) => c.id === editingId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Universe clusters</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Connect multiple Universe masters. The display name is read from each master&apos;s{" "}
            <code className="text-violet-400">clusterName</code> in config.json (via{" "}
            <code className="text-violet-400">/api/ping</code>). You can override it with an optional
            alias when adding or editing.
          </p>
        </div>
        {!showAdd && !editingId && (
          <Button type="button" variant="outline" size="sm" onClick={startAdd}>
            Add cluster
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-zinc-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">API URL</th>
                  <th className="px-4 py-3 font-medium">Health</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((cluster) => (
                  <tr key={cluster.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3 font-medium text-zinc-200">{cluster.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{cluster.apiUrl}</td>
                    <td className="px-4 py-3">
                      {cluster.health?.healthCheckEnabled === false ? (
                        <Badge variant="muted" className="text-[10px]">
                          Off
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px]">
                          {cluster.health?.memoryWarningPercent ?? 75}/
                          {cluster.health?.memoryCriticalPercent ?? 90}%
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {cluster.id === activeClusterId ? (
                        <Badge variant="accent" className="text-[10px]">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="text-[10px]">
                          —
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRenameTarget({ id: cluster.id, name: cluster.name })}
                        >
                          Rename
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => startEdit(cluster)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => startHealth(cluster)}>
                          Health
                        </Button>
                        {clusters.length > 1 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(cluster.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {clusters.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                      No clusters configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {(showAdd || editingId) && (
            <form onSubmit={handleSave} className="max-w-lg space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h3 className="font-medium text-zinc-200">
                {editingId ? `Edit ${editingCluster?.name ?? "cluster"}` : "Add cluster"}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="cluster-name">Display name (optional)</Label>
                <Input
                  id="cluster-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Auto from Universe clusterName"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cluster-api-url">API URL</Label>
                <Input
                  id="cluster-api-url"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="http://localhost:7000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cluster-api-token">
                  Service API key{" "}
                  {editingCluster?.hasToken && "(leave blank to keep current)"}
                </Label>
                <Input
                  id="cluster-api-token"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder={editingCluster?.hasToken ? "••••••••••••" : "ALL permission key"}
                  required={!editingCluster?.hasToken}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save changes" : "Add cluster"}
                </Button>
              </div>
            </form>
          )}
        </>
      )}

      <RenameClusterDialog
        cluster={renameTarget}
        open={renameTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRenameTarget(null);
        }}
        onRenamed={loadClusters}
      />

      <ClusterHealthSettingsDialog
        cluster={healthTarget}
        open={healthDialogOpen}
        onOpenChange={(open) => {
          setHealthDialogOpen(open);
          if (!open) {
            setHealthTarget(null);
            void loadClusters();
          }
        }}
      />
    </div>
  );
}

export function PanelOidcSettings() {
  const [enabled, setEnabled] = useState(false);
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [defaultRole, setDefaultRole] = useState<PanelRole>("viewer");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/panel/settings/oidc", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.enabled !== undefined) setEnabled(data.enabled);
        if (data.issuer) setIssuer(data.issuer);
        if (data.clientId) setClientId(data.clientId);
        if (data.hasClientSecret) setHasClientSecret(true);
        if (data.defaultRole) setDefaultRole(data.defaultRole);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/panel/settings/oidc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabled,
          issuer: issuer.trim(),
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim() || undefined,
          defaultRole,
        }),
      });
      if (!res.ok) throw new Error("Failed to save OIDC settings");
      toast.success("OIDC settings updated");
      setClientSecret("");
      setHasClientSecret(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">OIDC / SSO</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Optional OpenID Connect sign-in. New SSO users receive the default role until an operator
          changes it.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <form onSubmit={handleSave} className="max-w-lg space-y-4">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Enable OIDC sign-in
          </label>
          <div className="space-y-2">
            <Label htmlFor="oidc-issuer">Issuer URL</Label>
            <Input
              id="oidc-issuer"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="https://auth.example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="oidc-client-id">Client ID</Label>
            <Input
              id="oidc-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="oidc-client-secret">
              Client secret {hasClientSecret && "(leave blank to keep)"}
            </Label>
            <Input
              id="oidc-client-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="oidc-default-role">Default role for new SSO users</Label>
            <Select
              id="oidc-default-role"
              value={defaultRole}
              onChange={(e) => setDefaultRole(e.target.value as PanelRole)}
            >
              {PANEL_ROLES_ORDERED.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save SSO settings"}
          </Button>
        </form>
      )}
    </div>
  );
}

export function PanelUsersSettings() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<PanelUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PanelRole>("viewer");
  const [creating, setCreating] = useState(false);

  async function loadUsers() {
    const res = await fetch("/api/panel/users", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/panel/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), name: name.trim(), password, role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create user");
      }
      toast.success("User created");
      setEmail("");
      setName("");
      setPassword("");
      setRole("viewer");
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function updateRole(id: string, newRole: PanelRole) {
    const res = await fetch("/api/panel/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, role: newRole }),
    });
    if (!res.ok) {
      toast.error("Failed to update role");
      return;
    }
    toast.success("Role updated");
    await loadUsers();
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user?")) return;
    const res = await fetch(`/api/panel/users?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      toast.error("Failed to delete user");
      return;
    }
    toast.success("User deleted");
    await loadUsers();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Panel users</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Manage local accounts and roles. See the Access tab for what each role can do.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 md:grid-cols-2 lg:grid-cols-5"
      >
        <Input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Select value={role} onChange={(e) => setRole(e.target.value as PanelRole)}>
          {PANEL_ROLES_ORDERED.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={creating}>
          Add user
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading users...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Auth</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-200">{u.name}</p>
                    <p className="text-xs text-zinc-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {u.isPrimary ? (
                      <Badge
                        variant="success"
                        className="text-[10px]"
                        title="Primary account — permanently operator"
                      >
                        {ROLE_LABELS.operator}
                      </Badge>
                    ) : (
                      <Select
                        value={u.role}
                        disabled={u.id === currentUser?.id}
                        onChange={(e) => updateRole(u.id, e.target.value as PanelRole)}
                        className="h-auto w-auto px-2 py-1 text-xs"
                      >
                        {PANEL_ROLES_ORDERED.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {u.hasPassword && (
                        <Badge variant="muted" className="text-[10px]">
                          password
                        </Badge>
                      )}
                      {u.oidcSubject && (
                        <Badge variant="muted" className="text-[10px]">
                          oidc
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== currentUser?.id && !u.isPrimary && (
                      <Button variant="destructive" size="sm" onClick={() => deleteUser(u.id)}>
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
