/** Java {@code OperatingSystemMXBean.getSystemLoadAverage()} returns -1 when unavailable (e.g. Windows). */
export function getValidSystemLoadAverage(value: number | undefined | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function formatSystemLoadAverage(value: number | undefined | null): string {
  const load = getValidSystemLoadAverage(value);
  return load !== null ? load.toFixed(2) : "—";
}

export function getMemoryUsagePercent(system: {
  totalMemory: number;
  freeMemory: number;
} | undefined): number | null {
  if (!system || system.totalMemory <= 0) return null;
  const pct = ((system.totalMemory - system.freeMemory) / system.totalMemory) * 100;
  if (!Number.isFinite(pct)) return null;
  return Math.min(100, Math.max(0, Math.round(pct)));
}
