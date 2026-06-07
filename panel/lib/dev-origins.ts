import os from "node:os";

const DEFAULT_DEV_PORT = "3000";

/**
 * Hostnames and host:port pairs allowed to load Next.js dev assets (/_next/*, HMR).
 * Required when the panel is opened via Tailscale MagicDNS, LAN IP, or machine hostname
 * instead of localhost.
 */
export function collectDevOrigins(port = process.env.PORT ?? DEFAULT_DEV_PORT): string[] {
  const origins = new Set<string>([
    "localhost",
    `localhost:${port}`,
    "127.0.0.1",
    `127.0.0.1:${port}`,
    "[::1]",
    `[::1]:${port}`,
  ]);

  const hostname = os.hostname();
  if (hostname && hostname !== "localhost") {
    origins.add(hostname);
    origins.add(`${hostname}:${port}`);
  }

  for (const extra of process.env.PANEL_DEV_ORIGINS?.split(",") ?? []) {
    const trimmed = extra.trim();
    if (trimmed) origins.add(trimmed);
  }

  if (process.env.TAILSCALE_HOSTNAME) {
    origins.add(process.env.TAILSCALE_HOSTNAME);
    origins.add(`${process.env.TAILSCALE_HOSTNAME}:${port}`);
  }

  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.internal) continue;
      const ip = addr.family === "IPv6" ? `[${addr.address}]` : addr.address;
      origins.add(ip);
      origins.add(`${ip}:${port}`);
    }
  }

  return [...origins];
}
