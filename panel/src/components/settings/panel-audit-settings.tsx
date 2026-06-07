"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import {
  AUDIT_ACTION_LABELS,
  formatAuditTimestamp,
  summarizeAuditDetails,
  type AuditAction,
  type AuditEvent,
} from "@/lib/panel/audit-shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ACTION_FILTER_OPTIONS: { value: "" | AuditAction; label: string }[] = [
  { value: "", label: "All actions" },
  ...(
    Object.entries(AUDIT_ACTION_LABELS) as [AuditAction, string][]
  ).map(([value, label]) => ({ value, label })),
];

function actionBadgeVariant(action: AuditAction) {
  if (action.startsWith("auth.")) return "accent" as const;
  if (action.startsWith("import.")) return "warning" as const;
  return "muted" as const;
}

export function PanelAuditSettings() {
  const { clusters } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<"" | AuditAction>("");
  const [clusterFilter, setClusterFilter] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (actionFilter) params.set("action", actionFilter);
    if (clusterFilter) params.set("clusterId", clusterFilter);

    const res = await fetch(`/api/panel/audit?${params}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [actionFilter, clusterFilter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Security audit log</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Who did what, when, and on which cluster. Operational instance activity is shown on the
          dashboard, not here.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as "" | AuditAction)}
          className="rounded-lg border border-white/[0.08] bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200"
        >
          {ACTION_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={clusterFilter}
          onChange={(e) => setClusterFilter(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">All clusters</option>
          {clusters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading audit log...</p>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] py-12 text-center">
          <ScrollText className="h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">No audit events yet</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-600">
            Showing {events.length} of {total} event{total === 1 ? "" : "s"}
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-zinc-500">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Cluster</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                      {formatAuditTimestamp(event.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-200">{event.userName}</div>
                      <div className="text-xs text-zinc-500">{event.userEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={actionBadgeVariant(event.action)} className="text-[10px]">
                        {AUDIT_ACTION_LABELS[event.action]}
                      </Badge>
                    </td>
                    <td className={cn("px-4 py-3 text-zinc-400", "max-w-[200px] truncate")}>
                      {summarizeAuditDetails(event) || "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{event.clusterName ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {event.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
