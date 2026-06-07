"use client";

import { Label, Select } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/context";

interface ClusterSourceSelectProps {
  value: string;
  onChange: (clusterId: string) => void;
  label?: string;
  excludeClusterId?: string | null;
}

export function ClusterSourceSelect({
  value,
  onChange,
  label = "Source cluster",
  excludeClusterId,
}: ClusterSourceSelectProps) {
  const { clusters } = useAuth();
  const options = clusters.filter((c) => c.id !== excludeClusterId);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)} required>
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
        <p className="text-xs text-zinc-500">Add another cluster in Settings to import from it.</p>
      )}
    </div>
  );
}

interface ImportDestinationHintProps {
  destinationName?: string | null;
}

export function ImportDestinationHint({ destinationName }: ImportDestinationHintProps) {
  return (
    <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-zinc-500">
      Imports into{" "}
      <span className="font-medium text-zinc-300">{destinationName ?? "the active cluster"}</span>.
      Switch clusters from the header menu to change the destination.
    </p>
  );
}
