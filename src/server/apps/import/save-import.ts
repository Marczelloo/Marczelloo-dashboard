import "server-only";

import { appImport, auditLogs } from "@/server/atlashub";
import type { InventorySnapshot } from "../types";
import { buildAppConfigRow, buildRouteRows, envFingerprint, envKeysMetadata, envPayload, selectEnvEntries } from "./persist-rows";
import type { ImportProposal } from "./proposal";

export interface ImportDecision {
  composeProject: string;
  projectId: string | null;
  includeKeys: string[];
}

export interface SaveImportResult {
  stacks: Array<{ composeProject: string; projectId: string | null; configCreated: boolean | null; envVersion: number | null; envKeys: number; envUnchanged: boolean }>;
  routes: number;
}

export async function saveImport(proposal: ImportProposal, snapshot: InventorySnapshot, decisions: ImportDecision[], actorEmail: string): Promise<SaveImportResult> {
  const now = new Date().toISOString();
  const result: SaveImportResult = { stacks: [], routes: 0 };

  for (const decision of decisions) {
    const stack = proposal.stacks.find((candidate) => candidate.composeProject === decision.composeProject);
    if (!stack) throw new Error(`Stack ${decision.composeProject} nie należy do tego skanu.`);
    if (!decision.projectId) {
      result.stacks.push({ composeProject: stack.composeProject, projectId: null, configCreated: null, envVersion: null, envKeys: 0, envUnchanged: false });
      continue;
    }

    const config = await appImport.upsertAppConfig(buildAppConfigRow(stack, decision.projectId, now));
    const entries = selectEnvEntries(stack.env, decision.includeKeys);
    const payload = envPayload(entries);
    const fingerprint = envFingerprint(payload);
    const latest = await appImport.getLatestEnvVersion(decision.projectId);
    const envUnchanged = latest?.fingerprint === fingerprint;
    const envVersion = envUnchanged ? latest!.version : (latest?.version ?? 0) + 1;

    if (!envUnchanged) {
      await appImport.insertEnvVersion({
        projectId: decision.projectId,
        version: envVersion,
        keys: envKeysMetadata(entries),
        payload,
        fingerprint,
        note: `Import ze skanu ${proposal.capturedAt}`,
        createdBy: actorEmail,
      });
    }

    const stackSnapshot = snapshot.stacks.find((candidate) => candidate.project === stack.composeProject);
    await appImport.insertSnapshot({ projectId: decision.projectId, kind: "stack-inspect", payload: { capturedAt: snapshot.capturedAt, containers: stackSnapshot?.containers ?? [], imageEnv: snapshot.imageEnv } });

    result.stacks.push({ composeProject: stack.composeProject, projectId: decision.projectId, configCreated: config.created, envVersion, envKeys: entries.length, envUnchanged });
  }

  const overrides = new Map(decisions.map((decision) => [decision.composeProject, decision.projectId]));
  if (!proposal.ingressError) {
    result.routes = await appImport.replaceImportedRoutes(buildRouteRows(proposal.routes, overrides, now));
    await appImport.insertSnapshot({ projectId: null, kind: "ingress", payload: { capturedAt: snapshot.capturedAt, rules: snapshot.ingress.rules } });
  }

  await auditLogs.logAction(actorEmail, "import", "project", undefined, {
    stage: 1,
    proposal_id: proposal.id,
    stacks: result.stacks.map(({ composeProject, projectId, envVersion, envKeys, envUnchanged }) => ({ composeProject, projectId, envVersion, envKeys, envUnchanged })),
    routes: result.routes,
  });

  return result;
}
