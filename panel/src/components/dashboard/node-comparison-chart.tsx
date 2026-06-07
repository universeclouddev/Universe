"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import type { ClusterNode } from "@/lib/api/types";

interface NodeComparisonChartProps {
  nodes: ClusterNode[];
}

export function NodeComparisonChart({ nodes }: NodeComparisonChartProps) {
  const data = nodes.map((n) => ({
    name: n.name.length > 10 ? `${n.name.slice(0, 8)}…` : n.name,
    cpu: n.resources?.usedCpu ?? 0,
    ram: n.resources?.usedRamMB ?? 0,
    local: n.local,
  }));

  return (
    <motion.div
      className="glass-panel glow-border rounded-2xl p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
    >
      <h3 className="text-base font-semibold text-zinc-100">Node resources</h3>
      <p className="text-xs text-zinc-600">CPU units & RAM per node</p>

      <div className="mt-4 h-[200px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">No nodes</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                content={({ active, payload, label }) =>
                  active && payload ? (
                    <div className="rounded-xl border border-white/10 bg-[#141820]/95 px-3 py-2 text-xs backdrop-blur-md">
                      <p className="mb-1 font-medium text-zinc-300">{label}</p>
                      {payload.map((p) => (
                        <p key={p.name} className="font-mono text-zinc-400">
                          {p.name}: <span className="text-zinc-200">{p.value}</span>
                        </p>
                      ))}
                    </div>
                  ) : null
                }
              />
              <Bar
                dataKey="cpu"
                name="CPU"
                fill="#06b6d4"
                radius={[6, 6, 0, 0]}
                animationDuration={700}
              />
              <Bar
                dataKey="ram"
                name="RAM MB"
                fill="#38bdf8"
                radius={[6, 6, 0, 0]}
                animationDuration={700}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
