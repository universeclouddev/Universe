"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  useMetricsRingBuffer,
  type MetricsHistoryPoint,
  type MetricsSnapshot,
} from "@/hooks/use-metric-history";
import type { ClusterNode, NodeInfo } from "@/lib/api/types";
import { getMemoryUsagePercent } from "@/lib/api/metrics";

interface MetricsChartsProps {
  nodeInfo?: NodeInfo;
  instanceTotal: number;
  instanceOnline: number;
  nodes?: ClusterNode[];
  canViewInstances?: boolean;
  canViewCluster?: boolean;
  className?: string;
}

function buildSnapshot(
  nodeInfo: NodeInfo | undefined,
  instanceTotal: number,
  instanceOnline: number,
  nodes: ClusterNode[] | undefined,
  canViewInstances: boolean,
  canViewCluster: boolean,
): MetricsSnapshot | null {
  const jvmPct = getMemoryUsagePercent(nodeInfo?.system) ?? 0;
  const jvmUsedMB = nodeInfo
    ? Math.round((nodeInfo.system.totalMemory - nodeInfo.system.freeMemory) / 1_048_576)
    : 0;

  const hasJvm = !!nodeInfo?.system;
  const hasInstances = canViewInstances;
  const hasNodes = canViewCluster && !!nodes;

  if (!hasJvm && !hasInstances && !hasNodes) return null;

  const clusterRamMB = hasNodes
    ? nodes!.reduce((sum, node) => sum + (node.resources?.usedRamMB ?? 0), 0)
    : null;
  const clusterCpu = hasNodes
    ? nodes!.reduce((sum, node) => sum + (node.resources?.usedCpu ?? 0), 0)
    : null;

  return {
    jvmMemoryPercent: jvmPct,
    jvmMemoryUsedMB: jvmUsedMB,
    instanceTotal: hasInstances ? instanceTotal : 0,
    instanceOnline: hasInstances ? instanceOnline : 0,
    nodeCount: hasNodes ? nodes!.length : null,
    clusterRamMB,
    clusterCpu,
  };
}

function ChartTooltip({
  active,
  payload,
  label,
  valueSuffix = "",
  formatValue,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  valueSuffix?: string;
  formatValue?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#141820]/95 px-3 py-2 shadow-xl backdrop-blur-md">
      {label && <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-500">{p.name}</span>
          <span className="ml-auto font-mono font-semibold text-zinc-200">
            {formatValue ? formatValue(p.value) : `${p.value}${valueSuffix}`}
          </span>
        </p>
      ))}
    </div>
  );
}

function CollectingPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-zinc-600">
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {label}
      </motion.span>
    </div>
  );
}

function MetricChartCard({
  title,
  description,
  legend,
  children,
  delay = 0,
}: {
  title: string;
  description: string;
  legend?: ReactNode;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      className="glass-panel glow-border rounded-2xl p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
          <p className="text-xs text-zinc-600">{description}</p>
        </div>
        {legend}
      </div>
      <div className="h-[200px] w-full">{children}</div>
    </motion.div>
  );
}

