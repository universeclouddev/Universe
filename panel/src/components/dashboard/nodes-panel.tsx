"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ClusterNode } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function ResourceBar({
  label,
  used,
  max,
  color,
}: {
  label: string;
  used: number;
  max: number;
  color: "violet" | "sky";
}) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] text-zinc-600">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {used} / {max}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            color === "violet" ? "bg-gradient-to-r from-cyan-600 to-cyan-400" : "bg-gradient-to-r from-sky-600 to-sky-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface NodesPanelProps {
  nodes: ClusterNode[];
  loading?: boolean;
}

export function NodesPanel({ nodes, loading }: NodesPanelProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Nodes</CardTitle>
        <span className="text-xs text-zinc-600">{nodes.length} active</span>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-zinc-600">Loading nodes...</p>}
        {!loading && nodes.length === 0 && (
          <p className="text-sm text-zinc-600">No cluster nodes</p>
        )}
        {nodes.map((node) => (
          <Link
            key={node.id}
            href={`/cluster/${node.id}`}
            className="block rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 transition-colors hover:border-white/[0.08] hover:bg-white/[0.04]"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-dot" />
                <span className="text-sm font-medium text-zinc-200">{node.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {node.local && (
                  <Badge variant="accent" className="text-[9px]">
                    master
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <ResourceBar
                label="CPU"
                used={node.resources?.usedCpu ?? 0}
                max={Math.max(node.resources?.usedCpu ?? 0, 100)}
                color="violet"
              />
              <ResourceBar
                label="RAM"
                used={node.resources?.usedRamMB ?? 0}
                max={Math.max(node.resources?.usedRamMB ?? 0, 8192)}
                color="sky"
              />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
