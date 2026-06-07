import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import {
  createCluster,
  deleteCluster,
  getActiveClusterIdFromCookie,
  getDefaultActiveClusterId,
  listClusters,
  setActiveClusterCookie,
  updateCluster,
} from "@/lib/panel/clusters";
import { validateClusterHealthPatch } from "@/lib/panel/cluster-health";
import { recordActivity } from "@/lib/panel/activity";

async function requireClusterManage() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!roleHasPermission(session.role, "settings.universe")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clusters = listClusters();
  const cookieId = await getActiveClusterIdFromCookie();
  const activeClusterId =
    cookieId && clusters.some((c) => c.id === cookieId)
      ? cookieId
      : getDefaultActiveClusterId();

  if (!roleHasPermission(session.role, "settings.universe")) {
    return NextResponse.json({
      clusters: clusters.map((c) => ({
        id: c.id,
        name: c.name,
        apiUrl: c.apiUrl,
        health: c.health,
      })),
      activeClusterId,
    });
  }

  return NextResponse.json({ clusters, activeClusterId });
}

export async function POST(request: Request) {
  const auth = await requireClusterManage();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    name?: string;
    apiUrl?: string;
    apiToken?: string;
  };

  if (!body.apiUrl || !body.apiToken) {
    return NextResponse.json({ error: "apiUrl and apiToken required" }, { status: 400 });
  }

  try {
    const cluster = await createCluster({
      name: body.name,
      apiUrl: body.apiUrl,
      apiToken: body.apiToken,
    });
    if (listClusters().length === 1) {
      await setActiveClusterCookie(cluster.id);
    }
    return NextResponse.json({ cluster }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create cluster" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireClusterManage();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    apiUrl?: string;
    apiToken?: string;
    health?: {
      healthCheckEnabled?: boolean;
      memoryWarningPercent?: number;
      memoryCriticalPercent?: number;
      instanceOfflineThresholdSeconds?: number | null;
    };
  };

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  let healthPatch: Partial<{
    healthCheckEnabled: boolean;
    memoryWarningPercent: number;
    memoryCriticalPercent: number;
    instanceOfflineThresholdSeconds: number | null;
  }> | undefined;
  if (body.health !== undefined) {
    const validated = validateClusterHealthPatch(body.health);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    healthPatch = validated.value;

    const existing = listClusters().find((c) => c.id === body.id);
    if (existing) {
      const warn =
        healthPatch.memoryWarningPercent ?? existing.health.memoryWarningPercent;
      const crit =
        healthPatch.memoryCriticalPercent ?? existing.health.memoryCriticalPercent;
      if (warn >= crit) {
        return NextResponse.json(
          { error: "memoryWarningPercent must be less than memoryCriticalPercent" },
          { status: 400 },
        );
      }
    }
  }

  try {
    const cluster = await updateCluster(body.id, {
      name: body.name,
      apiUrl: body.apiUrl,
      apiToken: body.apiToken,
      health: healthPatch,
    });
    if (!cluster) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (healthPatch && auth.session) {
      recordActivity({
        type: "health.change",
        severity: "info",
        clusterId: cluster.id,
        clusterName: cluster.name,
        message: `Health check settings updated for ${cluster.name}`,
        actorEmail: auth.session.email,
      });
    }
    return NextResponse.json({ cluster });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireClusterManage();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (listClusters().length <= 1) {
    return NextResponse.json({ error: "Cannot delete the last cluster" }, { status: 400 });
  }

  if (!deleteCluster(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextActive = getDefaultActiveClusterId();
  if (nextActive) {
    await setActiveClusterCookie(nextActive);
  }

  return NextResponse.json({ ok: true });
}
