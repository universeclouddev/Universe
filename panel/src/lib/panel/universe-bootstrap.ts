import { fetchClusterPing } from "@/lib/panel/clusters";

export interface UniverseBootstrapPayload {
  apiUrl: string;
  token: string;
  clusterName: string;
}

const DEFAULT_CANDIDATES = [
  process.env.UNIVERSE_API_URL,
  process.env.NEXT_PUBLIC_DEFAULT_API_URL,
  "http://127.0.0.1:7000",
  "http://localhost:7000",
  "http://universe:7000",
].filter(Boolean) as string[];

function uniqueUrls(urls: string[]) {
  return [...new Set(urls.map((u) => u.replace(/\/$/, "")))];
}

export async function discoverLocalUniverse(): Promise<UniverseBootstrapPayload | null> {
  for (const apiUrl of uniqueUrls(DEFAULT_CANDIDATES)) {
    const payload = await fetchUniverseBootstrap(apiUrl);
    if (payload) return payload;
  }
  return null;
}

export async function fetchUniverseBootstrap(apiUrl: string): Promise<UniverseBootstrapPayload | null> {
  const base = apiUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/panel/bootstrap`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      token?: string;
      apiUrl?: string;
      clusterName?: string;
    };
    if (!data.token) return null;
    const ping = await fetchClusterPing(base);
    return {
      apiUrl: (data.apiUrl ?? base).replace(/\/$/, ""),
      token: data.token,
      clusterName: data.clusterName ?? ping?.clusterName ?? "universe-cluster",
    };
  } catch {
    return null;
  }
}
