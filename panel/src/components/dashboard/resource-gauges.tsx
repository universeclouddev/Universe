"use client";

import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ResourceGaugeProps {
  label: string;
  value: number;
  color: string;
  glowClass: string;
  unit?: string;
}

function Gauge({ label, value, color, glowClass, unit = "%" }: ResourceGaugeProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const data = [{ name: label, value: clamped, fill: color }];

  return (
    <div className={cn("relative flex flex-col items-center", glowClass)}>
      <div className="h-[120px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={8}
            data={data}
            startAngle={220}
            endAngle={-40}
          >
            <RadialBar
              background={{ fill: "rgba(255,255,255,0.06)" }}
              dataKey="value"
              cornerRadius={8}
              animationDuration={900}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <motion.p
        className="-mt-8 text-2xl font-bold text-zinc-50"
        key={clamped}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
      >
        {clamped.toFixed(0)}
        <span className="text-sm text-zinc-500">{unit}</span>
      </motion.p>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{label}</p>
    </div>
  );
}

interface ResourceGaugesProps {
  cpuPercent: number;
  memoryPercent: number;
}

export function ResourceGauges({ cpuPercent, memoryPercent }: ResourceGaugesProps) {
  return (
    <motion.div
      className="glass-panel glow-border grid grid-cols-2 gap-2 rounded-2xl p-4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.22 }}
    >
      <Gauge label="CPU" value={cpuPercent} color="#22d3ee" glowClass="gauge-glow-purple" />
      <Gauge label="Memory" value={memoryPercent} color="#38bdf8" glowClass="gauge-glow-sky" />
    </motion.div>
  );
}
