import { NextResponse } from "next/server";
import * as services from "@/server/atlashub/services";
import * as deploys from "@/server/atlashub/deploys";
import * as auditLogs from "@/server/atlashub/audit-logs";
import type { Service } from "@/types";

export async function POST() {
  const runnerUrl = process.env.RUNNER_URL || "http://127.0.0.1:8787";
  const runnerToken = process.env.RUNNER_TOKEN;
  const userEmail = process.env.DEV_USER_EMAIL || "unknown";

  if (!runnerToken) {
    return NextResponse.json({
      success: false,
      error: "RUNNER_TOKEN not configured",
    });
  }

  try {
    // Get all docker services with deploy strategy set
    const allServices = await services.getDockerServices();
    const deployableServices = allServices.filter(
      (s: Service) => s.deploy_strategy && s.deploy_strategy !== "manual" && s.repo_path
    );

    if (deployableServices.length === 0) {
      return NextResponse.json({
        success: true,
        deployed: 0,
        message: "No deployable services found",
      });
    }

    const results = await Promise.all(
      deployableServices.map(async (service: Service) => {
        try {
          // Create deploy record
          const deploy = await deploys.createDeploy({
            service_id: service.id,
            triggered_by: userEmail,
          });

          // Determine operation based on strategy
          let operation = "restart";
          if (service.deploy_strategy === "pull_rebuild" || service.deploy_strategy === "compose_up") {
            operation = "rebuild";
          }

          // Call runner
          const response = await fetch(`${runnerUrl}/execute`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${runnerToken}`,
            },
            body: JSON.stringify({
              repoPath: service.repo_path,
              composeProject: service.compose_project,
              operation,
              pullFirst: service.deploy_strategy?.startsWith("pull_"),
            }),
          });

          const result = await response.json();

          // Update deploy record
          await deploys.completeDeploy(deploy.id, result.success, { error_message: result.error });

          // Log the action
          await auditLogs.logAction(userEmail, "deploy", "service", service.id, {
            service_name: service.name,
            strategy: service.deploy_strategy,
            success: result.success,
          });

          return { serviceId: service.id, success: result.success };
        } catch (error) {
          return { serviceId: service.id, success: false, error: String(error) };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      deployed: successCount,
      failed: results.length - successCount,
      total: results.length,
    });
  } catch (error) {
    console.error("Deploy all error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
