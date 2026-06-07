export interface TemplateVersionSummary {
  id: string;
  savedAt: number;
  savedBy?: string;
}

export interface TemplateVersionDetail extends TemplateVersionSummary {
  content: string;
}

async function panelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
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

  return response.json() as Promise<T>;
}

export function fetchTemplateVersions(group: string, name: string, path: string) {
  const qs = new URLSearchParams({ path });
  return panelFetch<{ versions: TemplateVersionSummary[] }>(
    `/api/panel/templates/${encodeURIComponent(group)}/${encodeURIComponent(name)}/versions?${qs}`,
  );
}

export function snapshotTemplateVersion(
  group: string,
  name: string,
  path: string,
  content: string,
) {
  return panelFetch<{ skipped: boolean; version: TemplateVersionSummary | null }>(
    `/api/panel/templates/${encodeURIComponent(group)}/${encodeURIComponent(name)}/versions`,
    {
      method: "POST",
      body: JSON.stringify({ path, content }),
    },
  );
}

export function fetchTemplateVersionContent(
  group: string,
  name: string,
  path: string,
  versionId: string,
) {
  const qs = new URLSearchParams({ path });
  return panelFetch<{ version: TemplateVersionDetail }>(
    `/api/panel/templates/${encodeURIComponent(group)}/${encodeURIComponent(name)}/versions/${encodeURIComponent(versionId)}?${qs}`,
  );
}

export function rollbackTemplateVersion(
  group: string,
  name: string,
  path: string,
  versionId: string,
  currentContent?: string,
) {
  return panelFetch<{ content: string; rolledBackTo: TemplateVersionSummary }>(
    `/api/panel/templates/${encodeURIComponent(group)}/${encodeURIComponent(name)}/versions/rollback`,
    {
      method: "POST",
      body: JSON.stringify({ path, versionId, currentContent }),
    },
  );
}

export function formatVersionTime(savedAt: number): string {
  return new Date(savedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
