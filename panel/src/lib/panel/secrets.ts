import fs from "fs";
import { randomBytes } from "crypto";
import { dataDir } from "@/lib/panel/store";

let cachedSecret: string | null = null;

/** Auto-generates and persists a panel secret — no .env required for local use. */
export function getPanelSecret(): string {
  if (process.env.PANEL_SECRET && process.env.PANEL_SECRET.length >= 16) {
    return process.env.PANEL_SECRET;
  }

  if (cachedSecret) return cachedSecret;

  const file = `${dataDir()}/.panel-secret`;
  if (fs.existsSync(file)) {
    cachedSecret = fs.readFileSync(file, "utf8").trim();
    if (cachedSecret.length >= 16) return cachedSecret;
  }

  cachedSecret = randomBytes(32).toString("base64url");
  fs.writeFileSync(file, cachedSecret, { mode: 0o600 });
  return cachedSecret;
}
