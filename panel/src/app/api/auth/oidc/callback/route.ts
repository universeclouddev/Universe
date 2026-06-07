import { NextResponse } from "next/server";
import { getOidcConfig, linkOidcUser } from "@/lib/panel/users";
import { hashOidcState } from "@/lib/panel/crypto";
import { getSetting, setSetting } from "@/lib/panel/db";
import { discoverOidc } from "@/lib/panel/oidc";
import { createSessionToken, setSessionCookie } from "@/lib/panel/session";
import { recordAuditEvent, requestClientIp } from "@/lib/panel/audit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const origin = url.origin;

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?error=oidc_missing_params`);
  }

  const expected = getSetting("oidc.pending_state");
  if (!expected || expected !== hashOidcState(state)) {
    return NextResponse.redirect(`${origin}/login?error=oidc_invalid_state`);
  }
  setSetting("oidc.pending_state", "");

  const cfg = getOidcConfig();
  const discovery = await discoverOidc(cfg.issuer);
  const redirectUri = `${origin}/api/auth/oidc/callback`;

  const tokenRes = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/login?error=oidc_token_exchange`);
  }

  const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string };

  let email = "";
  let name = "";
  let subject = "";

  if (discovery.userinfo_endpoint && tokens.access_token) {
    const userRes = await fetch(discovery.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (userRes.ok) {
      const info = (await userRes.json()) as { sub?: string; email?: string; name?: string };
      subject = info.sub ?? "";
      email = info.email ?? "";
      name = info.name ?? info.email ?? "OIDC User";
    }
  }

  if (!subject && tokens.id_token) {
    const payload = JSON.parse(
      Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8"),
    ) as { sub?: string; email?: string; name?: string };
    subject = payload.sub ?? "";
    email = payload.email ?? "";
    name = payload.name ?? payload.email ?? "OIDC User";
  }

  if (!subject || !email) {
    return NextResponse.redirect(`${origin}/login?error=oidc_no_profile`);
  }

  const user = await linkOidcUser({
    subject,
    email,
    name,
    defaultRole: cfg.defaultRole,
  });

  const sessionToken = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  await setSessionCookie(sessionToken);

  recordAuditEvent({
    action: "auth.login.oidc",
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    ip: requestClientIp(request),
  });

  return NextResponse.redirect(`${origin}/dashboard`);
}
