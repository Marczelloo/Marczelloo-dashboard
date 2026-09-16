"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/projects";
import { collectInventory } from "@/server/apps/collector";
import { ENV_KEY } from "@/server/apps/import/env-plan";
import { buildImportProposal, toProposalView, type ImportProposalView } from "@/server/apps/import/proposal";
import { saveImport, type SaveImportResult } from "@/server/apps/import/save-import";
import { storeProposal, takeProposal } from "@/server/apps/proposal-store";
import { envVars, projects, services } from "@/server/atlashub";
import { select } from "@/server/atlashub/client";
import { AuthError, requirePinVerification } from "@/server/lib/auth";
import { decrypt } from "@/server/lib/encryption";
import { checkDemoModeBlocked } from "@/lib/demo-mode";

type Result<T> = ActionResult<T> & { code?: string };

function failure(error: unknown): Result<never> {
  if (error instanceof AuthError) return { success: false, error: error.message, code: error.code };
  return { success: false, error: error instanceof Error ? error.message : "Nieoczekiwany błąd importu." };
}

async function loadLegacyEnv(serviceRows: Awaited<ReturnType<typeof services.getServices>>) {
  const projectByService = new Map(serviceRows.map((service) => [service.id, service.project_id]));
  const rows = await envVars.getEnvVars({ limit: 1000 });
  const legacy: Array<{ projectId: string; key: string; value: string }> = [];
  for (const row of rows) {
    const projectId = projectByService.get(row.service_id);
    if (!projectId) continue;
    try {
      legacy.push({ projectId, key: row.key, value: await decrypt(row.value_encrypted) });
    } catch {
      // A value encrypted with a rotated key is not a usable hint.
    }
  }
  return legacy;
}

async function loadDeploymentConfigs() {
  const response = await select<{ key: string; value: string }>("settings", { filters: [{ operator: "like", column: "key", value: "deployment-config:%" }], limit: 200 });
  return response.data.flatMap((row) => {
    try {
      const value = JSON.parse(row.value) as { projectId?: string; composeProject?: string };
      return value.projectId && value.composeProject ? [{ projectId: value.projectId, composeProject: value.composeProject }] : [];
    } catch {
      return [];
    }
  });
}

export async function scanInventoryAction(): Promise<Result<ImportProposalView>> {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return demo.result;
    await requirePinVerification();

    // AtlasHub returns 100 rows by default; ask for the maximum explicitly.
    const [snapshot, projectRows, serviceRows, deploymentConfigs] = await Promise.all([
      collectInventory(),
      projects.getProjects({ limit: 1000 }),
      services.getServices({ limit: 1000 }),
      loadDeploymentConfigs(),
    ]);
    const legacyEnv = await loadLegacyEnv(serviceRows);
    const proposal = buildImportProposal({ snapshot, projects: projectRows, services: serviceRows, legacyEnv, deploymentConfigs });
    storeProposal(proposal, snapshot);
    return { success: true, data: toProposalView(proposal, projectRows) };
  } catch (error) {
    return failure(error);
  }
}

const saveSchema = z.object({
  proposalId: z.string().uuid(),
  decisions: z
    .array(
      z.object({
        composeProject: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/),
        projectId: z.string().uuid().nullable(),
        includeKeys: z.array(z.string().regex(ENV_KEY, "Nieprawidłowa nazwa zmiennej")).max(500),
      })
    )
    .min(1)
    .max(50),
});

export async function saveImportAction(input: z.input<typeof saveSchema>): Promise<Result<SaveImportResult>> {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return demo.result;
    const user = await requirePinVerification();
    const parsed = saveSchema.parse(input);

    const stored = takeProposal(parsed.proposalId);
    if (!stored) return { success: false, error: "Skan wygasł albo serwer został zrestartowany — uruchom skanowanie ponownie." };

    const knownProjects = new Set((await projects.getProjects({ limit: 1000 })).map((project) => project.id));
    const unknown = parsed.decisions.find((decision) => decision.projectId && !knownProjects.has(decision.projectId));
    if (unknown) return { success: false, error: `Wybrany projekt dla ${unknown.composeProject} nie istnieje.` };
    const duplicated = parsed.decisions.map((decision) => decision.projectId).filter((id, index, all) => id && all.indexOf(id) !== index);
    if (duplicated.length) return { success: false, error: "Ten sam projekt przypisano do więcej niż jednego stacka." };

    const data = await saveImport(stored.proposal, stored.snapshot, parsed.decisions, user.email);
    revalidatePath("/import");
    return { success: true, data };
  } catch (error) {
    return failure(error);
  }
}
