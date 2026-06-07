import { getSetting, setSetting } from "@/lib/panel/db";

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
}

export async function discoverOidc(issuer: string): Promise<OidcDiscovery> {
  const normalized = issuer.replace(/\/$/, "");
  const cachedAuth = getSetting("oidc.auth_endpoint");
  const cachedToken = getSetting("oidc.token_endpoint");
  if (cachedAuth && cachedToken) {
    return {
      authorization_endpoint: cachedAuth,
      token_endpoint: cachedToken,
      userinfo_endpoint: getSetting("oidc.userinfo_endpoint") ?? undefined,
    };
  }

  const res = await fetch(`${normalized}/.well-known/openid-configuration`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("OIDC discovery failed");
  const json = (await res.json()) as OidcDiscovery;
  setSetting("oidc.auth_endpoint", json.authorization_endpoint);
  setSetting("oidc.token_endpoint", json.token_endpoint);
  if (json.userinfo_endpoint) setSetting("oidc.userinfo_endpoint", json.userinfo_endpoint);
  return json;
}
