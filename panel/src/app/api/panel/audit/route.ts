import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import { AUDIT_VIEW_PERMISSION } from "@/lib/panel/audit-shared";
import { listAuditEvents, type AuditAction } from "@/lib/panel/audit";

const VALID_ACTIONS = new Set<string>([
  "auth.login",
  "auth.login.oidc",
  "config.edit",
  "template.save",
  "cluster.switch",
  "import.configurations",
  "import.templates",
]);

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!roleHasPermission(session.role, AUDIT_VIEW_PERMISSION)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "100");
  const offset = Number(searchParams.get("offset") ?? "0");
  const clusterId = searchParams.get("clusterId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const actionParam = searchParams.get("action");
  const action =
    actionParam && VALID_ACTIONS.has(actionParam) ? (actionParam as AuditAction) : undefined;

  const { events, total } = listAuditEvents({ limit, offset, clusterId, userId, action });
  return NextResponse.json({ events, total, limit, offset });
}
