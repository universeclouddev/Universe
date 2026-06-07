import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { getCluster, listClusters, setActiveClusterCookie } from "@/lib/panel/clusters";
import { recordAuditFromSession } from "@/lib/panel/audit";

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const cluster = getCluster(body.id);
  if (!cluster) return NextResponse.json({ error: "Cluster not found" }, { status: 404 });

  await setActiveClusterCookie(body.id);

  recordAuditFromSession(session, {
    action: "cluster.switch",
    request,
    clusterId: cluster.id,
    clusterName: cluster.name,
  });

  return NextResponse.json({ activeClusterId: body.id, cluster });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clusters = listClusters();
  return NextResponse.json({ clusters });
}
