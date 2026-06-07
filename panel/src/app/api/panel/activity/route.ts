import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import {
  listActivityEvents,
  type ActivitySeverity,
  type ActivityType,
} from "@/lib/panel/activity";

const VALID_SEVERITIES = new Set<ActivitySeverity>(["info", "success", "warning", "error"]);
const VALID_TYPES = new Set<ActivityType>([
  "instance.lifecycle",
  "import.templates",
  "import.configurations",
  "config.save",
  "health.change",
]);

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!roleHasPermission(session.role, "dashboard.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const clusterId = searchParams.get("clusterId") ?? undefined;
  const severityParam = searchParams.get("severity");
  const typeParam = searchParams.get("type");
  const limitParam = searchParams.get("limit");

  const severity =
    severityParam && VALID_SEVERITIES.has(severityParam as ActivitySeverity)
      ? (severityParam as ActivitySeverity)
      : undefined;
  const type =
    typeParam && VALID_TYPES.has(typeParam as ActivityType)
      ? (typeParam as ActivityType)
      : undefined;

  let limit = 100;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 500);
    }
  }

  const events = listActivityEvents({ clusterId, severity, type, limit });
  return NextResponse.json({ events, total: events.length });
}
