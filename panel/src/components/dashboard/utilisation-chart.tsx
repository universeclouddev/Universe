"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMetricHistory } from "@/hooks/use-metric-history";

interface UtilisationChartProps {
  cpuPercent: number;
  memoryPercent: number;
  className?: string;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#141820]/95 px-3 py-2 shadow-xl backdrop-blur-md">
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-500">{p.name}</span>
          <span className="ml-auto font-mono font-semibold text-zinc-200">{p.value.toFixed(1)}%</span>
        </p>
      ))}
    </div>
  );
}

export function UtilisationChart({ cpuPercent, memoryPercent, className }: UtilisationChartProps) {
  const history = useMetricHistory(cpuPercent, memoryPercent, 36);

  return (
    <motion.div
      className={cn("glass-panel glow-border rounded-2xl p-5", className)}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.15 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">Cluster utilisation</h3>
          <p className="text-xs text-zinc-600">Live CPU & memory sampling</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            CPU {cpuPercent.toFixed(0)}%
          </span>
          <span className="flex items-center gap-1.5 text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Mem {memoryPercent.toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="h-[220px] w-full">
        {history.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Collecting live samples...
            </motion.span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="memFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis domain={[0, 100]} tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="memory"
                name="Memory"
                stroke="#38bdf8"
                strokeWidth={2}
                fill="url(#memFill)"
                animationDuration={400}
                dot={false}
                activeDot={{ r: 4, fill: "#38bdf8", stroke: "#0f1117", strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="cpu"
                name="CPU"
                stroke="#22d3ee"
                strokeWidth={2.5}
                fill="url(#cpuFill)"
                animationDuration={400}
                dot={false}
                activeDot={{ r: 5, fill: "#06b6d4", stroke: "#0a0d14", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
