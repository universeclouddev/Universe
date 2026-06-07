"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMetrics } from "@/lib/api/queries";

interface ParsedMetric {
  name: string;
  value: string;
  labels: string;
  numeric: number;
}

function parsePrometheus(text: string): ParsedMetric[] {
  const lines = text.split("\n");
  const metrics: ParsedMetric[] = [];

  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const spaceIdx = line.lastIndexOf(" ");
    if (spaceIdx === -1) continue;
    const namePart = line.slice(0, spaceIdx);
    const value = line.slice(spaceIdx + 1);
    const labelMatch = namePart.match(/^([^{]+)(\{.*\})?$/);
    if (!labelMatch) continue;
    const numeric = parseFloat(value);
    if (Number.isNaN(numeric)) continue;
    metrics.push({
      name: labelMatch[1],
      labels: labelMatch[2] ?? "",
      value,
      numeric,
    });
  }
  return metrics;
}

export default function MetricsPage() {
  const metrics = useMetrics();
  const parsed = useMemo(() => (metrics.data ? parsePrometheus(metrics.data) : []), [metrics.data]);

  const topMetrics = useMemo(() => {
    const byName = new Map<string, number>();
    for (const m of parsed) {
      if (!m.name.includes("_bucket") && !m.name.includes("_sum")) {
        byName.set(m.name, Math.max(byName.get(m.name) ?? 0, m.numeric));
      }
    }
    return Array.from(byName.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, value]) => ({
        name: name.length > 22 ? `${name.slice(0, 20)}…` : name,
        fullName: name,
        value,
      }));
  }, [parsed]);

  return (
    <div>
      <PageHeader
        title="Metrics"
        description="Prometheus exposition from /api/metrics"
        actions={
          <Button variant="outline" size="sm" onClick={() => metrics.refetch()} disabled={metrics.isFetching}>
            <RefreshCw className={`h-4 w-4 ${metrics.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <motion.div
        className="mb-6 glass-panel glow-border rounded-2xl p-5"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-base font-semibold text-zinc-100">Top metrics</h3>
        <p className="text-xs text-zinc-600">{parsed.length} series parsed</p>
        <div className="mt-4 h-[280px]">
          {topMetrics.length === 0 ? (
            <div className="flex h-full items-center justify-center text-zinc-600">
              {metrics.isLoading ? "Loading..." : "No numeric metrics"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMetrics} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <div className="rounded-xl border border-white/10 bg-[#141820]/95 px-3 py-2 text-xs backdrop-blur-md">
                        <p className="font-mono text-zinc-400">{payload[0].payload.fullName}</p>
                        <p className="font-mono text-lg text-violet-300">{payload[0].value}</p>
                      </div>
                    ) : null
                  }
                />
                <Bar
                  dataKey="value"
                  fill="url(#metricGrad)"
                  radius={[0, 6, 6, 0]}
                  animationDuration={800}
                />
                <defs>
                  <linearGradient id="metricGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glow-border">
          <CardHeader>
            <CardTitle>Parsed metrics</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04] text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Labels</th>
                  <th className="px-4 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((m, i) => (
                  <motion.tr
                    key={`${m.name}-${i}`}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.5) }}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{m.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-600">{m.labels}</td>
                    <td className="px-4 py-2 font-mono">{m.value}</td>
                  </motion.tr>
                ))}
                {parsed.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-600">
                      {metrics.isLoading ? "Loading..." : "No metrics available"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="glow-border">
          <CardHeader>
            <CardTitle>Raw output</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[500px] overflow-auto rounded-xl border border-white/[0.06] bg-[#0a0c10] p-4 font-mono text-xs text-zinc-500">
              {metrics.data ?? (metrics.isLoading ? "Loading..." : "No data")}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
