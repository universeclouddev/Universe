import createClient from "openapi-fetch";
import type { paths } from "./schema";

const client = createClient<paths>({
  baseUrl: "/api/universe",
  credentials: "include",
});

export function createApiClient(_apiUrl?: string) {
  return client;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api/universe${path}`, {
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

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
