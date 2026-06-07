export function toWebSocketUrl(apiUrl: string, path: string, token: string): string {
  const url = new URL(path, apiUrl.replace(/\/$/, "") + "/");
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.toString();
}
