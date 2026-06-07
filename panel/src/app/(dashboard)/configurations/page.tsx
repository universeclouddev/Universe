"use client";

import Link from "next/link";
import { Plus, Trash2, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/layout/sidebar";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfigurationClusterImportDialog } from "@/components/configurations/configuration-cluster-import-dialog";
import { useAuth } from "@/lib/auth/context";
import { useConfigurations, useDeleteConfiguration } from "@/lib/api/queries";

export default function ConfigurationsPage() {
  const configs = useConfigurations();
  const deleteConfig = useDeleteConfiguration();
  const { hasPermission, clusters } = useAuth();
  const [showClusterImport, setShowClusterImport] = useState(false);
  const canImportFromCluster = hasPermission("configurations.manage") && clusters.length > 1;

  async function handleDelete(name: string) {
    if (!confirm(`Delete configuration "${name}"?`)) return;
    try {
      await deleteConfig.mutateAsync(name);
      toast.success(`Configuration "${name}" deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <PermissionGuard permission="configurations.read">
      <div>
        <div className="mb-6 flex items-center justify-between">
          <DashboardHeader title="Configurations" description="Instance deployment configurations" />
          <div className="flex gap-2">
            {canImportFromCluster && (
              <Button variant="outline" onClick={() => setShowClusterImport(true)}>
                <Download className="h-4 w-4" /> From cluster
              </Button>
            )}
            <Link href="/configurations/new">
              <Button>
                <Plus className="h-4 w-4" /> New
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Runtime</th>
                  <th className="px-4 py-3">RAM</th>
                  <th className="px-4 py-3">Static</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {configs.data?.map((config) => (
                  <tr key={config.name ?? "unknown"} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="px-4 py-3">
                      <Link href={`/configurations/${config.name}`} className="text-sky-400 hover:underline">
                        {config.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{config.runtime}</td>
                    <td className="px-4 py-3">{config.ramMB} MB</td>
                    <td className="px-4 py-3">{config.static ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" onClick={() => config.name && handleDelete(config.name)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <ConfigurationClusterImportDialog
        open={showClusterImport}
        onClose={() => setShowClusterImport(false)}
      />
    </PermissionGuard>
  );
}
