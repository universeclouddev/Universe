"use client";

import { Activity, AlertTriangle, CheckCircle2, Layers } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { MotionItem, StaggerGrid } from "@/components/motion";
import type { LifecycleGroup } from "./lifecycle-utils";

interface LifecycleSummaryProps {
  groups: LifecycleGroup[];
}

export function LifecycleSummary({ groups }: LifecycleSummaryProps) {
  const healthy = groups.filter((g) => g.running >= g.desired).length;
  const underProvisioned = groups.filter((g) => g.running < g.desired).length;
  const totalRunning = groups.reduce((sum, g) => sum + g.running, 0);
  const totalDesired = groups.reduce((sum, g) => sum + g.desired, 0);

  return (
    <StaggerGrid className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MotionItem>
        <StatCard
          label="Configurations"
          value={groups.length}
          numericValue={groups.length}
          sub="Grouped by deployment config"
          icon={Layers}
          glow="purple"
        />
      </MotionItem>
      <MotionItem>
        <StatCard
          label="Running / desired"
          value={`${totalRunning} / ${totalDesired}`}
          sub="Active instances vs minimum service count"
          icon={Activity}
          glow="sky"
          delay={0.05}
        />
      </MotionItem>
      <MotionItem>
        <StatCard
          label="Healthy groups"
          value={healthy}
          numericValue={healthy}
          sub={`${underProvisioned} under target`}
          icon={CheckCircle2}
          glow="emerald"
          trend={
            healthy === groups.length && groups.length > 0
              ? { label: "All at target", positive: true }
              : undefined
          }
          delay={0.1}
        />
      </MotionItem>
      <MotionItem>
        <StatCard
          label="Needs attention"
          value={underProvisioned}
          numericValue={underProvisioned}
          sub="Groups below minimum count"
          icon={AlertTriangle}
          glow={underProvisioned > 0 ? "amber" : "emerald"}
          delay={0.15}
        />
      </MotionItem>
    </StaggerGrid>
  );
}
