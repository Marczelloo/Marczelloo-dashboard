"use server";

import { services, auditLogs } from "@/server/atlashub";
import { requirePinVerification, getCurrentUser } from "@/server/lib/auth";
import { checkDemoModeBlocked } from "@/lib/demo-mode";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CreateServiceInput, UpdateServiceInput } from "@/types";

// ========================================
// Validation Schemas
// ========================================

const createServiceSchema = z.object({
  project_id: z.string().uuid().optional(), // Optional for standalone services
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

    console.log("[createServiceAction] Received input project_id:", input.project_id);
    const user = await requirePinVerification();
    const parsed = createServiceSchema.parse(input);
    console.log("[createServiceAction] Parsed project_id:", parsed.project_id);

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
