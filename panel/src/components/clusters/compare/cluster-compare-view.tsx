"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/context";
import {
  fetchRemoteConfigurations,
  fetchRemoteInstances,
  fetchRemoteTemplates,
} from "@/lib/api/cross-cluster";
import { ClusterComparePicker } from "./cluster-compare-picker";
import { ClusterCompareInstanceStats } from "./cluster-compare-instance-stats";
import { ClusterCompareConfigCounts } from "./cluster-compare-config-counts";
import { ClusterCompareListDiff } from "./cluster-compare-list-diff";
import {
  compareKeySets,
  configurationKeys,
  summarizeInstances,
  templateKeys,
} from "./compare-diff";

export function ClusterCompareView() {
  const { clusters, activeClusterId } = useAuth();
  const [clusterAId, setClusterAId] = useState("");
  const [clusterBId, setClusterBId] = useState("");
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);

  useEffect(() => {
    if (clusters.length < 2) return;

    setClusterAId((current) => {
      if (current && clusters.some((cluster) => cluster.id === current)) return current;
      return activeClusterId ?? clusters[0]?.id ?? "";
    });

    setClusterBId((current) => {
      if (current && clusters.some((cluster) => cluster.id === current)) return current;
      const preferred = clusters.find((cluster) => cluster.id !== activeClusterId);
      return preferred?.id ?? clusters[1]?.id ?? "";
    });
  }, [clusters, activeClusterId]);

  const clusterAName = clusters.find((cluster) => cluster.id === clusterAId)?.name ?? "Cluster A";
  const clusterBName = clusters.find((cluster) => cluster.id === clusterBId)?.name ?? "Cluster B";
  const canCompare = !!clusterAId && !!clusterBId && clusterAId !== clusterBId;

  const compareQuery = useQuery({
    queryKey: ["cluster-compare", clusterAId, clusterBId],
    queryFn: async () => {
      const [templatesA, templatesB, configurationsA, configurationsB, instancesA, instancesB] =
        await Promise.all([
          fetchRemoteTemplates(clusterAId),
          fetchRemoteTemplates(clusterBId),
          fetchRemoteConfigurations(clusterAId),
          fetchRemoteConfigurations(clusterBId),
          fetchRemoteInstances(clusterAId),
          fetchRemoteInstances(clusterBId),
        ]);

      return {
        templatesA,
        templatesB,
        configurationsA,
        configurationsB,
        instancesA,
        instancesB,
      };
    },
    enabled: canCompare,
    staleTime: 30_000,
  });

  const diff = useMemo(() => {
    if (!compareQuery.data) return null;

    const { templatesA, templatesB, configurationsA, configurationsB, instancesA, instancesB } =
      compareQuery.data;

    return {
      templates: compareKeySets(templateKeys(templatesA), templateKeys(templatesB)),
      configurations: compareKeySets(
        configurationKeys(configurationsA),
        configurationKeys(configurationsB),
      ),
      statsA: summarizeInstances(instancesA),
      statsB: summarizeInstances(instancesB),
    };
  }, [compareQuery.data]);

  function handleSwap() {
    setClusterAId(clusterBId);
    setClusterBId(clusterAId);
  }

  if (clusters.length < 2) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-zinc-500">
          Add at least two clusters in Settings to compare templates, configurations, and instance
          counts side by side.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glow-border">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-[min(100%,640px)] flex-1">
              <ClusterComparePicker
                clusterAId={clusterAId}
                clusterBId={clusterBId}
                onClusterAChange={setClusterAId}
                onClusterBChange={setClusterBId}
                onSwap={handleSwap}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDifferencesOnly((value) => !value)}
                disabled={!canCompare || !diff}
              >
                {showDifferencesOnly ? "Show all" : "Differences only"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => compareQuery.refetch()}
                disabled={!canCompare || compareQuery.isFetching}
              >
                {compareQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!canCompare && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            Select two different clusters to start comparing.
          </CardContent>
        </Card>
      )}

      {canCompare && compareQuery.isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading cluster data…
        </div>
      )}

      {canCompare && compareQuery.isError && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-400">
            {compareQuery.error instanceof Error
              ? compareQuery.error.message
              : "Failed to load cluster comparison data"}
          </CardContent>
        </Card>
      )}

      {canCompare && diff && !compareQuery.isLoading && (
        <div className="space-y-6">
          <ClusterCompareInstanceStats
            clusterAName={clusterAName}
            clusterBName={clusterBName}
            statsA={diff.statsA}
            statsB={diff.statsB}
          />

          <ClusterCompareConfigCounts
            clusterAName={clusterAName}
            clusterBName={clusterBName}
            statsA={diff.statsA}
            statsB={diff.statsB}
            showDifferencesOnly={showDifferencesOnly}
          />

          <ClusterCompareListDiff
            title="Templates"
            clusterAName={clusterAName}
            clusterBName={clusterBName}
            rows={diff.templates}
            showDifferencesOnly={showDifferencesOnly}
            emptyMessage="No templates on either cluster"
          />

          <ClusterCompareListDiff
            title="Configurations"
            clusterAName={clusterAName}
            clusterBName={clusterBName}
            rows={diff.configurations}
            showDifferencesOnly={showDifferencesOnly}
            emptyMessage="No configurations on either cluster"
          />
        </div>
      )}
    </div>
  );
}
