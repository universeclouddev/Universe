"use client";

import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/alert-dialog";

interface DeleteInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceName?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function DeleteInstanceDialog({
  open,
  onOpenChange,
  instanceId,
  instanceName,
  loading = false,
  onConfirm,
}: DeleteInstanceDialogProps) {
  const displayName = instanceName ?? instanceId;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Stop and delete instance?"
      description={
        <>
          This will stop the running process and remove instance{" "}
          <span className="font-medium text-zinc-300">{displayName}</span>
          {instanceName && instanceName !== instanceId && (
            <>
              {" "}
              <span className="font-mono text-xs text-zinc-600">({instanceId})</span>
            </>
          )}
          . This action cannot be undone.
        </>
      }
      confirmLabel="Delete"
      cancelLabel="Cancel"
      variant="destructive"
      loading={loading}
      onConfirm={onConfirm}
      icon={<Trash2 className="h-5 w-5 text-red-400" />}
    />
  );
}
