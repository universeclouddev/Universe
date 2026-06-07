"use client";

import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { countDiffRows, type CompareRow } from "./compare-diff";

interface ClusterCompareListDiffProps {
  title: string;
  clusterAName: string;
  clusterBName: string;
  rows: CompareRow[];
  showDifferencesOnly: boolean;
  emptyMessage?: string;
}

function PresenceCell({ present }: { present: boolean }) {
  return present ? (
    <span className="inline-flex items-center gap-1 text-emerald-400">
      <Check className="h-3.5 w-3.5" />
      <span className="sr-only">Present</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-zinc-600">
      <X className="h-3.5 w-3.5" />
      <span className="sr-only">Missing</span>
    </span>
  );
}

export function ClusterCompareListDiff({
  title,
  clusterAName,
  clusterBName,
  rows,
  showDifferencesOnly,
  emptyMessage = "No items to compare",
}: ClusterCompareListDiffProps) {
  const visibleRows = showDifferencesOnly ? rows.filter((row) => row.presence !== "both") : rows;
  const diffCount = countDiffRows(rows);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant={diffCount > 0 ? "warning" : "success"} className="font-mono text-[10px]">
          {diffCount === 0 ? "In sync" : `${diffCount} diff${diffCount === 1 ? "" : "s"}`}
        </Badge>
      </CardHeader>
      <CardContent>
        {visibleRows.length === 0 ? (
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center text-sm text-zinc-500">
            {showDifferencesOnly && rows.length > 0
              ? "No differences — lists match"
              : emptyMessage}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">{clusterAName}</th>
                  <th className="px-4 py-3 font-medium">{clusterBName}</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const inA = row.presence === "both" || row.presence === "only-a";
                  const inB = row.presence === "both" || row.presence === "only-b";

                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        "border-b border-white/[0.04] last:border-0",
                        row.presence !== "both" && "bg-amber-500/[0.04]",
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-200">{row.label}</td>
                      <td className="px-4 py-2.5">
                        <PresenceCell present={inA} />
                      </td>
                      <td className="px-4 py-2.5">
                        <PresenceCell present={inB} />
                      </td>
                      <td className="px-4 py-2.5">
                        {row.presence === "both" && (
                          <Badge variant="success" className="text-[10px]">
                            Both
                          </Badge>
                        )}
                        {row.presence === "only-a" && (
                          <Badge variant="warning" className="text-[10px]">
                            A only
                          </Badge>
                        )}
                        {row.presence === "only-b" && (
                          <Badge variant="accent" className="text-[10px]">
                            B only
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
          {rows.length} item{rows.length === 1 ? "" : "s"} total
          {showDifferencesOnly ? " · showing differences only" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
