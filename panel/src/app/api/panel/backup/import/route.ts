import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import { parseBackupFile, restoreBackup } from "@/lib/panel/backup";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleHasPermission(session.role, "settings.universe")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const restoreClusters = form.get("restoreClusters") !== "false";
  const restoreTemplates = form.get("restoreTemplates") === "true";
  const clusterMode = form.get("clusterMode") === "replace" ? "replace" : "merge";
  const templateClusterId = form.get("templateClusterId");
  const overwriteTemplates = form.get("overwriteTemplates") !== "false";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { manifest } = await parseBackupFile(buffer, file.name);

    const result = await restoreBackup(manifest, {
      restoreClusters,
      restoreTemplates,
      clusterMode,
      templateClusterId:
        typeof templateClusterId === "string" && templateClusterId.trim()
          ? templateClusterId.trim()
          : undefined,
      overwriteTemplates,
    });

    return NextResponse.json({
      ok: true,
      exportedAt: manifest.exportedAt,
      clusterCount: manifest.clusters.length,
      templateCount: manifest.templates.length,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Restore failed" },
      { status: 400 },
    );
  }
}
