"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/context";
import {
  fetchTemplateFiles,
  fetchTemplateFileContent,
  saveTemplateFileContent,
  fetchTemplateVariables,
  createTemplate,
  importTemplateZip,
} from "@/lib/api/templates";
import {
  fetchTemplateVersions,
  snapshotTemplateVersion,
  rollbackTemplateVersion,
} from "@/lib/api/template-versions";

export const templateQueryKeys = {
  files: (group: string, name: string) => ["template-files", group, name] as const,
  content: (group: string, name: string, path: string) =>
    ["template-file", group, name, path] as const,
  variables: ["template-variables"] as const,
  versions: (group: string, name: string, path: string) =>
    ["template-versions", group, name, path] as const,
};

export function useTemplateFiles(group: string, name: string) {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: templateQueryKeys.files(group, name),
    queryFn: () => fetchTemplateFiles(group, name),
    enabled: hasPermission("templates.read") && !!group && !!name,
  });
}

export function useTemplateFileContent(group: string, name: string, path: string | null) {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: templateQueryKeys.content(group, name, path ?? ""),
    queryFn: () => fetchTemplateFileContent(group, name, path!),
    enabled: hasPermission("templates.read") && !!group && !!name && !!path,
  });
}

export function useTemplateVariables() {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: templateQueryKeys.variables,
    queryFn: () => fetchTemplateVariables(),
    enabled: hasPermission("templates.read"),
    staleTime: 60_000,
  });
}

export function useSaveTemplateFile(group: string, name: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      path,
      content,
      previousContent,
    }: {
      path: string;
      content: string;
      previousContent: string;
    }) => {
      if (previousContent !== content) {
        await snapshotTemplateVersion(group, name, path, previousContent);
      }
      return saveTemplateFileContent(group, name, path, content);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: templateQueryKeys.content(group, name, vars.path) });
      qc.invalidateQueries({ queryKey: templateQueryKeys.versions(group, name, vars.path) });
    },
  });
}

export function useTemplateVersions(group: string, name: string, path: string | null) {
  const { hasPermission } = useAuth();
  return useQuery({
    queryKey: templateQueryKeys.versions(group, name, path ?? ""),
    queryFn: () => fetchTemplateVersions(group, name, path!),
    enabled: hasPermission("templates.read") && !!group && !!name && !!path,
  });
}

export function useRollbackTemplateVersion(group: string, name: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      versionId,
      currentContent,
    }: {
      path: string;
      versionId: string;
      currentContent?: string;
    }) => rollbackTemplateVersion(group, name, path, versionId, currentContent),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: templateQueryKeys.content(group, name, vars.path) });
      qc.invalidateQueries({ queryKey: templateQueryKeys.versions(group, name, vars.path) });
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ group, name }: { group: string; name: string }) => createTemplate(group, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useImportTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      group,
      name,
      file,
      overwrite,
    }: {
      group: string;
      name: string;
      file: File;
      overwrite?: boolean;
    }) => importTemplateZip(group, name, file, overwrite),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: templateQueryKeys.files(vars.group, vars.name) });
    },
  });
}
