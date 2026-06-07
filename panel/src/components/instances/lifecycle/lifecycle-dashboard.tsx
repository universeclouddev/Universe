"use client";

import { useMemo } from "react";
import { LifecycleGroupCard } from "./lifecycle-group-card";
import { LifecycleSummary } from "./lifecycle-summary";
import { buildLifecycleGroups } from "./lifecycle-utils";
import { MotionCard } from "@/components/motion";
import type { Configuration, InstanceInfo } from "@/lib/api/types";

interface LifecycleDashboardProps {
  instances: InstanceInfo[];
  configurations: Configuration[];
  loading?: boolean;
}

export function LifecycleDashboard({
  instances,
  configurations,
  loading,
}: LifecycleDashboardProps) {
  const groups = useMemo(
    () => buildLifecycleGroups(instances, configurations),
    [instances, configurations],
  );

  if (loading) {
    return <p className="text-zinc-500">Loading lifecycle data...</p>;
  }

  if (groups.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center">
        <p className="text-zinc-400">No configurations or instances found.</p>
        <p className="mt-1 text-sm text-zinc-600">
          Create a configuration and deploy instances to see lifecycle groups here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <LifecycleSummary groups={groups} />

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group, index) => (
          <MotionCard key={group.configurationName} delay={index * 0.04}>
            <LifecycleGroupCard group={group} />
          </MotionCard>
        ))}
      </div>
    </div>
  );
}
