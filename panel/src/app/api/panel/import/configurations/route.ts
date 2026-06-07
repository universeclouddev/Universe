import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import { getClusterConnection, resolveActiveClusterConnection } from "@/lib/panel/clusters";
import { fetchClusterApi, readClusterApiJson } from "@/lib/panel/cluster-proxy";
import { recordAuditFromSession } from "@/lib/panel/audit";
import type { Configuration } from "@/lib/api/types";
import { recordActivity } from "@/lib/panel/activity";

interface ImportConfigurationsBody {
  sourceClusterId: string;
  destinationClusterId?: string;
  names: string[];
  overwrite?: boolean;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!roleHasPermission(session.role, "configurations.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ImportConfigurationsBody;
  try {
    body = (await request.json()) as ImportConfigurationsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sourceClusterId, names, overwrite = true } = body;
  if (!sourceClusterId || !names?.length) {
    return NextResponse.json({ error: "sourceClusterId and names are required" }, { status: 400 });
  }

  if (!getClusterConnection(sourceClusterId)) {
    return NextResponse.json({ error: "Source cluster not found" }, { status: 404 });
  }

  const destination =
    body.destinationClusterId != null
      ? getClusterConnection(body.destinationClusterId)
      : await resolveActiveClusterConnection();

  if (!destination) {
    return NextResponse.json({ error: "Destination cluster not configured" }, { status: 503 });
  }

  const results: { name: string; ok: boolean; error?: string }[] = [];

  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) {
      results.push({ name: rawName, ok: false, error: "Invalid name" });
      continue;
    }

    try {
      if (!overwrite) {
        const existing = await fetchClusterApi(destination.id, `configurations/${encodeURIComponent(name)}`, {
          method: "GET",
        });
        if (existing.ok) {
          results.push({ name, ok: false, error: "Already exists on destination" });
          continue;
        }
      }

      const config = await readClusterApiJson<Configuration>(
        sourceClusterId,
        `configurations/${encodeURIComponent(name)}`,
      );

      const saveResponse = await fetch(
        `${destination.apiUrl.replace(/\/$/, "")}/api/configurations/${encodeURIComponent(name)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${destination.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...config, name }),
        },
      );

      if (!saveResponse.ok) {
        let message = saveResponse.statusText;
        try {
          const errBody = (await saveResponse.json()) as { error?: string };
          message = errBody.error ?? message;
        } catch {
          // ignore
        }
        results.push({ name, ok: false, error: message });
        continue;
      }

      results.push({ name, ok: true });
    } catch (err) {
      results.push({
        name,
        ok: false,
        error: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length === results.length) {
    return NextResponse.json({ results, error: "All imports failed" }, { status: 502 });
  }

  const imported = results.filter((r) => r.ok);
  recordActivity({
    type: "import.configurations",
    severity: failed.length > 0 ? "warning" : "success",
    clusterId: destination.id,
    clusterName: destination.name,
    message: `Imported ${imported.length} configuration(s) from ${getClusterConnection(sourceClusterId)?.name ?? sourceClusterId}`,
    actorEmail: session.email,
    metadata: {
      sourceClusterId,
      imported: imported.length,
      failed: failed.length,
    },
  });

  recordAuditFromSession(session, {
    action: "import.configurations",
    request,
    clusterId: destination.id,
    clusterName: destination.name,
    details: {
      sourceClusterId,
      count: imported.length,
      names: names.join(", "),
    },
  });

  return NextResponse.json({
    results,
    imported: results.filter((r) => r.ok).length,
    failed: failed.length,
  });
}