function JvmMemoryChart({ history }: { history: MetricsHistoryPoint[] }) {
  const latest = history.at(-1);

  return (
    <MetricChartCard
      title="JVM memory"
      description="Heap usage sampled every 30s"
      delay={0.1}
      legend={
        latest ? (
          <div className="text-right text-xs text-zinc-500">
            <span className="font-mono text-violet-300">{latest.jvmMemoryPercent.toFixed(0)}%</span>
            <span className="mx-1 text-zinc-700">·</span>
            <span className="font-mono">{latest.jvmMemoryUsedMB} MB</span>
          </div>
        ) : null
      }
    >
      {history.length < 2 ? (
        <CollectingPlaceholder label="Collecting JVM samples…" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="jvmMemFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fill: "#52525b", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#52525b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={
                <ChartTooltip
                  valueSuffix="%"
                  formatValue={(v) => `${v.toFixed(1)}%`}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="jvmMemoryPercent"
              name="Heap"
              stroke="#a78bfa"
              strokeWidth={2}
              fill="url(#jvmMemFill)"
              animationDuration={400}
              dot={false}
              activeDot={{ r: 4, fill: "#a78bfa", stroke: "#0f1117", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </MetricChartCard>
  );
}

function InstanceCountChart({ history }: { history: MetricsHistoryPoint[] }) {
  const latest = history.at(-1);

  return (
    <MetricChartCard
      title="Instances"
      description="Total & online count over time"
      delay={0.15}
      legend={
        latest ? (
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
              {latest.instanceOnline} online
            </span>
            <span className="font-mono text-zinc-400">{latest.instanceTotal} total</span>
          </div>
        ) : null
      }
    >
      {history.length < 2 ? (
        <CollectingPlaceholder label="Collecting instance samples…" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fill: "#52525b", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#52525b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip formatValue={(v) => String(Math.round(v))} />} />
            <Line
              type="monotone"
              dataKey="instanceTotal"
              name="Total"
              stroke="#818cf8"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#818cf8", stroke: "#0f1117", strokeWidth: 2 }}
              animationDuration={400}
            />
            <Line
              type="monotone"
              dataKey="instanceOnline"
              name="Online"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#34d399", stroke: "#0f1117", strokeWidth: 2 }}
              animationDuration={400}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </MetricChartCard>
  );
}

function NodeMetricsChart({ history }: { history: MetricsHistoryPoint[] }) {
  const latest = history.at(-1);
  const nodeHistory = history.filter((p) => p.nodeCount != null);

  return (
    <MetricChartCard
      title="Cluster nodes"
      description="Node count & allocated resources"
      delay={0.2}
      legend={
        latest?.nodeCount != null ? (
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="font-mono text-cyan-300">{latest.nodeCount} nodes</span>
            <span className="font-mono">{latest.clusterRamMB ?? 0} MB RAM</span>
          </div>
        ) : null
      }
    >
      {nodeHistory.length < 2 ? (
        <CollectingPlaceholder label="Collecting node samples…" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={nodeHistory} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fill: "#52525b", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              yAxisId="count"
              allowDecimals={false}
              tick={{ fill: "#52525b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="resources"
              orientation="right"
              tick={{ fill: "#52525b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip formatValue={(v) => String(Math.round(v))} />} />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="nodeCount"
              name="Nodes"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#22d3ee", stroke: "#0f1117", strokeWidth: 2 }}
              animationDuration={400}
            />
            <Line
              yAxisId="resources"
              type="monotone"
              dataKey="clusterRamMB"
              name="RAM MB"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#38bdf8", stroke: "#0f1117", strokeWidth: 2 }}
              animationDuration={400}
            />
            <Line
              yAxisId="resources"
              type="monotone"
              dataKey="clusterCpu"
              name="CPU units"
              stroke="#fbbf24"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#fbbf24", stroke: "#0f1117", strokeWidth: 2 }}
              animationDuration={400}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </MetricChartCard>
  );
}

export function MetricsCharts({
  nodeInfo,
  instanceTotal,
  instanceOnline,
  nodes,
  canViewInstances = true,
  canViewCluster = false,
  className,
}: MetricsChartsProps) {
  const snapshot = buildSnapshot(
    nodeInfo,
    instanceTotal,
    instanceOnline,
    nodes,
    canViewInstances,
    canViewCluster,
  );
  const history = useMetricsRingBuffer(snapshot, snapshot !== null);

  const showJvm = !!nodeInfo?.system;
  const showInstances = canViewInstances;
  const showNodes = canViewCluster;

  if (!showJvm && !showInstances && !showNodes) return null;

  const chartCount = [showJvm, showInstances, showNodes].filter(Boolean).length;

  return (
    <motion.section
      className={cn("mt-6", className)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08 }}
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Live metrics</h2>
          <p className="text-xs text-zinc-600">
            Time-series from ping, node, and instance queries · 30s sampling · up to 30 min history
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] text-zinc-500">
          {history.length} samples
        </span>
      </div>

      <div
        className={cn(
          "grid gap-4",
          chartCount >= 3 ? "lg:grid-cols-3" : chartCount === 2 ? "md:grid-cols-2" : "grid-cols-1",
        )}
      >
        {showJvm && <JvmMemoryChart history={history} />}
        {showInstances && <InstanceCountChart history={history} />}
        {showNodes && <NodeMetricsChart history={history} />}
      </div>
    </motion.section>
  );
}
