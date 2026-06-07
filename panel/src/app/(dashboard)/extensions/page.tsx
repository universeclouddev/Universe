"use client";

import { motion } from "framer-motion";
import { Puzzle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/sidebar";
import { PermissionGuard } from "@/components/layout/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useExtensions } from "@/lib/api/queries";
import type { ExtensionStatus } from "@/lib/api/types";

function extensionStatusVariant(status: ExtensionStatus) {
  switch (status) {
    case "LOADED":
      return "success" as const;
    case "SKIPPED":
      return "muted" as const;
    case "INSTALLED":
      return "warning" as const;
    default:
      return "default" as const;
  }
}

function ExtensionStatusBadge({ status }: { status: ExtensionStatus }) {
  const variant = extensionStatusVariant(status);
  return (
    <Badge variant={variant}>
      <span
        className={cnDot(variant)}
      />
      {status}
    </Badge>
  );
}

function cnDot(variant: "success" | "warning" | "muted" | "default") {
  const base = "h-1.5 w-1.5 rounded-full";
  switch (variant) {
    case "success":
      return `${base} bg-emerald-400 pulse-dot`;
    case "warning":
      return `${base} bg-amber-400`;
    case "muted":
      return `${base} bg-zinc-500`;
    default:
      return `${base} bg-zinc-400`;
  }
}

export default function ExtensionsPage() {
  const extensions = useExtensions();
  const loadedCount = extensions.data?.filter((e) => e.status === "LOADED").length ?? 0;

  return (
    <PermissionGuard permission="settings.view">
      <PageHeader
        title="Extensions"
        description="Installed Universe extensions — runtimes, storage backends, and integrations"
        meta={
          extensions.data ? (
            <Badge variant="accent" className="font-mono text-[10px]">
              {loadedCount}/{extensions.data.length} loaded
            </Badge>
          ) : null
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => extensions.refetch()}
            disabled={extensions.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${extensions.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {extensions.isLoading && (
        <p className="text-sm text-zinc-600">Loading extensions...</p>
      )}

      {extensions.isError && (
        <Card className="glow-border mb-6 border-red-500/20">
          <CardContent className="py-6 text-center text-sm text-red-400">
            {extensions.error instanceof Error
              ? extensions.error.message
              : "Failed to load extensions"}
          </CardContent>
        </Card>
      )}

      {extensions.data && extensions.data.length > 0 && (
        <Card className="glow-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04] text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Version</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="hidden px-5 py-3 sm:table-cell">Flags</th>
                </tr>
              </thead>
              <tbody>
                {extensions.data.map((ext, i) => (
                  <motion.tr
                    key={ext.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                          <Puzzle className="h-4 w-4" />
                        </div>
                        <span className="font-mono font-medium text-zinc-200">{ext.id}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-zinc-400">{ext.version}</td>
                    <td className="px-5 py-4">
                      <ExtensionStatusBadge status={ext.status} />
                    </td>
                    <td className="hidden px-5 py-4 sm:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {ext.masterOnly && (
                          <Badge variant="muted" className="normal-case">
                            master-only
                          </Badge>
                        )}
                        {!ext.reloadable && (
                          <Badge variant="muted" className="normal-case">
                            no-reload
                          </Badge>
                        )}
                        {ext.masterOnly || !ext.reloadable ? null : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {extensions.data?.length === 0 && !extensions.isLoading && (
        <Card className="glow-border">
          <CardContent className="py-12 text-center">
            <Puzzle className="mx-auto mb-3 h-10 w-10 text-zinc-700" />
            <p className="text-zinc-400">No extensions installed</p>
            <p className="mt-1 text-sm text-zinc-600">
              Drop extension JARs into the <span className="font-mono">./extensions</span>{" "}
              directory and restart Universe to load them
            </p>
          </CardContent>
        </Card>
      )}
    </PermissionGuard>
  );
}
