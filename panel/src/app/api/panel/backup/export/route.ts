import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import {
  backupFilename,
  buildBackupManifest,
  manifestToJson,
  manifestToZip,
} from "@/lib/panel/backup";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleHasPermission(session.role, "settings.universe")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "zip" ? "zip" : "json";
  const includeTemplates = searchParams.get("includeTemplates") !== "false";

  try {
    const manifest = await buildBackupManifest({ includeTemplates });
    const filename = backupFilename(format, manifest.exportedAt);

    if (format === "zip") {
      const zip = await manifestToZip(manifest);
      return new NextResponse(new Uint8Array(zip), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const json = await manifestToJson(manifest);
    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 },
    );
  }
}
