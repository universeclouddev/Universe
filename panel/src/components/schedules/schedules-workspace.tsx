"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ScheduleForm,
  scheduleFormToPayload,
  type ScheduleFormValues,
} from "@/components/schedules/schedule-form";
import {
  useCreateSchedule,
  useDeleteSchedule,
  useRunScheduleNow,
  useSchedules,
  useUpdateSchedule,
} from "@/lib/api/schedule-queries";
import { useInstances } from "@/lib/api/queries";
import type { InstanceInfo } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/context";
import { taskTypeLabel, type PanelSchedule, type ScheduleClusterOption } from "@/lib/panel/schedule-types";

function formatTimestamp(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

function payloadSummary(schedule: PanelSchedule): string {
  switch (schedule.taskType) {
    case "template_sync":
      return schedule.payload.pattern ?? "";
    case "command":
      return schedule.payload.command ?? "";
    default:
      return schedule.payload.instanceId ?? "";
  }
}

function scheduleToFormValues(schedule: PanelSchedule): ScheduleFormValues {
  return {
    name: schedule.name,
    enabled: schedule.enabled,
    clusterId: schedule.clusterId,
    cron: schedule.cron,
    taskType: schedule.taskType,
    pattern: schedule.payload.pattern ?? "*",
    instanceId: schedule.payload.instanceId ?? "",
    command: schedule.payload.command ?? "",
  };
}

interface SchedulesWorkspaceProps {
  clusters: ScheduleClusterOption[];
}

export function SchedulesWorkspace({ clusters }: SchedulesWorkspaceProps) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("schedules.manage");
  const schedules = useSchedules();
  const instances = useInstances();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const runNow = useRunScheduleNow();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const clusterNames = useMemo(
    () => new Map(clusters.map((cluster) => [cluster.id, cluster.name])),
    [clusters],
  );

  const instanceOptions = useMemo(
    () =>
      (instances.data ?? [])
        .filter((i): i is InstanceInfo & { id: string; configurationName: string; state: string } =>
          Boolean(i.id && i.configurationName && i.state),
        )
        .map((i) => ({ id: i.id, configurationName: i.configurationName, state: i.state })),
    [instances.data],
  );

  const editingSchedule = schedules.data?.find((s) => s.id === editingId) ?? null;

  async function handleCreate(values: ScheduleFormValues) {
    try {
      await createSchedule.mutateAsync({
        name: values.name,
        enabled: values.enabled,
        clusterId: values.clusterId,
        cron: values.cron,
        taskType: values.taskType,
        payload: scheduleFormToPayload(values),
      });
      toast.success("Schedule created");
      setCreating(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create schedule");
    }
  }

  async function handleUpdate(values: ScheduleFormValues) {
    if (!editingId) return;
    try {
      await updateSchedule.mutateAsync({
        id: editingId,
        name: values.name,
        enabled: values.enabled,
        clusterId: values.clusterId,
        cron: values.cron,
        taskType: values.taskType,
        payload: scheduleFormToPayload(values),
      });
      toast.success("Schedule updated");
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update schedule");
    }
  }

  async function handleToggle(schedule: PanelSchedule) {
    try {
      await updateSchedule.mutateAsync({ id: schedule.id, enabled: !schedule.enabled });
      toast.success(schedule.enabled ? "Schedule paused" : "Schedule enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update schedule");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this schedule?")) return;
    try {
      await deleteSchedule.mutateAsync(id);
      toast.success("Schedule deleted");
      if (editingId === id) setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete schedule");
    }
  }

  async function handleRunNow(id: string) {
    try {
      const result = await runNow.mutateAsync(id);
      if (result.status === "success") {
        toast.success(result.message || "Schedule ran successfully");
      } else {
        toast.error(result.message || "Schedule run failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run schedule");
    }
  }

  return (
    <div>
      <PageHeader
        title="Schedules"
        description="Cron jobs for template sync, instance lifecycle, and console commands. The panel runner checks every minute."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => { setCreating(true); setEditingId(null); }}>
              <Plus className="h-4 w-4" />
              New schedule
            </Button>
          ) : undefined
        }
        meta={
          <Badge variant="muted" className="font-mono text-[10px]">
            {schedules.data?.filter((s) => s.enabled).length ?? 0} active
          </Badge>
        }
      />

      {(creating || editingSchedule) && canManage && (
        <Card className="mb-6 glow-border">
          <CardHeader>
            <CardTitle>{editingSchedule ? "Edit schedule" : "Create schedule"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ScheduleForm
              clusters={clusters}
              instances={instanceOptions}
              initial={editingSchedule ? scheduleToFormValues(editingSchedule) : undefined}
              submitLabel={editingSchedule ? "Save changes" : "Create schedule"}
              pending={createSchedule.isPending || updateSchedule.isPending}
              onSubmit={editingSchedule ? handleUpdate : handleCreate}
              onCancel={() => {
                setCreating(false);
                setEditingId(null);
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card className="glow-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-teal-300" />
            Scheduled tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.04] text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Task</th>
                <th className="px-4 py-2">Cron</th>
                <th className="px-4 py-2">Target</th>
                <th className="px-4 py-2">Next run</th>
                <th className="px-4 py-2">Last run</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(schedules.data ?? []).map((schedule, index) => (
                <motion.tr
                  key={schedule.id}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100">{schedule.name}</div>
                    <div className="text-xs text-slate-500">{clusterNames.get(schedule.clusterId) ?? schedule.clusterId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={schedule.enabled ? "success" : "muted"}>
                      {schedule.enabled ? "On" : "Off"}
                    </Badge>
                    <div className="mt-1 text-xs text-slate-400">{taskTypeLabel(schedule.taskType)}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-teal-200/90">{schedule.cron}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{payloadSummary(schedule)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatTimestamp(schedule.nextRunAt)}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-400">{formatTimestamp(schedule.lastRunAt)}</div>
                    {schedule.lastRunStatus && (
                      <div
                        className={
                          schedule.lastRunStatus === "success" ? "text-xs text-emerald-400" : "text-xs text-red-400"
                        }
                      >
                        {schedule.lastRunMessage ?? schedule.lastRunStatus}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Run now"
                            onClick={() => handleRunNow(schedule.id)}
                            disabled={runNow.isPending}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={schedule.enabled ? "Pause" : "Enable"}
                            onClick={() => handleToggle(schedule)}
                          >
                            <CalendarClock className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => {
                              setEditingId(schedule.id);
                              setCreating(false);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => handleDelete(schedule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {!schedules.isLoading && (schedules.data?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No schedules yet. Create one to automate template sync or instance restarts.
                  </td>
                </tr>
              )}
              {schedules.isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Loading schedules…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
