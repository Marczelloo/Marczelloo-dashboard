import { NextResponse } from "next/server";
import * as services from "@/server/atlashub/services";
import * as deploys from "@/server/atlashub/deploys";
import * as auditLogs from "@/server/atlashub/audit-logs";
import { AuthError, requirePinVerification } from "@/server/lib/auth";
import * as runner from "@/server/runner";

export async function POST(request: Request) {
  let deployId: string | undefined;
  try {
    const user = await requirePinVerification();
    const body = await request.json();
    const { serviceId, strategy } = body as {
      serviceId?: string;
      strategy?: "pull_restart" | "pull_rebuild" | "compose_up";
    };

    if (strategy && !["pull_restart", "pull_rebuild", "compose_up"].includes(strategy)) {
      return NextResponse.json({ success: false, error: "Invalid deploy strategy" }, { status: 400 });
    }

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

    if (!service.repo_path || !service.compose_project) {
      return NextResponse.json(
        {
          success: false,
          error: "Service is missing repo_path or compose_project",
        },
        { status: 400 }
      );
    }

    if (service.deploy_strategy === "manual") {
      return NextResponse.json({ success: false, error: "This service requires manual deployment" }, { status: 400 });
    }

    // Create deploy record
    const deploy = await deploys.createDeploy({
      service_id: service.id,
      triggered_by: user.email,
    });
    deployId = deploy.id;
    await deploys.startDeploy(deploy.id);

    const deployStrategy = strategy || service.deploy_strategy || "pull_restart";
    const result = await runner.deploy(service.repo_path, service.compose_project, deployStrategy);

    // Update deploy record
    await deploys.completeDeploy(deploy.id, result.success, {
      commit_sha: result.commit_sha,
      error_message: result.error,
    });

    // Log the action
    await auditLogs.logAction(user.email, "deploy", "service", service.id, {
      service_name: service.name,
      strategy: deployStrategy,
      success: result.success,
    });

    return NextResponse.json({
      success: result.success,
      message: result.success ? "Deploy completed successfully" : result.error || "Deploy failed",
      deployId: deploy.id,
      commitSha: result.commit_sha,
      steps: result.steps,
    });
  } catch (error) {
    console.error("Deploy error:", error);

    if (deployId) {
      await deploys.completeDeploy(deployId, false, {
        error_message: error instanceof Error ? error.message : "Unknown error",
      }).catch((completionError) => console.error("Failed to mark deploy as failed:", completionError));
    }

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === "PIN_REQUIRED" ? 403 : 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
