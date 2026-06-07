import { NextResponse } from "next/server";
import { needsSetup } from "@/lib/panel/users";
import { getOidcPublicConfig } from "@/lib/panel/users";
import { discoverUniverseStatus } from "@/lib/panel/auto-setup";

export async function GET() {
  const universe = await discoverUniverseStatus();
  return NextResponse.json({
    needsSetup: needsSetup(),
    oidc: getOidcPublicConfig(),
    universe,
  });
}
