"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/context";
import type { PanelSchedule, ScheduleTaskType } from "@/lib/panel/schedule-types";

export const scheduleQueryKeys = {
  all: ["panel-schedules"] as const,
};

async function panelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function useSchedules() {
  const { hasPermission, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: scheduleQueryKeys.all,
    queryFn: async () => {
      const data = await panelFetch<{ schedules: PanelSchedule[] }>("/api/panel/schedules");
      return data.schedules;
    },
    enabled: isAuthenticated && hasPermission("schedules.read"),
    refetchInterval: 30_000,
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      enabled?: boolean;
      clusterId: string;
      cron: string;
      taskType: ScheduleTaskType;
      payload: Record<string, string>;
    }) => {
      const data = await panelFetch<{ schedule: PanelSchedule }>("/api/panel/schedules", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data.schedule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      name?: string;
      enabled?: boolean;
      clusterId?: string;
      cron?: string;
      taskType?: ScheduleTaskType;
      payload?: Record<string, string>;
    }) => {
      const data = await panelFetch<{ schedule: PanelSchedule }>(`/api/panel/schedules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return data.schedule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await panelFetch(`/api/panel/schedules/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
  });
}

export function useRunScheduleNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const data = await panelFetch<{ result: { status: string; message: string } }>(
        `/api/panel/schedules/${id}/run`,
        { method: "POST" },
      );
      return data.result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
  });
}
