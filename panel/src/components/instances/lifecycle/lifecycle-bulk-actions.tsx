"use client";

import { useState } from "react";
import { RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { useInstanceLifecycle } from "@/lib/api/queries";
import { isRunningInstance, type LifecycleGroup } from "./lifecycle-utils";

type BulkAction = "stop" | "restart";

interface LifecycleBulkActionsProps {
  group: LifecycleGroup;
  disabled?: boolean;
}

export function LifecycleBulkActions({ group, disabled }: LifecycleBulkActionsProps) {
  const lifecycle = useInstanceLifecycle();
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const runningInstances = group.instances.filter(isRunningInstance);
  const hasRunning = runningInstances.length > 0;

  async function executeBulk(action: BulkAction) {
    const targets = runningInstances.filter((i) => i.id);
    if (targets.length === 0) {
      toast.info(`No running instances in ${group.configurationName}`);
      setPendingAction(null);
      return;
    }

    const results = await Promise.allSettled(
      targets.map((instance) =>
        lifecycle.mutateAsync({ id: instance.id!, target: action }),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.length - failed;

    if (failed === 0) {
      toast.success(
        `${action === "stop" ? "Stopped" : "Restarted"} ${succeeded} instance${succeeded === 1 ? "" : "s"} in ${group.configurationName}`,
      );
    } else if (succeeded > 0) {
      toast.warning(
        `${action} completed for ${succeeded}/${results.length} instances in ${group.configurationName}`,
      );
    } else {
      toast.error(`Failed to ${action} instances in ${group.configurationName}`);
    }

    setPendingAction(null);
  }

  const actionLabel = pendingAction === "stop" ? "Stop all" : "Restart all";
  const actionVerb = pendingAction === "stop" ? "stop" : "restart";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || !hasRunning || lifecycle.isPending}
          onClick={() => setPendingAction("stop")}
        >
          <Square className="h-3.5 w-3.5" />
          Stop all
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || !hasRunning || lifecycle.isPending}
          onClick={() => setPendingAction("restart")}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restart all
        </Button>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={`${actionLabel} in ${group.configurationName}?`}
        description={
          <>
            This will {actionVerb}{" "}
            <span className="font-medium text-zinc-300">{runningInstances.length}</span> running
            instance{runningInstances.length === 1 ? "" : "s"} in this configuration group.
          </>
        }
        confirmLabel={actionLabel}
        cancelLabel="Cancel"
        variant={pendingAction === "stop" ? "destructive" : "default"}
        loading={lifecycle.isPending}
        onConfirm={() => {
          if (pendingAction) void executeBulk(pendingAction);
        }}
        icon={
          pendingAction === "stop" ? (
            <Square className="h-5 w-5 text-red-400" />
          ) : (
            <RotateCcw className="h-5 w-5 text-teal-400" />
          )
        }
      />
    </>
  );
}
