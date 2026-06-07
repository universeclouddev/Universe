"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import type { InstanceState } from "@/lib/api/types";

const STATE_COLORS: Record<InstanceState, string> = {
  ONLINE: "#34d399",
  CREATING: "#fbbf24",
  OFFLINE: "#fb923c",
  STOPPED: "#52525b",
};

interface InstanceDistributionChartProps {
  counts: Partial<Record<InstanceState, number>>;
  total: number;
}

export function InstanceDistributionChart({ counts, total }: InstanceDistributionChartProps) {
  const data = (Object.keys(STATE_COLORS) as InstanceState[])
    .map((state) => ({
      name: state,
      value: counts[state] ?? 0,
      fill: STATE_COLORS[state],
    }))
    .filter((d) => d.value > 0);

  const empty = data.length === 0;

  return (
    <motion.div
      className="glass-panel glow-border rounded-2xl p-5"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <h3 className="text-base font-semibold text-zinc-100">Instance states</h3>
      <p className="text-xs text-zinc-600">Distribution by lifecycle</p>

      <div className="relative mt-4 h-[180px]">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">No instances</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                  stroke="transparent"
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <div className="rounded-lg border border-white/10 bg-[#141820]/95 px-2 py-1 text-xs backdrop-blur-md">
                        <span style={{ color: payload[0].payload.fill }}>{payload[0].name}</span>
                        {": "}
                        <span className="font-mono text-zinc-200">{payload[0].value}</span>
                      </div>
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className="text-3xl font-bold text-zinc-50"
                key={total}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {total}
              </motion.span>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600">total</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-3">
        {(Object.keys(STATE_COLORS) as InstanceState[]).map((state) => (
          <div key={state} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className="h-2 w-2 rounded-full" style={{ background: STATE_COLORS[state] }} />
            {state} {counts[state] ?? 0}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
