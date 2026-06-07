import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission, requiredPermissionForUniverseRoute } from "@/lib/panel/permissions";
import { getClusterConnection } from "@/lib/panel/clusters";
import { recordProxyActivityIfApplicable } from "@/lib/panel/activity";
import { maybeAuditUniverseMutation } from "@/lib/panel/audit";

type RouteContext = { params: Promise<{ clusterId: string; path: string[] }> };

async function proxyToCluster(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clusterId, path } = await context.params;
  const apiPath = path.join("/");
  const permission = requiredPermissionForUniverseRoute(request.method, apiPath);

  if (permission && !roleHasPermission(session.role, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const connection = getClusterConnection(clusterId);
  if (!connection) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  const incoming = new URL(request.url);
  const target = new URL(`${connection.apiUrl.replace(/\/$/, "")}/api/${apiPath}`);
  incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${connection.apiToken}`);

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target.toString(), init);
  recordProxyActivityIfApplicable({
    session,
    cluster: { id: connection.id, name: connection.name },
    method: request.method,
    apiPath,
    searchParams: incoming.searchParams,
    status: upstream.status,
  });
  await maybeAuditUniverseMutation(session, request, apiPath, upstream.status, {
    id: connection.id,
    name: connection.name,
  });
  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) responseHeaders.set("Content-Type", upstreamType);
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) responseHeaders.set("Content-Disposition", disposition);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return proxyToCluster(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyToCluster(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return proxyToCluster(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyToCluster(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyToCluster(request, context);
}
