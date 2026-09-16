import { NextRequest, NextResponse } from "next/server";
import { appImport } from "@/server/atlashub";
import { services } from "@/server/data";
import { getDeploymentConfig } from "@/server/deployments";
import { versionFile, versionKeyCount } from "@/server/env/file-versions";
import { AuthError, requireAuth } from "@/server/lib/auth";
import { isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

/** Version history of the project's env files: names and counts only, never values. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (isDemoMode()) return NextResponse.json({ success: true, agent: false, versions: [] });
    await requireAuth();
    const { id } = await params;
    const service = await services.getServiceById(id);
    if (!service?.project_id) return NextResponse.json({ success: false, error: "Nie znaleziono serwisu." }, { status: 404 });
    const config = await getDeploymentConfig(service.project_id);
    const versions = (await appImport.listEnvVersions(service.project_id)).map((row) => ({
      version: row.version,
      file: versionFile(row),
      keyCount: versionKeyCount(row),
      note: row.note,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
    return NextResponse.json({ success: true, agent: config?.engine === "agent", versions });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Nie udało się odczytać historii." }, { status: 500 });
  }
}
