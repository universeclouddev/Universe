import { getClusterConnection } from "@/lib/panel/clusters";

export async function fetchClusterApi(
  clusterId: string,
  apiPath: string,
  init?: RequestInit,
): Promise<Response> {
  const connection = getClusterConnection(clusterId);
  if (!connection) {
    throw new Error("Cluster not found");
  }

  const normalizedPath = apiPath.replace(/^\/+/, "");
  const url = new URL(`${connection.apiUrl.replace(/\/$/, "")}/api/${normalizedPath}`);

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${connection.apiToken}`);

  return fetch(url.toString(), {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function readClusterApiJson<T>(
  clusterId: string,
  apiPath: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetchClusterApi(clusterId, apiPath, init);
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
