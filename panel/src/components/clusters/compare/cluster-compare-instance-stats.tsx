"use client";

import { Minus, Plus, Equal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InstanceCountSnapshot } from "./compare-diff";

interface ClusterCompareInstanceStatsProps {
  clusterAName: string;
  clusterBName: string;
  statsA: InstanceCountSnapshot;
  statsB: InstanceCountSnapshot;
}

interface StatRow {
  label: string;
  valueA: number;
  valueB: number;
}

function diffIcon(delta: number) {
  if (delta > 0) return <Plus className="h-3.5 w-3.5 text-emerald-400" />;
  if (delta < 0) return <Minus className="h-3.5 w-3.5 text-amber-400" />;
  return <Equal className="h-3.5 w-3.5 text-zinc-500" />;
}

export function ClusterCompareInstanceStats({
  clusterAName,
  clusterBName,
  statsA,
  statsB,
}: ClusterCompareInstanceStatsProps) {
  const rows: StatRow[] = [
    { label: "Total", valueA: statsA.total, valueB: statsB.total },
    { label: "Online", valueA: statsA.online, valueB: statsB.online },
    { label: "Creating", valueA: statsA.creating, valueB: statsB.creating },
    { label: "Stopped", valueA: statsA.stopped, valueB: statsB.stopped },
    { label: "Offline", valueA: statsA.offline, valueB: statsB.offline },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Instance counts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3 font-medium">Metric</th>
                <th className="px-4 py-3 font-medium">{clusterAName}</th>
                <th className="px-4 py-3 font-medium">{clusterBName}</th>
                <th className="px-4 py-3 font-medium">Delta (B − A)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const delta = row.valueB - row.valueA;
                return (
                  <tr
                    key={row.label}
                    className={cn(
                      "border-b border-white/[0.04] last:border-0",
                      delta !== 0 && "bg-white/[0.015]",
                    )}
                  >
                    <td className="px-4 py-3 text-zinc-400">{row.label}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-zinc-200">{row.valueA}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-zinc-200">{row.valueB}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                        {diffIcon(delta)}
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
