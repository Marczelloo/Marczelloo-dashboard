import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAgentRequest } from "@/server/agent/auth";
import { getDeploymentConfig } from "@/server/deployments/config";
import { getRepositoryCloneToken } from "@/server/github/client";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ projectId: z.string().uuid() });

/** Fresh repository-scoped GitHub token for a job the agent is starting. */
export async function POST(request: NextRequest) {
  if (!isAgentRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const config = await getDeploymentConfig(parsed.data.projectId).catch(() => null);
  if (!config || config.engine !== "agent") return NextResponse.json({ error: "Project is not deployed by the agent" }, { status: 404 });

  try {
    return NextResponse.json({ token: await getRepositoryCloneToken(config.githubUrl) });
  } catch (error) {
    console.error("[agent-token] Token not issued:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Token not issued" }, { status: 503 });
  }
}
