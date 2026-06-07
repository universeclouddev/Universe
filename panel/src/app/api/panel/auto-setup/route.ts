import { NextResponse } from "next/server";
import { runAutoSetup } from "@/lib/panel/auto-setup";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    const result = await runAutoSetup({ name: body.name });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auto setup failed" },
      { status: err instanceof Error && err.message.includes("already completed") ? 409 : 400 },
    );
  }
}

export async function GET() {
  const { discoverUniverseStatus } = await import("@/lib/panel/auto-setup");
  const universe = await discoverUniverseStatus();
  return NextResponse.json(universe);
}
