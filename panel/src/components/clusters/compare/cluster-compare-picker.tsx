"use client";

import { ArrowLeftRight } from "lucide-react";
import { Label, Select } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

interface ClusterComparePickerProps {
  clusterAId: string;
  clusterBId: string;
  onClusterAChange: (clusterId: string) => void;
  onClusterBChange: (clusterId: string) => void;
  onSwap?: () => void;
  className?: string;
}

export function ClusterComparePicker({
  clusterAId,
  clusterBId,
  onClusterAChange,
  onClusterBChange,
  onSwap,
  className,
}: ClusterComparePickerProps) {
  const { clusters } = useAuth();

  return (
    <div className={cn("grid gap-4 md:grid-cols-[1fr_auto_1fr]", className)}>
      <ClusterSelect
        label="Cluster A"
        value={clusterAId}
        excludeClusterId={clusterBId}
        onChange={onClusterAChange}
        clusters={clusters}
      />

      <div className="flex items-end justify-center pb-0.5">
        <button
          type="button"
          onClick={onSwap}
          disabled={!clusterAId || !clusterBId || !onSwap}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          title="Swap clusters"
          aria-label="Swap clusters"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
      </div>

      <ClusterSelect
        label="Cluster B"
        value={clusterBId}
        excludeClusterId={clusterAId}
        onChange={onClusterBChange}
        clusters={clusters}
      />
    </div>
  );
}

function ClusterSelect({
  label,
  value,
  excludeClusterId,
  onChange,
  clusters,
}: {
  label: string;
  value: string;
  excludeClusterId: string;
  onChange: (clusterId: string) => void;
  clusters: { id: string; name: string }[];
}) {
  const options = clusters.filter((cluster) => cluster.id !== excludeClusterId);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="" disabled>
          Select a cluster…
        </option>
        {options.map((cluster) => (
          <option key={cluster.id} value={cluster.id}>
            {cluster.name}
          </option>
        ))}
      </Select>
      {options.length === 0 && (
        <p className="text-xs text-zinc-500">Add another cluster in Settings to compare.</p>
      )}
    </div>
  );
}
