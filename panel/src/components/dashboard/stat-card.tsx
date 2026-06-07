"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/dashboard/sparkline";
import { AnimatedNumber } from "@/components/motion";

interface StatCardProps {
  label: string;
  value: string | number;
  numericValue?: number;
  sub?: string;
  icon: LucideIcon;
  glow?: "purple" | "emerald" | "sky" | "amber";
  trend?: { label: string; positive?: boolean };
  sparkData?: number[];
  sparkColor?: string;
  delay?: number;
}

const glowClass = {
  purple: "glow-border-violet stat-card-glow-violet",
  emerald: "glow-border-emerald stat-card-glow-emerald",
  sky: "glow-border-sky stat-card-glow-sky",
  amber: "glow-border-amber stat-card-glow-amber",
};

const iconBg = {
  purple: "from-violet-500/20 to-violet-600/5 text-violet-300 ring-violet-500/20",
  emerald: "from-emerald-500/20 to-emerald-600/5 text-emerald-400 ring-emerald-500/20",
  sky: "from-sky-500/20 to-sky-600/5 text-sky-400 ring-sky-500/20",
  amber: "from-amber-500/20 to-amber-600/5 text-amber-400 ring-amber-500/20",
};

const sparkColors = {
  purple: "#a78bfa",
  emerald: "#34d399",
  sky: "#38bdf8",
  amber: "#fbbf24",
};

const trendStyles = {
  positive: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  neutral: "border-slate-500/20 bg-slate-500/10 text-slate-400",
};

const orbGradient = {
  purple: "from-violet-500/[0.07] to-transparent",
  emerald: "from-emerald-500/[0.07] to-transparent",
  sky: "from-sky-500/[0.06] to-transparent",
  amber: "from-amber-500/[0.07] to-transparent",
};

export function StatCard({
  label,
  value,
  numericValue,
  sub,
  icon: Icon,
  glow = "purple",
  trend,
  sparkData,
  sparkColor,
  delay = 0,
}: StatCardProps) {
  const reducedMotion = useReducedMotion();
  const hasSparkline = Boolean(sparkData && sparkData.length >= 2);

  return (
    <motion.div
      className={cn(
        "stat-card glass-panel glow-border group relative flex h-full flex-col overflow-hidden rounded-xl",
        "px-4 pb-3.5 pt-4 sm:px-5 sm:pb-4 sm:pt-5",
        trend ? "pr-[5.5rem]" : "pr-4 sm:pr-5",
        glowClass[glow],
      )}
      initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br blur-2xl opacity-80 transition-opacity duration-300 group-hover:opacity-100",
          orbGradient[glow],
        )}
      />

      {trend ? (
        <motion.span
          className={cn(
            "absolute right-4 top-4 z-10 inline-flex items-center rounded-full border px-2.5 py-1",
            "text-[9px] font-semibold uppercase leading-none tracking-wide whitespace-nowrap",
            trend.positive ? trendStyles.positive : trendStyles.neutral,
          )}
          initial={reducedMotion ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.15 }}
        >
          {trend.label}
        </motion.span>
      ) : null}

      <div className="flex items-start">
        <motion.div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ring-1",
            iconBg[glow],
          )}
          whileHover={
            reducedMotion ? undefined : { rotate: [0, -6, 6, 0], transition: { duration: 0.35 } }
          }
        >
          <Icon className="h-4 w-4" />
        </motion.div>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          {label}
        </p>
        <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums tracking-tight text-slate-50">
          {numericValue !== undefined ? (
            <AnimatedNumber value={numericValue} decimals={numericValue % 1 ? 1 : 0} />
          ) : (
            value
          )}
        </p>
        {sub ? (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{sub}</p>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-transparent" aria-hidden>
            &nbsp;
          </p>
        )}
      </div>

      <div className={cn("shrink-0", hasSparkline ? "mt-3 h-10" : "mt-1 h-0")}>
        {hasSparkline ? (
          <Sparkline
            data={sparkData!}
            color={sparkColor ?? sparkColors[glow]}
            className="opacity-80 transition-opacity group-hover:opacity-100"
          />
        ) : null}
      </div>
    </motion.div>
  );
}
