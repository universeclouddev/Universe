"use client";



import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import type { NodeInfo, PingResponse } from "@/lib/api/types";
import { getMemoryUsagePercent } from "@/lib/api/metrics";
import { memoryLevel, type ClusterHealthSettings } from "@/lib/panel/cluster-health";
import { cn } from "@/lib/utils";



interface SystemStatusProps {

  ping?: PingResponse;

  nodeInfo?: NodeInfo;

  healthSettings?: ClusterHealthSettings;

}



function StatusRow({

  label,

  value,

  ok,

}: {

  label: string;

  value: string;

  ok?: boolean;

}) {

  return (

    <div className="flex items-center justify-between py-2.5">

      <span className="text-xs font-medium uppercase tracking-wider text-slate-600">{label}</span>

      <div className="flex items-center gap-2">

        <span className="font-mono text-sm text-slate-300">{value}</span>

        {ok !== undefined && (

          <span

            className={cn(

              "h-1.5 w-1.5 rounded-full",

              ok ? "bg-emerald-400 pulse-dot" : "bg-red-400",

            )}

          />

        )}

      </div>

    </div>

  );

}



export function SystemStatus({ ping, nodeInfo, healthSettings }: SystemStatusProps) {
  const memUsedPct = getMemoryUsagePercent(nodeInfo?.system);
  const memOk =
    memUsedPct === null
      ? undefined
      : healthSettings?.healthCheckEnabled
        ? memoryLevel(memUsedPct, healthSettings) === "ok"
        : memUsedPct < 90;



  return (

    <Card className="h-full glow-border-cyan">

      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-cyan-500/[0.06] pb-3">

        <CardTitle className="font-mono text-sm uppercase tracking-wider text-cyan-400/90">

          System status

        </CardTitle>

        <Badge variant={ping?.status === "ok" ? "success" : "warning"} className="font-mono text-[10px] normal-case">

          {ping?.status ?? "unknown"}

        </Badge>

      </CardHeader>

      <CardContent className="divide-y divide-cyan-500/[0.06] pt-1">

        <StatusRow

          label="REST API"

          value={nodeInfo ? `:${nodeInfo.apiPort}` : ":7000"}

          ok={ping?.status === "ok"}

        />

        <StatusRow label="Hazelcast" value={ping?.clusterName ?? "—"} ok={!!ping?.clusterName} />

        <StatusRow

          label="Node role"

          value={ping?.master ? "Master + Wrapper" : "Wrapper"}

          ok

        />

        <StatusRow

          label="JVM memory"

          value={memUsedPct !== null ? `${memUsedPct}% used` : "—"}
          ok={memOk}

        />

        <StatusRow

          label="Processors"

          value={nodeInfo ? String(nodeInfo.system.availableProcessors) : "—"}

        />

      </CardContent>

    </Card>

  );

}


