"use server";

import { services, auditLogs, deploys } from "@/server/atlashub";
import { requirePinVerification, getCurrentUser } from "@/server/lib/auth";
import { checkDemoModeBlocked } from "@/lib/demo-mode";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as runner from "@/server/runner";
import * as notifications from "@/server/notifications";
import type { CreateServiceInput, UpdateServiceInput } from "@/types";

// ========================================
// Validation Schemas
// ========================================

const createServiceSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["docker", "vercel", "external"]),
  url: z.string().url().optional().or(z.literal("")),
  health_url: z.string().url().optional().or(z.literal("")),
  portainer_endpoint_id: z.number().optional(),
  container_id: z.string().optional(),
  stack_id: z.number().optional(),
  repo_path: z.string().optional(),
  compose_project: z.string().optional(),
  deploy_strategy: z.enum(["pull_restart", "pull_rebuild", "compose_up", "manual"]).optional(),
});

const updateServiceSchema = createServiceSchema.partial().omit({ project_id: true });

// ========================================
// Service CRUD Actions
// ========================================

export async function createServiceAction(input: CreateServiceInput) {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();
    const parsed = createServiceSchema.parse(input);

    const service = await services.createService(parsed);

    await auditLogs.logAction(user.email, "create", "service", service.id, { name: service.name, type: service.type });

    revalidatePath(`/projects/${parsed.project_id}`);
    revalidatePath("/services");
    revalidatePath("/dashboard");

    return { success: true as const, data: { id: service.id } };
  } catch (error) {
    console.error("createServiceAction error:", error);
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.errors[0].message };
    }
    // Return error code for AuthError
    if (error instanceof Error && error.name === "AuthError") {
      const authError = error as unknown as { code: string };
      return { success: false as const, error: error.message, code: authError.code };
    }
    return { success: false as const, error: "Failed to create service" };
  }
}

export async function updateServiceAction(id: string, input: UpdateServiceInput) {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();
    const parsed = updateServiceSchema.parse(input);

    const service = await services.updateService(id, parsed);

    if (!service) {
      return { success: false as const, error: "Service not found" };
    }

    await auditLogs.logAction(user.email, "update", "service", id, parsed);

    revalidatePath(`/projects/${service.project_id}`);
    revalidatePath(`/services/${id}`);
    revalidatePath("/services");

    return { success: true as const };
  } catch (error) {
    console.error("updateServiceAction error:", error);
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.errors[0].message };
    }
    return { success: false as const, error: "Failed to update service" };
  }
}

export async function deleteServiceAction(id: string) {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    const service = await services.getServiceById(id);
    if (!service) {
      return { success: false as const, error: "Service not found" };
    }

    const deleted = await services.deleteService(id);

    if (!deleted) {
      return { success: false as const, error: "Failed to delete service" };
    }

    await auditLogs.logAction(user.email, "delete", "service", id);

    revalidatePath(`/projects/${service.project_id}`);
    revalidatePath("/services");
    revalidatePath("/dashboard");

    return { success: true as const };
  } catch (error) {
    console.error("deleteServiceAction error:", error);
    return { success: false as const, error: "Failed to delete service" };
  }
}

// ========================================
// Deploy Actions
// ========================================

export async function deployServiceAction(serviceId: string) {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    const service = await services.getServiceById(serviceId);
    if (!service) {
      return { success: false as const, error: "Service not found" };
    }

    if (service.type !== "docker") {
      return { success: false as const, error: "Only Docker services can be deployed" };
    }

    if (!service.repo_path || !service.compose_project) {
      return { success: false as const, error: "Service is not configured for deployment" };
    }

    if (service.deploy_strategy === "manual") {
      return { success: false as const, error: "This service requires manual deployment" };
    }

    // Create deploy record
    const deploy = await deploys.createDeploy({
      service_id: serviceId,
      triggered_by: user.email,
    });

    // Notify deploy started
    await notifications.notifyDeployStarted(service.name, user.email);

    // Start deploy
    await deploys.startDeploy(deploy.id);

    await auditLogs.logAction(user.email, "deploy", "service", serviceId, {
      deploy_id: deploy.id,
    });

    // Execute deployment
    const result = await runner.deploy(service.repo_path, service.compose_project, service.deploy_strategy);

    // Complete deploy record
    await deploys.completeDeploy(deploy.id, result.success, {
      commit_sha: result.commit_sha,
      error_message: result.error,
    });

    // Send notification
    if (result.success) {
      await notifications.notifyDeploySuccess(service.name, result.commit_sha);
    } else {
      await notifications.notifyDeployFailed(service.name, result.error || "Unknown error");
    }

    revalidatePath(`/services/${serviceId}`);
    revalidatePath("/dashboard");

    return {
      success: result.success as true,
      data: {
        deploy_id: deploy.id,
        commit_sha: result.commit_sha,
      },
      error: result.error,
    };
  } catch (error) {
    console.error("deployServiceAction error:", error);
    return { success: false as const, error: "Deployment failed" };
  }
}

// ========================================
// Read Actions
// ========================================

export async function getServicesAction() {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Not authenticated" };
  }

  const data = await services.getServices();
  return { success: true as const, data };
}

export async function getServiceByIdAction(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Not authenticated" };
  }

  const data = await services.getServiceById(id);
  if (!data) {
    return { success: false as const, error: "Service not found" };
  }

  return { success: true as const, data };
}
