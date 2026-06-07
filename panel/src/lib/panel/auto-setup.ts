import { randomBytes } from "crypto";
import { createCluster, setActiveClusterCookie } from "@/lib/panel/clusters";
import { createUser, needsSetup } from "@/lib/panel/users";
import { createSessionToken, setSessionCookie } from "@/lib/panel/session";
import { discoverLocalUniverse } from "@/lib/panel/universe-bootstrap";

export interface AutoSetupResult {
  user: { id: string; email: string; name: string; role: string };
  clusterName: string;
  apiUrl: string;
  /** Shown once when auto-generated — user can set their own password later in Settings */
  temporaryPassword: string | null;
}

export async function discoverUniverseStatus() {
  const universe = await discoverLocalUniverse();
  return {
    found: !!universe,
    clusterName: universe?.clusterName ?? null,
    apiUrl: universe?.apiUrl ?? null,
  };
}

export async function runAutoSetup(input: { name?: string }): Promise<AutoSetupResult> {
  if (!needsSetup()) {
    throw new Error("Setup already completed");
  }

  const bootstrap = await discoverLocalUniverse();
  if (!bootstrap) {
    throw new Error(
      "Could not find a running Universe master. Start Universe first, then refresh this page.",
    );
  }

  const displayName = input.name?.trim() || "Admin";
  const temporaryPassword = randomBytes(6).toString("base64url");

  const user = await createUser({
    email: "admin@local",
    name: displayName,
    password: temporaryPassword,
  });

  const cluster = await createCluster({
    apiUrl: bootstrap.apiUrl,
    apiToken: bootstrap.token,
    name: bootstrap.clusterName,
  });
  await setActiveClusterCookie(cluster.id);

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  await setSessionCookie(token);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    clusterName: cluster.name,
    apiUrl: bootstrap.apiUrl,
    temporaryPassword,
  };
}
