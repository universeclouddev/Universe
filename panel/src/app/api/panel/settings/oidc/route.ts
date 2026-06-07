import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission, type PanelRole } from "@/lib/panel/permissions";
import { getOidcConfig, getOidcPublicConfig, setOidcConfig } from "@/lib/panel/users";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pub = getOidcPublicConfig();
  if (!roleHasPermission(session.role, "settings.oidc")) {
    return NextResponse.json({ enabled: pub.enabled });
  }

  const cfg = getOidcConfig();
  return NextResponse.json({
    enabled: cfg.enabled,
    issuer: cfg.issuer,
    clientId: cfg.clientId,
    hasClientSecret: !!cfg.clientSecret,
    defaultRole: cfg.defaultRole,
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleHasPermission(session.role, "settings.oidc")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    enabled?: boolean;
    issuer?: string;
    clientId?: string;
    clientSecret?: string;
    defaultRole?: PanelRole;
  };

  setOidcConfig({
    enabled: body.enabled ?? false,
    issuer: body.issuer ?? "",
    clientId: body.clientId ?? "",
    clientSecret: body.clientSecret,
    defaultRole: body.defaultRole ?? "viewer",
  });

  return NextResponse.json({ ok: true });
}
