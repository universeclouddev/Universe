"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Activity, Cpu, HardDrive, Server, Wifi } from "lucide-react";
import { usePing, useInstances, useClusterNodes, useNodeInfo } from "@/lib/api/queries";
import { formatSystemLoadAverage, getMemoryUsagePercent, getValidSystemLoadAverage } from "@/lib/api/metrics";
import { cn } from "@/lib/utils";

function MetricPill({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] transition-colors duration-200",
        accent
          ? "bg-teal-400/10 text-teal-300 ring-1 ring-teal-400/10"
          : "text-slate-500 hover:text-slate-400",
      )}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-70" />
      <span className="hidden text-slate-600 sm:inline">{label}</span>
      <span className={cn("tabular-nums", accent ? "text-teal-200" : "text-slate-400")}>
        {value}
      </span>
    </span>
  );
}

export function LiveStatusStrip() {
  const reducedMotion = useReducedMotion();
  const ping = usePing();
  const instances = useInstances();
  const nodes = useClusterNodes();
  const nodeInfo = useNodeInfo();

  const connected = ping.isSuccess && ping.data?.status === "ok";
  const onlineCount =
    instances.data?.filter((i) => i.state === "ONLINE" || i.state === "CREATING").length ?? 0;
  const totalInstances = instances.data?.length ?? 0;

  const memPct = getMemoryUsagePercent(nodeInfo.data?.system);
  const load = getValidSystemLoadAverage(nodeInfo.data?.system.systemLoadAverage);
  const loadLabel = formatSystemLoadAverage(nodeInfo.data?.system.systemLoadAverage);

  return (
    <div className="live-strip flex h-[var(--live-strip-height)] shrink-0 items-center gap-3 overflow-x-auto px-6 text-[11px]">
      <span className="flex shrink-0 items-center gap-2 pr-2">
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inset-0 rounded-full",
              connected ? "bg-emerald-400 live-ping" : "bg-red-400",
            )}
          />
          <span
            className={cn(
              "relative h-2 w-2 rounded-full",
              connected ? "bg-emerald-400 pulse-dot" : "bg-red-400",
            )}
          />
        </span>
        <span
          className={cn(
            "font-semibold uppercase tracking-wider",
            connected ? "text-emerald-400" : "text-red-400",
          )}
        >
          {connected ? "Live" : "Offline"}
        </span>
      </span>

      <span className="hidden h-3 w-px shrink-0 bg-slate-500/25 sm:block" />

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        <MetricPill
          icon={Wifi}
          label="cluster"
          value={ping.data?.clusterName ?? "—"}
          accent
        />
        <MetricPill
          icon={Server}
          label="instances"
          value={`${onlineCount}/${totalInstances}`}
        />
        <MetricPill
          icon={Activity}
          label="nodes"
          value={String(nodes.data?.length ?? "—")}
        />
        {memPct !== null && (
          <MetricPill icon={HardDrive} label="mem" value={`${memPct}%`} />
        )}
        {load !== null && (
          <MetricPill icon={Cpu} label="load" value={loadLabel} />
        )}
      </div>

      <motion.span
        className="hidden shrink-0 font-mono text-[10px] text-slate-600 lg:inline"
        animate={reducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </motion.span>
    </div>
  );
}
