"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export interface RenameClusterTarget {
  id: string;
  name: string;
}

interface RenameClusterDialogProps {
  cluster: RenameClusterTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed?: () => void | Promise<void>;
}

export function RenameClusterDialog({
  cluster,
  open,
  onOpenChange,
  onRenamed,
}: RenameClusterDialogProps) {
  const queryClient = useQueryClient();
  const { refreshSession } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && cluster) {
      setName(cluster.name);
    }
  }, [open, cluster]);

  if (!open || !cluster) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Cluster name cannot be empty");
      return;
    }
    if (trimmed === cluster!.name) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/panel/clusters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: cluster!.id, name: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to rename cluster");
      }
      toast.success("Cluster renamed");
      onOpenChange(false);
      await refreshSession();
      await queryClient.invalidateQueries();
      await onRenamed?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename cluster");
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
          "glass-panel glow-border w-full max-w-md rounded-2xl p-6",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
      >
        <div className="mb-4 flex items-center gap-2">
          <Pencil className="h-5 w-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Rename cluster</h2>
        </div>
        <p className="mb-4 text-sm text-zinc-500">
          Set a display name for this cluster in the panel. This does not change the Universe{" "}
          <code className="text-violet-400">clusterName</code> on the master.
        </p>

        <div className="space-y-2">
          <Label htmlFor="rename-cluster-name">Display name</Label>
          <Input
            id="rename-cluster-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production"
            required
            autoFocus
            disabled={saving}
          />
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
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
