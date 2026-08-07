import { NextResponse } from "next/server";
import * as services from "@/server/atlashub/services";
import * as deploys from "@/server/atlashub/deploys";
import * as auditLogs from "@/server/atlashub/audit-logs";
import type { Service } from "@/types";
import { AuthError, requirePinVerification } from "@/server/lib/auth";
import * as runner from "@/server/runner";

export async function POST() {
  try {
    const user = await requirePinVerification();
    // Get all docker services with deploy strategy set
    const allServices = await services.getDockerServices();
    const deployableServices = allServices.filter(
      (s: Service) => s.deploy_strategy && s.deploy_strategy !== "manual" && s.repo_path && s.compose_project
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
        let deployId: string | undefined;
        try {
          // Create deploy record
          const deploy = await deploys.createDeploy({
            service_id: service.id,
            triggered_by: user.email,
          });
          deployId = deploy.id;
          await deploys.startDeploy(deploy.id);

          if (!service.repo_path || !service.compose_project) {
            throw new Error("Service is missing repo_path or compose_project");
          }

          if (service.deploy_strategy === "manual" || !service.deploy_strategy) {
            throw new Error("Service has no deploy strategy configured");
          }

          const result = await runner.deploy(service.repo_path, service.compose_project, service.deploy_strategy);

          // Update deploy record
          await deploys.completeDeploy(deploy.id, result.success, {
            commit_sha: result.commit_sha,
            error_message: result.error,
          });

          // Log the action
          await auditLogs.logAction(user.email, "deploy", "service", service.id, {
            service_name: service.name,
            strategy: service.deploy_strategy,
            success: result.success,
          });

          return { serviceId: service.id, serviceName: service.name, success: result.success, error: result.error };
        } catch (error) {
          if (deployId) {
            await deploys.completeDeploy(deployId, false, {
              error_message: error instanceof Error ? error.message : "Unknown error",
            }).catch((completionError) => console.error("Failed to mark deploy as failed:", completionError));
          }
          return { serviceId: service.id, success: false, error: String(error) };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    return NextResponse.json({
      success: failedCount === 0,
      deployed: successCount,
      failed: failedCount,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("Deploy all error:", error);
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
