"use client";

import { Minus, Plus, Equal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { compareInstanceCounts, type InstanceCountSnapshot } from "./compare-diff";

interface ClusterCompareConfigCountsProps {
  clusterAName: string;
  clusterBName: string;
  statsA: InstanceCountSnapshot;
  statsB: InstanceCountSnapshot;
  showDifferencesOnly: boolean;
}

export function ClusterCompareConfigCounts({
  clusterAName,
  clusterBName,
  statsA,
  statsB,
  showDifferencesOnly,
}: ClusterCompareConfigCountsProps) {
  const rows = compareInstanceCounts(statsA, statsB).map((row) => ({
    ...row,
    countA: statsA.byConfiguration[row.key] ?? 0,
    countB: statsB.byConfiguration[row.key] ?? 0,
  }));

  const visibleRows = showDifferencesOnly
    ? rows.filter((row) => row.countA !== row.countB || row.presence !== "both")
    : rows;
  const diffCount = rows.filter((row) => row.countA !== row.countB || row.presence !== "both").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Instances by configuration</CardTitle>
        <Badge variant={diffCount > 0 ? "warning" : "success"} className="font-mono text-[10px]">
          {diffCount === 0 ? "In sync" : `${diffCount} diff${diffCount === 1 ? "" : "s"}`}
        </Badge>
      </CardHeader>
      <CardContent>
        {visibleRows.length === 0 ? (
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center text-sm text-zinc-500">
            {showDifferencesOnly && rows.length > 0
              ? "No differences — counts match"
              : "No configuration-backed instances"}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 font-medium">Configuration</th>
                  <th className="px-4 py-3 font-medium">{clusterAName}</th>
                  <th className="px-4 py-3 font-medium">{clusterBName}</th>
                  <th className="px-4 py-3 font-medium">Delta (B − A)</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const delta = row.countB - row.countA;
                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        "border-b border-white/[0.04] last:border-0",
                        (delta !== 0 || row.presence !== "both") && "bg-amber-500/[0.04]",
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-200">{row.label}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-200">
                        {row.presence === "only-b" ? "—" : row.countA}
                      </td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-200">
                        {row.presence === "only-a" ? "—" : row.countB}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.presence === "both" ? (
                          <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                            {delta > 0 ? (
                              <Plus className="h-3.5 w-3.5 text-emerald-400" />
                            ) : delta < 0 ? (
                              <Minus className="h-3.5 w-3.5 text-amber-400" />
                            ) : (
                              <Equal className="h-3.5 w-3.5 text-zinc-500" />
                            )}
                            <span
                              className={cn(
                                delta > 0 && "text-emerald-300",
                                delta < 0 && "text-amber-300",
                                delta === 0 && "text-zinc-500",
                              )}
                            >
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          </span>
                        ) : (
                          <Badge variant="warning" className="text-[10px]">
                            {row.presence === "only-a" ? "A only" : "B only"}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          {rows.length} configuration{rows.length === 1 ? "" : "s"}
          {showDifferencesOnly ? " · showing differences only" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
