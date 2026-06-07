"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GitBranch, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/sidebar";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { InstancesTable } from "@/components/dashboard/instances-table";
import { InstancesSummary } from "@/components/instances/instances-summary";
import { DeleteInstanceDialog } from "@/components/instances/delete-instance-dialog";
import {
  useInstances,
  useConfigurations,
  useCreateInstance,
  useDeleteInstance,
} from "@/lib/api/queries";

type DeleteTarget = { id: string; name?: string };

export default function InstancesPage() {
  const searchParams = useSearchParams();
  const instances = useInstances();
  const configurations = useConfigurations();
  const createInstance = useCreateInstance();
  const deleteInstance = useDeleteInstance();
  const [showCreate, setShowCreate] = useState(false);
  const [configName, setConfigName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setShowCreate(true);
    }
  }, [searchParams]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await createInstance.mutateAsync(configName);
      toast.success(`Instance ${created.id} created`);
      setShowCreate(false);
      setConfigName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create instance");
    }
  }

  function requestDelete(id: string, name?: string) {
    setDeleteTarget({ id, name });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteInstance.mutateAsync(deleteTarget.id);
      toast.success(`Instance ${deleteTarget.id} stopped`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete instance");
    }
  }

  return (
    <PermissionGuard permission="instances.read">
      <div>
        <PageHeader
          title="Instances"
          description="Manage deployed instances across the cluster"
          actions={
            <>
              <Link
                href="/instances/lifecycle"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <GitBranch className="h-4 w-4" /> Lifecycle
              </Link>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" /> Create
              </Button>
            </>
          }
        />

        <InstancesSummary instances={instances.data ?? []} />

        {showCreate && (
          <Card className="mb-6">
            <CardContent className="pt-5">
              <form onSubmit={handleCreate} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-0 flex-1 space-y-2 sm:min-w-[200px]">
                  <Label>Configuration</Label>
                  <Select
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    required
                    className="min-h-11 w-full"
                  >
                    <option value="">Select configuration...</option>
                    {configurations.data?.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" disabled={createInstance.isPending} className="w-full sm:w-auto">
                    Deploy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <InstancesTable
          instances={instances.data ?? []}
          loading={instances.isLoading}
          showDensityToggle
          onDelete={requestDelete}
        />

        <DeleteInstanceDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          instanceId={deleteTarget?.id ?? ""}
          instanceName={deleteTarget?.name}
          loading={deleteInstance.isPending}
          onConfirm={confirmDelete}
        />
      </div>
    </PermissionGuard>
  );
}
