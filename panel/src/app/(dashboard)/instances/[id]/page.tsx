"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Square, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/layout/sidebar";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstanceStateBadge } from "@/components/ui/badge";
import { DeleteInstanceDialog } from "@/components/instances/delete-instance-dialog";
import { InstanceLogViewer } from "@/components/instances/log-viewer";
import {
  useInstance,
  useInstanceLifecycle,
  useExecuteInstanceCommand,
  useDeleteInstance,
} from "@/lib/api/queries";
import { useAuth } from "@/lib/auth/context";

export default function InstanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { hasPermission } = useAuth();
  const instance = useInstance(id);
  const lifecycle = useInstanceLifecycle();
  const executeCmd = useExecuteInstanceCommand();
  const deleteInstance = useDeleteInstance();
  const [command, setCommand] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function runLifecycle(target: "start" | "stop" | "restart") {
    try {
      await lifecycle.mutateAsync({ id, target });
      toast.success(`Lifecycle: ${target}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lifecycle action failed");
    }
  }

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;
    try {
      await executeCmd.mutateAsync({ id, command: command.trim() });
      toast.success("Command dispatched");
      setCommand("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Command failed");
    }
  }

  async function confirmDelete() {
    try {
      await deleteInstance.mutateAsync(id);
      toast.success("Instance stopped");
      setShowDeleteConfirm(false);
      router.push("/instances");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (instance.isLoading) {
    return <p className="text-zinc-500">Loading instance...</p>;
  }

  if (instance.error || !instance.data) {
    return (
      <div>
        <Link
          href="/instances"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-red-400">Instance not found</p>
      </div>
    );
  }

  const inst = instance.data;

  return (
    <PermissionGuard permission="instances.read">
      <div>
        <Link
          href="/instances"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <DashboardHeader title={`Instance ${inst.id}`} description={inst.configurationName} />
            <InstanceStateBadge state={inst.state as "CREATING" | "ONLINE" | "OFFLINE" | "STOPPED"} />
          </div>
          {hasPermission("instances.manage") && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runLifecycle("start")}
                disabled={lifecycle.isPending}
              >
                <Play className="h-4 w-4" /> Start
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runLifecycle("stop")}
                disabled={lifecycle.isPending}
              >
                <Square className="h-4 w-4" /> Stop
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runLifecycle("restart")}
                disabled={lifecycle.isPending}
              >
                <RotateCcw className="h-4 w-4" /> Restart
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteInstance.isPending}
              >
                Delete
              </Button>
            </div>
          )}
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Host", `${inst.hostAddress}:${inst.allocatedPort}`],
            ["Runtime", inst.runtime],
            ["RAM", `${inst.allocatedRamMB} MB`],
            ["CPU", `${inst.allocatedCpu} units`],
            ["Node", inst.wrapperNodeId],
            ["PID", inst.processPid?.toString() ?? "—"],
            ["Heartbeat", inst.lastHeartbeat ? new Date(inst.lastHeartbeat).toLocaleString() : "—"],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="mt-1 font-mono text-sm">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {hasPermission("instances.manage") && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Execute command</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={runCommand} className="flex gap-2">
                <Input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g. op playername"
                  className="font-mono"
                />
                <Button type="submit" disabled={executeCmd.isPending}>
                  Send
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <InstanceLogViewer instanceId={id} lines={200} />
          </CardContent>
        </Card>

        <DeleteInstanceDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          instanceId={id}
          instanceName={inst.configurationName}
          loading={deleteInstance.isPending}
          onConfirm={confirmDelete}
        />
      </div>
    </PermissionGuard>
  );
}
