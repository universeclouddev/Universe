import { NextResponse } from "next/server";
import { runAutoSetup } from "@/lib/panel/auto-setup";
import { needsSetup } from "@/lib/panel/users";
import { verifyPassword } from "@/lib/panel/users";
import { createSessionToken, setSessionCookie } from "@/lib/panel/session";

/** @deprecated Use POST /api/panel/auto-setup */
export async function POST(request: Request) {
  if (!needsSetup()) {
    return NextResponse.json({ error: "Setup already completed" }, { status: 409 });
  }

  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    if (body.email && body.password) {
      const result = await runAutoSetup({ name: body.name });
      return NextResponse.json({ ok: true, ...result });
    }
    const result = await runAutoSetup({ name: body.name });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Setup failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Setup failed" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }
  const user = await verifyPassword(body.email, body.password);
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  await setSessionCookie(token);
  return NextResponse.json({ ok: true });
}
