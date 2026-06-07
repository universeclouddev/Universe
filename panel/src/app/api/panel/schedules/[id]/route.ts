import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import {
  deleteSchedule,
  getSchedule,
  updateSchedule,
  type ScheduleTaskType,
} from "@/lib/panel/schedules";

type RouteContext = { params: Promise<{ id: string }> };

async function requireSchedulesRead() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!roleHasPermission(session.role, "schedules.read")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

async function requireSchedulesManage() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!roleHasPermission(session.role, "schedules.manage")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSchedulesRead();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const schedule = getSchedule(id);
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ schedule });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSchedulesManage();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    enabled?: boolean;
    clusterId?: string;
    cron?: string;
    taskType?: ScheduleTaskType;
    payload?: Record<string, string>;
  };

  try {
    const schedule = updateSchedule(id, body);
    if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ schedule });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update schedule" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireSchedulesManage();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!deleteSchedule(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
