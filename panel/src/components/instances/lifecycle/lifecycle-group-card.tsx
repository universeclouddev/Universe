"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, InstanceStateBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { LifecycleBulkActions } from "./lifecycle-bulk-actions";
import { lifecycleHealthVariant, type LifecycleGroup } from "./lifecycle-utils";

interface LifecycleGroupCardProps {
  group: LifecycleGroup;
}

const healthBadgeVariant = {
  success: "success",
  warning: "warning",
  danger: "danger",
} as const;

export function LifecycleGroupCard({ group }: LifecycleGroupCardProps) {
  const { hasPermission } = useAuth();
  const [expanded, setExpanded] = useState(group.drift !== 0);
  const health = lifecycleHealthVariant(group);
  const fillPercent =
    group.desired > 0 ? Math.min(100, Math.round((group.running / group.desired) * 100)) : 0;

  return (
    <Card
      className={cn(
        "transition-colors",
        health === "danger" && "ring-1 ring-red-500/20",
        health === "warning" && "ring-1 ring-amber-500/15",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="truncate text-base">{group.configurationName}</CardTitle>
              <Badge variant={healthBadgeVariant[health]}>
                {group.running}/{group.desired} running
              </Badge>
              {group.drift !== 0 && (
                <Badge variant={group.drift < 0 ? "warning" : "accent"}>
                  {group.drift > 0 ? `+${group.drift}` : group.drift} drift
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {group.total} total · {group.stopped} stopped · {group.offline} offline
              {group.configuration?.runtime && ` · ${group.configuration.runtime} runtime`}
            </p>
          </div>
          {hasPermission("instances.manage") && (
            <LifecycleBulkActions group={group} />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-500">
            <span>Desired minimum</span>
            <span className="tabular-nums text-zinc-400">
              {group.running} running / {group.desired} desired
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800/80">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                health === "success" && "bg-emerald-500",
                health === "warning" && "bg-amber-500",
                health === "danger" && "bg-red-500",
              )}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>

        {group.instances.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {group.instances.length} instance{group.instances.length === 1 ? "" : "s"}
            </button>

            {expanded && (
              <ul className="mt-2 space-y-1.5">
                {group.instances.map((instance) => (
                  <li
                    key={instance.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-xs text-zinc-300">{instance.id}</span>
                      {instance.state && (
                        <InstanceStateBadge state={instance.state} />
                      )}
                      {instance.hostAddress && instance.allocatedPort != null && (
                        <span className="truncate text-xs text-zinc-600">
                          {instance.hostAddress}:{instance.allocatedPort}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/instances/${instance.id}`}
                      className="inline-flex items-center gap-1 text-xs text-teal-400/80 hover:text-teal-300"
                    >
                      Details <ExternalLink className="h-3 w-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {group.instances.length === 0 && (
          <p className="text-xs text-zinc-600">No instances deployed for this configuration.</p>
        )}
      </CardContent>
    </Card>
  );
}
