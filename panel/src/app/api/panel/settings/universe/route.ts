import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import {
  createCluster,
  getDefaultActiveClusterId,
  listClusters,
  updateCluster,
} from "@/lib/panel/clusters";

/** @deprecated Prefer /api/panel/clusters — kept for backward compatibility */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleHasPermission(session.role, "settings.universe")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeId = getDefaultActiveClusterId();
  const cluster = activeId ? listClusters().find((c) => c.id === activeId) : null;
  return NextResponse.json({
    apiUrl: cluster?.apiUrl ?? "",
    configured: !!cluster,
    hasToken: !!cluster?.hasToken,
  });
}

/** @deprecated Prefer /api/panel/clusters — updates the active cluster or creates one */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleHasPermission(session.role, "settings.universe")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { apiUrl?: string; apiToken?: string };
  if (!body.apiUrl) {
    return NextResponse.json({ error: "apiUrl required" }, { status: 400 });
  }

  const activeId = getDefaultActiveClusterId();
  try {
    if (activeId) {
      await updateCluster(activeId, {
        apiUrl: body.apiUrl,
        ...(body.apiToken ? { apiToken: body.apiToken } : {}),
      });
    } else {
      if (!body.apiToken) {
        return NextResponse.json({ error: "apiToken required" }, { status: 400 });
      }
      await createCluster({
        name: "Default",
        apiUrl: body.apiUrl,
        apiToken: body.apiToken,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 },
    );
  }
}
