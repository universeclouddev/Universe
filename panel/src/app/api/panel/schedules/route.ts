import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import { createSchedule, listSchedules, type ScheduleTaskType } from "@/lib/panel/schedules";

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

export async function GET() {
  const auth = await requireSchedulesRead();
  if (auth.error) return auth.error;
  return NextResponse.json({ schedules: listSchedules() });
}

export async function POST(request: Request) {
  const auth = await requireSchedulesManage();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    name?: string;
    enabled?: boolean;
    clusterId?: string;
    cron?: string;
    taskType?: ScheduleTaskType;
    payload?: Record<string, string>;
  };

  try {
    const schedule = createSchedule({
      name: body.name ?? "",
      enabled: body.enabled,
      clusterId: body.clusterId ?? "",
      cron: body.cron ?? "",
      taskType: body.taskType ?? "template_sync",
      payload: body.payload ?? {},
    });
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create schedule" },
      { status: 400 },
    );
  }
}
