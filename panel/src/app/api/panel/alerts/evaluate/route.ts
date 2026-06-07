import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import { isAlertsCronAuthorized, runAlertEvaluationOnce } from "@/lib/panel/alerts";

export async function POST(request: Request) {
  const cronOk = isAlertsCronAuthorized(request);
  if (!cronOk) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!roleHasPermission(session.role, "settings.universe")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const result = await runAlertEvaluationOnce();
  return NextResponse.json(result);
}
