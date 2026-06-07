"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useActivityEvents } from "@/lib/api/queries";
import { useAuth } from "@/lib/auth/context";
import {
  ACTIVITY_SEVERITY_LABELS,
  ACTIVITY_TYPE_LABELS,
  type ActivityEvent,
  type ActivitySeverity,
  type ActivityType,
} from "@/lib/panel/activity-types";
import { cn } from "@/lib/utils";

const severityDot: Record<ActivitySeverity, string> = {
  info: "bg-sky-400",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  error: "bg-red-400",
};

const severityBadge: Record<ActivitySeverity, "default" | "success" | "warning" | "danger" | "accent"> = {
  info: "accent",
  success: "success",
  warning: "warning",
  error: "danger",
};

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function ActivityRow({ event, index }: { event: ActivityEvent; index: number }) {
  return (
    <motion.li
      className="relative flex gap-4 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.3 }}
    >
      <span
        className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/5", severityDot[event.severity])}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-zinc-200">{event.message}</p>
          <Badge variant={severityBadge[event.severity]} className="text-[10px]">
            {ACTIVITY_SEVERITY_LABELS[event.severity]}
          </Badge>
          <Badge variant="muted" className="text-[10px]">
            {ACTIVITY_TYPE_LABELS[event.type]}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
          <span>{event.clusterName}</span>
          {event.actorEmail && <span>{event.actorEmail}</span>}
          {event.metadata?.instanceId && (
            <span className="font-mono text-zinc-500">{String(event.metadata.instanceId)}</span>
          )}
          {event.metadata?.name && (
            <span className="font-mono text-zinc-500">{String(event.metadata.name)}</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-[11px] text-zinc-500">{relativeTime(event.timestamp)}</p>
        <p className="font-mono text-[10px] text-zinc-700">{formatTimestamp(event.timestamp)}</p>
      </div>
    </motion.li>
  );
}

export default function ActivityPage() {
  const [clusterId, setClusterId] = useState("");
  const [severity, setSeverity] = useState<ActivitySeverity | "">("");
  const [type, setType] = useState<ActivityType | "">("");

  const { clusters } = useAuth();
  const filters = useMemo(
    () => ({
      clusterId: clusterId || undefined,
      severity: severity || undefined,
      type: type || undefined,
      limit: 200,
    }),
    [clusterId, severity, type],
  );

  const activity = useActivityEvents(filters);

  const typeOptions = useMemo(
    () => Object.entries(ACTIVITY_TYPE_LABELS) as [ActivityType, string][],
    [],
  );
  const severityOptions = useMemo(
    () => Object.entries(ACTIVITY_SEVERITY_LABELS) as [ActivitySeverity, string][],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Unified timeline of panel and cluster events"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => activity.refetch()}
            disabled={activity.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${activity.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <Card className="glow-border mb-6">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="filter-cluster">Cluster</Label>
            <Select
              id="filter-cluster"
              className="mt-1.5"
              value={clusterId}
              onChange={(e) => setClusterId(e.target.value)}
            >
              <option value="">All clusters</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-severity">Severity</Label>
            <Select
              id="filter-severity"
              className="mt-1.5"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as ActivitySeverity | "")}
            >
              <option value="">All severities</option>
              {severityOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-type">Type</Label>
            <Select
              id="filter-type"
              className="mt-1.5"
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType | "")}
            >
              <option value="">All types</option>
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <div className="absolute bottom-4 left-[19px] top-4 w-px bg-gradient-to-b from-teal-500/30 via-violet-500/10 to-transparent" />
        {activity.isLoading ? (
          <p className="py-12 text-center text-sm text-zinc-600">Loading activity...</p>
        ) : activity.data?.events.length === 0 ? (
          <Card className="glow-border">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-zinc-500">No activity recorded yet</p>
              <p className="mt-1 text-xs text-zinc-600">
                Instance lifecycle, imports, config saves, and health changes appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {activity.data?.events.map((event, i) => (
              <ActivityRow key={event.id} event={event} index={i} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
