import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import {
  getActiveClusterIdFromCookie,
  getDefaultActiveClusterId,
  hasAnyCluster,
  listClusters,
} from "@/lib/panel/clusters";
import { getOidcPublicConfig, resolveEffectiveRole } from "@/lib/panel/users";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const clusters = listClusters();
  const cookieId = await getActiveClusterIdFromCookie();
  const activeClusterId =
    cookieId && clusters.some((c) => c.id === cookieId)
      ? cookieId
      : getDefaultActiveClusterId();
  const activeCluster = clusters.find((c) => c.id === activeClusterId) ?? null;

  const role = resolveEffectiveRole(session.sub, session.role);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.sub,
      email: session.email,
      name: session.name,
      role,
    },
    clusters: clusters.map((c) => ({
      id: c.id,
      name: c.name,
      apiUrl: c.apiUrl,
    })),
    activeClusterId,
    activeCluster,
    activeClusterHealth: activeCluster?.health ?? null,
    universe: {
      configured: hasAnyCluster(),
      apiUrl: activeCluster?.apiUrl ?? null,
    },
    oidc: getOidcPublicConfig(),
  });
}
