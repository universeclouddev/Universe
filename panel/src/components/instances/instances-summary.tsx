"use client";

import { Server, Activity, HardDrive, Layers } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { useSparklineHistory } from "@/hooks/use-metric-history";
import type { InstanceInfo } from "@/lib/api/types";
import { MotionItem, StaggerGrid } from "@/components/motion";

interface InstancesSummaryProps {
  instances: InstanceInfo[];
}

export function InstancesSummary({ instances }: InstancesSummaryProps) {
  const online = instances.filter((i) => i.state === "ONLINE" || i.state === "CREATING").length;
  const stopped = instances.filter((i) => i.state === "STOPPED" || i.state === "OFFLINE").length;
  const totalRam = instances.reduce((s, i) => s + (i.allocatedRamMB ?? 0), 0);
  const configs = new Set(instances.map((i) => i.configurationName).filter(Boolean)).size;

  const onlineSpark = useSparklineHistory(online);
  const ramSpark = useSparklineHistory(totalRam);

  return (
    <StaggerGrid className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MotionItem>
        <StatCard
          label="Total instances"
          value={instances.length}
          numericValue={instances.length}
          sub={`${online} running · ${stopped} inactive`}
          icon={Server}
          glow="purple"
          trend={online > 0 ? { label: `${online} live`, positive: true } : undefined}
          sparkData={onlineSpark}
        />
      </MotionItem>
      <MotionItem>
        <StatCard
          label="Online"
          value={online}
          numericValue={online}
          sub="ONLINE + CREATING states"
          icon={Activity}
          glow="emerald"
          sparkData={onlineSpark}
          delay={0.05}
        />
      </MotionItem>
      <MotionItem>
        <StatCard
          label="Allocated RAM"
          value={`${totalRam} MB`}
          numericValue={totalRam}
          sub="Sum across all instances"
          icon={HardDrive}
          glow="sky"
          sparkData={ramSpark}
          delay={0.1}
        />
      </MotionItem>
      <MotionItem>
        <StatCard
          label="Configurations"
          value={configs}
          numericValue={configs}
          sub="Unique deployment configs"
          icon={Layers}
          glow="amber"
          delay={0.15}
        />
      </MotionItem>
    </StaggerGrid>
  );
}
