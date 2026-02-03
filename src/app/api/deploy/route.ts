import { NextResponse } from "next/server";
import * as services from "@/server/atlashub/services";
import * as deploys from "@/server/atlashub/deploys";
import * as auditLogs from "@/server/atlashub/audit-logs";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

export async function POST(request: Request) {
  const userEmail = process.env.DEV_USER_EMAIL || "unknown";

  if (!RUNNER_TOKEN) {
    return NextResponse.json(
      {
        success: false,
        error: "RUNNER_TOKEN not configured",
      },
      { status: 500 }
    );
  }

  try {
    const { serviceId, strategy } = await request.json();

    if (!serviceId) {
      return NextResponse.json(
        {
          success: false,
          error: "serviceId is required",
        },
        { status: 400 }
      );
    }

    // Get service details
    const service = await services.getServiceById(serviceId);

    if (!service) {
      return NextResponse.json(
        {
          success: false,
          error: "Service not found",
        },
        { status: 404 }
      );
    }

    if (service.type !== "docker") {
      return NextResponse.json(
        {
          success: false,
          error: "Only docker services can be deployed",
        },
        { status: 400 }
      );
    }

    if (!service.repo_path) {
      return NextResponse.json(
        {
          success: false,
          error: "Service has no repo_path configured",
        },
        { status: 400 }
      );
    }

    // Create deploy record
    const deploy = await deploys.createDeploy({
      service_id: service.id,
      triggered_by: userEmail,
    });

    // Determine operation based on strategy
    const deployStrategy = strategy || service.deploy_strategy || "pull_restart";
    let operation = "restart";
    if (deployStrategy === "pull_rebuild" || deployStrategy === "compose_up") {
      operation = "rebuild";
    }

    // Call runner
    const response = await fetch(`${RUNNER_URL}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        repoPath: service.repo_path,
        composeProject: service.compose_project,
        operation,
        pullFirst: deployStrategy.startsWith("pull_"),
      }),
    });

    const result = await response.json();

    // Update deploy record
    await deploys.completeDeploy(deploy.id, result.success, { error_message: result.error });

    // Log the action
    await auditLogs.logAction(userEmail, "deploy", "service", service.id, {
      service_name: service.name,
      strategy: deployStrategy,
      success: result.success,
    });

    return NextResponse.json({
      success: result.success,
      message: result.success ? "Deploy completed successfully" : result.error || "Deploy failed",
      deployId: deploy.id,
    });
  } catch (error) {
    console.error("Deploy error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
