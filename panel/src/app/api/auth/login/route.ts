import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/panel/users";
import { createSessionToken, setSessionCookie } from "@/lib/panel/session";
import { recordAuditEvent, requestClientIp } from "@/lib/panel/audit";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const user = await verifyPassword(body.email, body.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  await setSessionCookie(token);

  recordAuditEvent({
    action: "auth.login",
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    ip: requestClientIp(request),
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
