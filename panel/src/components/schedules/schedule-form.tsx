"use client";

import { useEffect, useState } from "react";
import { CRON_EXAMPLES, type ScheduleClusterOption, type ScheduleTaskType } from "@/lib/panel/schedule-types";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

export interface ScheduleFormValues {
  name: string;
  enabled: boolean;
  clusterId: string;
  cron: string;
  taskType: ScheduleTaskType;
  pattern: string;
  instanceId: string;
  command: string;
}

const TASK_TYPES: { value: ScheduleTaskType; label: string }[] = [
  { value: "template_sync", label: "Template sync" },
  { value: "instance_restart", label: "Instance restart" },
  { value: "instance_start", label: "Instance start" },
  { value: "instance_stop", label: "Instance stop" },
  { value: "command", label: "Console command" },
];

function payloadFromForm(values: ScheduleFormValues): Record<string, string> {
  switch (values.taskType) {
    case "template_sync":
      return { pattern: values.pattern };
    case "instance_restart":
    case "instance_start":
    case "instance_stop":
      return { instanceId: values.instanceId };
    case "command":
      return { command: values.command };
    default:
      return {};
  }
}

interface ScheduleFormProps {
  clusters: ScheduleClusterOption[];
  instances: { id: string; configurationName: string; state: string }[];
  initial?: Partial<ScheduleFormValues>;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: ScheduleFormValues) => void | Promise<void>;
  onCancel?: () => void;
}

export function ScheduleForm({
  clusters,
  instances,
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: ScheduleFormProps) {
  const [values, setValues] = useState<ScheduleFormValues>({
    name: initial?.name ?? "",
    enabled: initial?.enabled ?? true,
    clusterId: initial?.clusterId ?? clusters[0]?.id ?? "",
    cron: initial?.cron ?? "0 * * * *",
    taskType: initial?.taskType ?? "template_sync",
    pattern: initial?.pattern ?? "*",
    instanceId: initial?.instanceId ?? instances[0]?.id ?? "",
    command: initial?.command ?? "",
  });

  useEffect(() => {
    if (!values.clusterId && clusters[0]) {
      setValues((prev) => ({ ...prev, clusterId: clusters[0]!.id }));
    }
  }, [clusters, values.clusterId]);

  useEffect(() => {
    if (!values.instanceId && instances[0]) {
      setValues((prev) => ({ ...prev, instanceId: instances[0]!.id }));
    }
  }, [instances, values.instanceId]);

  function update<K extends keyof ScheduleFormValues>(key: K, value: ScheduleFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(values);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="schedule-name">Name</Label>
          <Input
            id="schedule-name"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Nightly template sync"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="schedule-cluster">Cluster</Label>
          <Select
            id="schedule-cluster"
            value={values.clusterId}
            onChange={(e) => update("clusterId", e.target.value)}
            required
          >
            {clusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>
                {cluster.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="schedule-task">Task</Label>
          <Select
            id="schedule-task"
            value={values.taskType}
            onChange={(e) => update("taskType", e.target.value as ScheduleTaskType)}
          >
            {TASK_TYPES.map((task) => (
              <option key={task.value} value={task.value}>
                {task.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="schedule-cron">Cron expression</Label>
          <Input
            id="schedule-cron"
            value={values.cron}
            onChange={(e) => update("cron", e.target.value)}
            placeholder="0 * * * *"
            className="font-mono"
            required
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {CRON_EXAMPLES.map((example) => (
              <button
                key={example.value}
                type="button"
                className="rounded-md border border-white/[0.08] px-2 py-0.5 text-[10px] text-slate-400 hover:border-teal-400/30 hover:text-teal-200"
                onClick={() => update("cron", example.value)}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>

        {values.taskType === "template_sync" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="schedule-pattern">Template pattern</Label>
            <Input
              id="schedule-pattern"
              value={values.pattern}
              onChange={(e) => update("pattern", e.target.value)}
              placeholder="lobby/* or *"
              className="font-mono"
              required
            />
          </div>
        )}

        {(values.taskType === "instance_restart" ||
          values.taskType === "instance_start" ||
          values.taskType === "instance_stop") && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="schedule-instance">Instance</Label>
            <Select
              id="schedule-instance"
              value={values.instanceId}
              onChange={(e) => update("instanceId", e.target.value)}
              required
            >
              {instances.length === 0 ? (
                <option value="">No instances available</option>
              ) : (
                instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.id} — {instance.configurationName} ({instance.state})
                  </option>
                ))
              )}
            </Select>
          </div>
        )}

        {values.taskType === "command" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="schedule-command">Command</Label>
            <Input
              id="schedule-command"
              value={values.command}
              onChange={(e) => update("command", e.target.value)}
              placeholder="cluster nodes"
              className="font-mono"
              required
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
          <input
            type="checkbox"
            checked={values.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
            className="rounded border-white/20 bg-transparent"
          />
          Enabled
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function scheduleFormToPayload(values: ScheduleFormValues) {
  return payloadFromForm(values);
}
