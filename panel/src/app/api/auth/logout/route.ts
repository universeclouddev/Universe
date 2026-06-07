import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/panel/session";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
