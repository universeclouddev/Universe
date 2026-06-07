import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission, type PanelPermission } from "@/lib/panel/permissions";
import { resolveActiveClusterConnection } from "@/lib/panel/clusters";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const forConsole = searchParams.get("for") === "console";
  const forLogs = searchParams.get("for") === "logs";

  let permission: PanelPermission = "dashboard.view";
  if (forConsole) permission = "console.use";
  if (forLogs) permission = "instances.read";

  if (!roleHasPermission(session.role, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const universe = await resolveActiveClusterConnection();
  if (!universe) {
    return NextResponse.json({ error: "No Universe cluster configured" }, { status: 503 });
  }

  return NextResponse.json({
    clusterId: universe.id,
    apiUrl: universe.apiUrl,
    token: universe.apiToken,
  });
}
