import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import type { AgentActivity } from "@/lib/agent-activity";
import { getAgentStatus, isAgentConfigured } from "@/server/agent/client";
import { SELF_COMPOSE_PROJECT } from "@/server/deployments/compose-stack";
import { demoAgentStatus } from "@/server/demo/host";
import { AuthError, requireAuth } from "@/server/lib/auth";

export const dynamic = "force-dynamic";

/** Running and finished jobs per project, read from the agent only; no database query behind it. */
export async function GET() {
  try {
    await requireAuth();
    if (!isDemoMode() && !isAgentConfigured()) return NextResponse.json({ projects: {}, selfProject: null } satisfies AgentActivity);
    const status = isDemoMode() ? demoAgentStatus() : await getAgentStatus();
    const projects: AgentActivity["projects"] = {};
    for (const [name, project] of Object.entries(status.projects)) {
      projects[name] = { active: project.activeJob?.kind ?? null, step: project.activeJob?.step ?? null, lastFinishedAt: project.lastFinishedAt };
    }
    return NextResponse.json({ projects, selfProject: SELF_COMPOSE_PROJECT } satisfies AgentActivity);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.code === "NOT_AUTHORIZED" ? 403 : 401 });
    return NextResponse.json({ error: "The agent did not answer" }, { status: 503 });
  }
}
