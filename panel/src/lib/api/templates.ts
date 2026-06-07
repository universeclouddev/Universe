import { apiFetch } from "@/lib/api/client";

export interface TemplateFileInfo {
  path: string;
  type: "file" | "directory";
  size: number;
}

export interface TemplateVariable {
  key: string;
  description: string;
}

export interface TemplateFilesResponse {
  group: string;
  name: string;
  files: TemplateFileInfo[];
}

export interface TemplateFileContentResponse {
  path: string;
  content: string;
  encoding: string;
}

export function fetchTemplateFiles(group: string, name: string) {
  return apiFetch<TemplateFilesResponse>(
    `/templates/${encodeURIComponent(group)}/${encodeURIComponent(name)}/files`,
  );
}

export function fetchTemplateFileContent(group: string, name: string, path: string) {
  return apiFetch<TemplateFileContentResponse>(
    `/templates/${encodeURIComponent(group)}/${encodeURIComponent(name)}/files/content?path=${encodeURIComponent(path)}`,
  );
}

export function saveTemplateFileContent(group: string, name: string, path: string, content: string) {
  return apiFetch<{ path: string; message: string }>(
    `/templates/${encodeURIComponent(group)}/${encodeURIComponent(name)}/files/content`,
    {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    },
  );
}

export function fetchTemplateVariables() {
  return apiFetch<{ variables: TemplateVariable[] }>("/templates/variables");
}

export function createTemplate(group: string, name: string) {
  return apiFetch<{ group: string; name: string; path: string }>("/templates", {
    method: "POST",
    body: JSON.stringify({ group, name }),
  });
}

export async function importTemplateZip(
  group: string,
  name: string,
  file: File,
  overwrite = true,
) {
  const form = new FormData();
  form.append("group", group);
  form.append("name", name);
  form.append("overwrite", String(overwrite));
  form.append("file", file);

  const response = await fetch("/api/universe/templates/import", {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.error ?? body.message ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.json() as Promise<{ message: string; group: string; name: string }>;
}

export function languageForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "json":
      return "json";
    case "yml":
    case "yaml":
      return "yaml";
    case "properties":
    case "conf":
    case "cfg":
    case "ini":
      return "ini";
    case "sh":
    case "bash":
      return "shell";
    case "md":
      return "markdown";
    case "xml":
      return "xml";
    case "toml":
      return "ini";
    default:
      return "plaintext";
  }
}

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children: TreeNode[];
}

export function buildFileTree(files: TemplateFileInfo[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", type: "directory", children: [] };

  const filePaths = files.filter((f) => f.type === "file").map((f) => f.path);
  for (const filePath of filePaths) {
    const parts = filePath.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const nodePath = parts.slice(0, i + 1).join("/");
      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: nodePath,
          type: isFile ? "file" : "directory",
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  function sortTree(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((n) => ({ ...n, children: sortTree(n.children) }));
  }

  return sortTree(root.children);
}
