"use client";

import { useEffect, useRef, useState } from "react";

const METRICS_SAMPLE_MS = 30_000;
const METRICS_MAX_POINTS = 60;

export interface MetricsSnapshot {
  jvmMemoryPercent: number;
  jvmMemoryUsedMB: number;
  instanceTotal: number;
  instanceOnline: number;
  nodeCount: number | null;
  clusterRamMB: number | null;
  clusterCpu: number | null;
}

export interface MetricsHistoryPoint extends MetricsSnapshot {
  t: string;
  index: number;
  at: number;
}

function formatSampleTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Ring-buffer time series sampled every 30s from the latest metric snapshot. */
export function useMetricsRingBuffer(
  snapshot: MetricsSnapshot | null,
  enabled = true,
  intervalMs = METRICS_SAMPLE_MS,
  maxPoints = METRICS_MAX_POINTS,
) {
  const [history, setHistory] = useState<MetricsHistoryPoint[]>([]);
  const snapshotRef = useRef(snapshot);
  const indexRef = useRef(0);

  snapshotRef.current = snapshot;

  useEffect(() => {
    if (!enabled) return;

    const push = () => {
      const current = snapshotRef.current;
      if (!current) return;

      indexRef.current += 1;
      const at = Date.now();
      setHistory((prev) => {
        const next: MetricsHistoryPoint = {
          ...current,
          t: formatSampleTime(new Date(at)),
          index: indexRef.current,
          at,
        };
        return [...prev, next].slice(-maxPoints);
      });
    };

    push();
    const id = window.setInterval(push, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, maxPoints]);

  return history;
}

export function useMetricHistory(
  cpuPercent: number,
  memoryPercent: number,
  maxPoints = 30,
) {
  const [history, setHistory] = useState<
    { t: string; cpu: number; memory: number; index: number }[]
  >([]);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current += 1;
    setHistory((prev) => {
      const next = [
        ...prev,
        {
          t: `${indexRef.current}`,
          cpu: Math.min(100, Math.max(0, cpuPercent)),
          memory: Math.min(100, Math.max(0, memoryPercent)),
          index: indexRef.current,
        },
      ];
      return next.slice(-maxPoints);
    });
  }, [cpuPercent, memoryPercent, maxPoints]);

  return history;
}

export function useSparklineHistory(value: number, maxPoints = 12) {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    setPoints((prev) => [...prev.slice(-(maxPoints - 1)), value]);
  }, [value, maxPoints]);

  return points;
}
