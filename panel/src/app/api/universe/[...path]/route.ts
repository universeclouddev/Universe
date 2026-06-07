import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission, requiredPermissionForUniverseRoute } from "@/lib/panel/permissions";
import { resolveActiveClusterConnection } from "@/lib/panel/clusters";
import { recordProxyActivityIfApplicable } from "@/lib/panel/activity";
import { maybeAuditUniverseMutation } from "@/lib/panel/audit";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxyRequest(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  const apiPath = path.join("/");
  const permission = requiredPermissionForUniverseRoute(request.method, apiPath);

  if (permission && !roleHasPermission(session.role, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const universe = await resolveActiveClusterConnection();
  if (!universe) {
    return NextResponse.json(
      {
        error:
          "No Universe cluster configured. Ask an operator to add a cluster in Settings → Clusters.",
      },
      { status: 503 },
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(`${universe.apiUrl.replace(/\/$/, "")}/api/${apiPath}`);
  incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${universe.apiToken}`);

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
    cluster: { id: universe.id, name: universe.name },
    method: request.method,
    apiPath,
    searchParams: incoming.searchParams,
    status: upstream.status,
  });
  await maybeAuditUniverseMutation(session, request, apiPath, upstream.status, {
    id: universe.id,
    name: universe.name,
  });
  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) responseHeaders.set("Content-Type", upstreamType);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}
