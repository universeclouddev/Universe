import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import { getAlertsRow, sendTestWebhook } from "@/lib/panel/alerts";
import { decryptSecret } from "@/lib/panel/crypto";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleHasPermission(session.role, "settings.universe")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    url?: string;
    type?: "discord" | "generic";
    clusterName?: string;
  };

  let url = body.url?.trim() ?? "";
  let type = body.type;

  if (!url && body.id) {
    const webhook = getAlertsRow().webhooks.find((w) => w.id === body.id);
    if (!webhook) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    try {
      url = decryptSecret(webhook.url);
      type = type ?? webhook.type;
    } catch {
      return NextResponse.json({ error: "Webhook URL unavailable" }, { status: 400 });
    }
  }

  if (!url) {
    return NextResponse.json({ error: "url or id required" }, { status: 400 });
  }

  try {
    await sendTestWebhook({
      url,
      type,
      clusterName: body.clusterName,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test failed" },
      { status: 400 },
    );
  }
}
