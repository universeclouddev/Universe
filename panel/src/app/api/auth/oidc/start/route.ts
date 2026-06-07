import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getOidcConfig, linkOidcUser } from "@/lib/panel/users";
import { hashOidcState } from "@/lib/panel/crypto";
import { setSetting, getSetting } from "@/lib/panel/db";
import { discoverOidc } from "@/lib/panel/oidc";

export async function GET(request: Request) {
  const cfg = getOidcConfig();
  if (!cfg.enabled || !cfg.issuer || !cfg.clientId) {
    return NextResponse.json({ error: "OIDC not configured" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/oidc/callback`;
  const state = randomBytes(24).toString("hex");
  setSetting("oidc.pending_state", hashOidcState(state));

  const discovery = await discoverOidc(cfg.issuer);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: redirectUri,
    state,
  });

  return NextResponse.redirect(`${discovery.authorization_endpoint}?${params}`);
}
