import { NextResponse } from "next/server";
import { tickScheduleRunner } from "@/lib/panel/schedules";

export async function POST() {
  const results = await tickScheduleRunner();
  return NextResponse.json({ ran: results.length, results });
}

export async function GET() {
  return NextResponse.json({ ok: true, intervalMs: 60_000 });
}
