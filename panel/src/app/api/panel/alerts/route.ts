import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import {
  createAlertWebhook,
  deleteAlertWebhook,
  getAlertsConfig,
  updateAlertWebhook,
  updateAlertsConfig,
} from "@/lib/panel/alerts";

async function requireAlertsManage() {
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
  if (!roleHasPermission(session.role, "settings.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(getAlertsConfig());
}

export async function PUT(request: Request) {
  const auth = await requireAlertsManage();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    enabled?: boolean;
    pollIntervalSeconds?: number;
    cooldownMinutes?: number;
  };

  try {
    const config = updateAlertsConfig(body);
    return NextResponse.json(config);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAlertsManage();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    name?: string;
    url?: string;
    type?: "discord" | "generic";
    enabled?: boolean;
    clusterIds?: string[] | null;
    minLevel?: "warning" | "critical";
    notifyOnRecovery?: boolean;
  };

  if (!body.name?.trim() || !body.url?.trim()) {
    return NextResponse.json({ error: "name and url are required" }, { status: 400 });
  }

  try {
    const webhook = createAlertWebhook({
      name: body.name,
      url: body.url,
      type: body.type,
      enabled: body.enabled,
      clusterIds: body.clusterIds,
      minLevel: body.minLevel,
      notifyOnRecovery: body.notifyOnRecovery,
    });
    return NextResponse.json({ webhook }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAlertsManage();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    url?: string;
    type?: "discord" | "generic";
    enabled?: boolean;
    clusterIds?: string[] | null;
    minLevel?: "warning" | "critical";
    notifyOnRecovery?: boolean;
  };

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const webhook = updateAlertWebhook(body.id, body);
    if (!webhook) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ webhook });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAlertsManage();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (!deleteAlertWebhook(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
