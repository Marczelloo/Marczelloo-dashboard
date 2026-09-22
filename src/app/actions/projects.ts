"use server";

import { projects, auditLogs, services, workItems, deploys } from "@/server/data";
import { AuthError, requirePinVerification, requireAuth, getCurrentUser } from "@/server/lib/auth";
import { checkDemoModeBlocked, isDemoMode } from "@/lib/demo-mode";
import {
  createRelease,
  generateReleaseNotes,
  isGitHubConfigured,
  getLatestRelease,
  listRepositories,
} from "@/server/github";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CreateProjectInput, UpdateProjectInput } from "@/types";
import { validateRepoPath } from "@/server/deployments/paths";
import {
  allocateDeploymentPort,
  deleteDeploymentConfig,
  edgeSettings,
  getDeploymentConfig,
  listCloudflareTunnelRoutes,
  parseLocalPortFromService,
  preflightDeployment,
  saveDeploymentConfig,
  updateCloudflareTunnelRoute,
  type DeploymentConfig,
  type DeploymentExposure,
  type DeploymentRuntime,
} from "@/server/deployments";
import { queueAgentDeployment, readAgentDeployLog } from "@/server/agent/deploy";
import { isAgentConfigured } from "@/server/agent/client";
import { hostnameConflict } from "@/server/deployments/hostname-guard";
import { parseContainerService } from "@/server/deployments/edge";
import { validateBuildSpec, type BuildSpec } from "@/server/deployments/detect";
import { agentLogRef, parseAgentLogRef } from "@/server/agent/refs";

// ========================================
// Validation Schemas
// ========================================

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  description: z.string().max(500).optional(),
  status: z.enum(["active", "inactive", "archived", "maintenance"]).optional(),
  tags: z.array(z.string()).optional(),
  github_url: z.string().url().optional().or(z.literal("")),
  prod_url: z.string().url().optional().or(z.literal("")),
  vercel_url: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(10000).optional(),
});

const updateProjectSchema = createProjectSchema.partial();

// ========================================
// Types
// ========================================

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

const nullableText = (max: number) => z.string().max(max).nullable();
const buildSpecSchema = z
  .object({
    kind: z.enum(["compose", "dockerfile", "node", "static", "python"]),
    framework: nullableText(40),
    packageManager: z.enum(["npm", "pnpm", "yarn", "bun"]).nullable(),
    port: z.number().int().min(1).max(65535).nullable(),
    installCommand: nullableText(300),
    buildCommand: nullableText(300),
    startCommand: nullableText(300),
    outputDir: nullableText(200),
    dockerfile: nullableText(200),
    composeFile: nullableText(200),
  })
  .superRefine((spec, context) => {
    for (const message of validateBuildSpec(spec)) context.addIssue({ code: z.ZodIssueCode.custom, message });
  });

/** A build spec of kind "compose" is the default path and is not stored. */
function generatedBuild(spec: BuildSpec | null | undefined): BuildSpec | null {
  return spec && spec.kind !== "compose" ? spec : null;
}

const deploymentSetupFields = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).max(20).default([]),
  technologies: z.array(z.string()).max(20).default([]),
  githubUrl: z.string().url().refine((value) => /^(https:\/\/github\.com\/|git@github\.com:)/i.test(value), "Repository must be hosted on GitHub"),
  branch: z.string().min(1).max(120).regex(/^[A-Za-z0-9._/-]+$/),
  repoPath: z.string().min(1).max(300),
  composeFile: z.string().max(200).optional().nullable(),
  composeProject: z.string().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/),
  profiles: z.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)).max(20).default([]),
  runtime: z.enum(["web", "worker", "bot", "stack"]),
  exposure: z.enum(["internal", "cloudflare"]),
  hostname: z.string().max(253).regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i, "Hostname must be a valid domain").optional(),
  localPort: z.coerce.number().int().min(1).max(65535).optional(),
  deployNow: z.boolean().default(true),
  build: buildSpecSchema.nullable().optional(),
});

const deploymentSetupSchema = deploymentSetupFields.superRefine((value, context) => {
  if (value.exposure === "cloudflare" && (!value.hostname || !value.localPort)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Cloudflare Tunnel requires hostname and local HTTP port", path: ["hostname"] });
  }
});

type DeploymentSetupInput = z.input<typeof deploymentSetupSchema>;

const projectTunnelSchema = z.object({
  enabled: z.boolean(),
  hostname: z.string().max(253).optional(),
  localPort: z.coerce.number().int().min(1).max(65535).optional(),
}).superRefine((value, context) => {
  if (!value.enabled) return;
  if (!value.hostname || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value.hostname)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid domain, such as app.marczelloo.dev.", path: ["hostname"] });
  }
  if (!value.localPort) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter the app's local port.", path: ["localPort"] });
  }
});

async function ensureDeploymentService(projectId: string, projectName: string, config: DeploymentConfig) {
  const projectServices = await services.getServicesByProjectId(projectId);
  const matchingService = projectServices.find(
    (service) => service.type === "docker" && service.repo_path === config.repoPath && service.compose_project === config.composeProject
  );
  const publicUrl = config.tunnel?.enabled ? `https://${config.tunnel.hostname}` : null;

  if (matchingService) {
    return (await services.updateService(matchingService.id, {
      repo_path: config.repoPath,
      compose_project: config.composeProject,
      deploy_strategy: "compose_up",
      url: publicUrl,
    })) || matchingService;
  }

  return services.createService({
    project_id: projectId,
    name: `${projectName} deployment`,
    type: "docker",
    repo_path: config.repoPath,
    compose_project: config.composeProject,
    deploy_strategy: "compose_up",
    url: publicUrl || undefined,
  });
}

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function findHostnameConflict(projectId: string, hostname: string, ownedHostnames: Array<string | null | undefined>): Promise<string | null> {
  const [allProjects, ingress] = await Promise.all([projects.getProjects(), listCloudflareTunnelRoutes()]);
  const owners = (
    await Promise.all(
      allProjects.map(async (project) => {
        const config = await getDeploymentConfig(project.id);
        return config?.tunnel?.enabled ? { projectId: project.id, projectName: project.name, hostname: config.tunnel.hostname } : null;
      })
    )
  ).filter((owner): owner is NonNullable<typeof owner> => Boolean(owner));
  return hostnameConflict({ projectId, hostname, ownedHostnames: ownedHostnames.filter((value): value is string => Boolean(value)), owners, routes: ingress.routes });
}

async function queueConfiguredDeployment(
  projectId: string,
  triggeredBy: string,
  branchOverride?: string,
  commitSha?: string
): Promise<ActionResult<{ output: string; deployId: string; logFile: string; branch: string }>> {
  const project = await projects.getProjectById(projectId);
  if (!project) return { success: false, error: "Project not found" };
  let stored = await getDeploymentConfig(projectId);
  if (!stored) return { success: false, error: "The project has no Docker/GitHub setup yet." };
  if (stored.engine !== "agent") return { success: false, error: "The project is not deployed by the agent. Switch it to the agent first." };

  let reallocatedPort: number | null = null;
  // Without host ports there is nothing to collide with.
  if (stored.tunnel?.enabled && !edgeSettings().dropPorts) {
    try {
      const assignedPort = await allocateDeploymentPort(stored.tunnel.localPort, stored.composeProject);
      if (assignedPort !== stored.tunnel.localPort) {
        reallocatedPort = assignedPort;
        stored = await saveDeploymentConfig({
          ...stored,
          tunnel: { ...stored.tunnel, localPort: assignedPort },
        });
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Could not assign a deploy port." };
    }
  }
  const config: DeploymentConfig = branchOverride ? { ...stored, branch: branchOverride } : stored;

  const preflight = await preflightDeployment(config);
  if (!preflight.ok) {
    return { success: false, error: preflight.messages.filter((message) => message.level === "error").map((message) => message.text).join(" ") };
  }

  const service = await ensureDeploymentService(projectId, project.name, config);
  const queued = await queueAgentDeployment({ config, serviceId: service.id, triggeredBy, commitSha });
  const logFile = agentLogRef(queued.jobId);
  await auditLogs.logAction(triggeredBy, "deploy", "project", projectId, {
    mode: "agent-job",
    compose_project: config.composeProject,
    branch: config.branch,
    sha: queued.sha,
    deploy_id: queued.deployId,
    job_id: queued.jobId,
    tunnel_port_reallocated: reallocatedPort !== null,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return {
    success: true,
    data: {
      deployId: queued.deployId,
      logFile,
      branch: config.branch,
      output: `Deploy of ${queued.sha.slice(0, 7)} queued on the agent.\nLog file: ${logFile}\n\nSteps: git fetch → Compose config → build → up → health check → rollback on failure.`,
    },
  };
}

export async function preflightDeploymentAction(input: Omit<DeploymentSetupInput, "name" | "slug" | "description" | "tags" | "technologies" | "deployNow">): Promise<ActionResult<Awaited<ReturnType<typeof preflightDeployment>>>> {
  try {
    await requirePinVerification();
    const parsed = deploymentSetupFields.omit({ name: true, slug: true, description: true, tags: true, technologies: true, deployNow: true }).parse(input);
    if (parsed.exposure === "cloudflare" && (!parsed.hostname || !parsed.localPort)) {
      return { success: false, error: "Cloudflare Tunnel requires hostname and local HTTP port" };
    }
    const config: DeploymentConfig = {
      version: 1,
      projectId: "preflight",
      githubUrl: parsed.githubUrl,
      branch: parsed.branch,
      repoPath: parsed.repoPath,
      composeFile: parsed.composeFile || null,
      composeProject: parsed.composeProject,
      profiles: parsed.profiles,
      runtime: parsed.runtime as DeploymentRuntime,
      exposure: parsed.exposure as DeploymentExposure,
      tunnel: parsed.exposure === "cloudflare" && parsed.hostname && parsed.localPort ? { enabled: true, hostname: parsed.hostname, localPort: parsed.localPort } : null,
      build: generatedBuild(parsed.build),
      engine: "agent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { success: true, data: await preflightDeployment(config) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Preflight failed" };
  }
}

export async function provisionGitHubProjectAction(input: DeploymentSetupInput): Promise<ActionResult<{ projectId: string; deployId?: string; logFile?: string; preflight: Awaited<ReturnType<typeof preflightDeployment>> }>> {
  try {
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;
    const user = await requirePinVerification();
    const parsed = deploymentSetupSchema.parse(input);
    validateRepoPath(parsed.repoPath);

    const existing = await projects.getProjectBySlug(parsed.slug);
    if (existing) return { success: false, error: `A project with the slug "${parsed.slug}" already exists.` };
    const allProjects = await projects.getProjects();
    if (allProjects.some((project) => project.github_url?.replace(/\.git$/, "").toLowerCase() === parsed.githubUrl.replace(/\.git$/, "").toLowerCase())) {
      return { success: false, error: "This GitHub repository is already linked to a project." };
    }
    if (parsed.exposure === "cloudflare" && parsed.hostname) {
      const conflict = await findHostnameConflict("new", parsed.hostname, []);
      if (conflict) return { success: false, error: conflict };
    }
    if (!isAgentConfigured()) return { success: false, error: "The deploy agent is not configured (AGENT_TOKEN is missing)." };

    const project = await projects.createProject({
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description || undefined,
      status: "active",
      tags: parsed.tags,
      technologies: parsed.technologies,
      github_url: parsed.githubUrl,
      prod_url: parsed.exposure === "cloudflare" && parsed.hostname ? `https://${parsed.hostname}` : undefined,
    });
    const config = await saveDeploymentConfig({
      projectId: project.id,
      githubUrl: parsed.githubUrl,
      branch: parsed.branch,
      repoPath: parsed.repoPath,
      composeFile: parsed.composeFile || null,
      composeProject: parsed.composeProject,
      profiles: parsed.profiles,
      runtime: parsed.runtime,
      exposure: parsed.exposure,
      tunnel: parsed.exposure === "cloudflare" && parsed.hostname && parsed.localPort
        ? { enabled: true, hostname: parsed.hostname, localPort: parsed.localPort }
        : null,
      engine: "agent",
      build: generatedBuild(parsed.build),
    });
    await ensureDeploymentService(project.id, project.name, config);
    const preflight = await preflightDeployment(config);
    await auditLogs.logAction(user.email, "import", "github_repo", project.id, {
      managed_deployment: true,
      github_url: config.githubUrl,
      repo_path: config.repoPath,
      compose_project: config.composeProject,
      preflight_ok: preflight.ok,
    });

    let queued: ActionResult<{ output: string; deployId: string; logFile: string; branch: string }> | null = null;
    if (parsed.deployNow && preflight.ok) queued = await queueConfiguredDeployment(project.id, user.email);

    revalidatePath("/projects");
    revalidatePath("/dashboard");
    return {
      success: true,
      data: { projectId: project.id, preflight, deployId: queued?.data?.deployId, logFile: queued?.data?.logFile },
    };
  } catch (error) {
    console.error("provisionGitHubProjectAction error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Could not set up the project" };
  }
}

// ========================================
// Actions
// ========================================

export async function createProjectAction(input: CreateProjectInput): Promise<ActionResult<{ id: string }>> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();
    const parsed = createProjectSchema.parse(input);

    // Check for unique slug
    const existing = await projects.getProjectBySlug(parsed.slug);
    if (existing) {
      return { success: false, error: "A project with this slug already exists" };
    }

    const project = await projects.createProject(parsed);

    await auditLogs.logAction(user.email, "create", "project", project.id, { name: project.name, slug: project.slug });

    revalidatePath("/projects");
    revalidatePath("/dashboard");

    return { success: true, data: { id: project.id } };
  } catch (error) {
    console.error("createProjectAction error:", error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Failed to create project" };
  }
}

export async function updateProjectAction(id: string, input: UpdateProjectInput): Promise<ActionResult> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();
    const parsed = updateProjectSchema.parse(input);

    // Check if slug is being changed and if it's unique
    if (parsed.slug) {
      const existing = await projects.getProjectBySlug(parsed.slug);
      if (existing && existing.id !== id) {
        return { success: false, error: "A project with this slug already exists" };
      }
    }

    const project = await projects.updateProject(id, parsed);

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    await auditLogs.logAction(user.email, "update", "project", id, parsed);

    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("updateProjectAction error:", error);
    if (error instanceof AuthError) return { success: false, error: error.message };
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Failed to update project" };
  }
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    // Remove the public route and its DNS record before the project that owns them disappears.
    const deploymentConfig = await getDeploymentConfig(id);
    if (deploymentConfig?.tunnel?.enabled) {
      try {
        await updateCloudflareTunnelRoute({ hostname: null, localPort: null, removeHostnames: [deploymentConfig.tunnel.hostname] });
      } catch (error) {
        return { success: false, error: `The project was not deleted: the route ${deploymentConfig.tunnel.hostname} could not be removed (${error instanceof Error ? error.message : "Cloudflare error"}).` };
      }
    }
    if (deploymentConfig) await deleteDeploymentConfig(id);

    // Delete related services and work items first
    const projectServices = await services.getServicesByProjectId(id);
    for (const service of projectServices) {
      await services.deleteService(service.id);
    }

    const projectWorkItems = await workItems.getWorkItemsByProjectId(id);
    for (const item of projectWorkItems) {
      await workItems.deleteWorkItem(item.id);
    }

    const deleted = await projects.deleteProject(id);

    if (!deleted) {
      return { success: false, error: "Project not found" };
    }

    await auditLogs.logAction(user.email, "delete", "project", id, deploymentConfig?.tunnel?.enabled ? { removed_hostname: deploymentConfig.tunnel.hostname } : undefined);

    revalidatePath("/projects");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("deleteProjectAction error:", error);
    if (error instanceof AuthError) return { success: false, error: error.message };
    return { success: false, error: "Failed to delete project" };
  }
}

// ========================================
// Read Operations (no PIN required)
// ========================================

export async function getProjectsAction() {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Not authenticated" };
  }

  const data = await projects.getProjects();
  return { success: true as const, data };
}

export async function getProjectByIdAction(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Not authenticated" };
  }

  const data = await projects.getProjectById(id);
  if (!data) {
    return { success: false as const, error: "Project not found" };
  }

  return { success: true as const, data };
}

export async function getManagedDeploymentConfigAction(id: string): Promise<ActionResult<DeploymentConfig | null>> {
  try {
    await requireAuth();
    return { success: true, data: await getDeploymentConfig(id) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to load deployment configuration" };
  }
}

export async function getProjectTunnelStatusAction(id: string): Promise<ActionResult<{
  supportsManagedDeployment: boolean;
  configured: boolean;
  error?: string;
  tunnel: DeploymentConfig["tunnel"];
  actualRoute: { hostname: string; service: string; localPort: number | null } | null;
  status: "active" | "pending" | "not_configured" | "unavailable";
}>> {
  try {
    await requireAuth();
    if (isDemoMode()) {
      const project = await projects.getProjectById(id);
      if (!project) return { success: false, error: "Project not found" };
      const hostname = project.prod_url ? new URL(project.prod_url).hostname : null;
      if (!hostname) return { success: true, data: { supportsManagedDeployment: true, configured: true, tunnel: null, actualRoute: null, status: "not_configured" } };
      const tunnel = { enabled: true, hostname, localPort: 3000, service: "app", port: 3000 };
      return { success: true, data: { supportsManagedDeployment: true, configured: true, tunnel, actualRoute: { hostname, service: `http://${project.slug}-app:3000`, localPort: null }, status: "active" } };
    }
    const [project, config, ingress] = await Promise.all([
      projects.getProjectById(id),
      getDeploymentConfig(id),
      listCloudflareTunnelRoutes(),
    ]);
    if (!project) return { success: false, error: "Project not found" };

    const configuredHostname = config?.tunnel?.enabled ? config.tunnel.hostname.toLowerCase() : null;
    const fallbackHostname = !configuredHostname && project.prod_url ? new URL(project.prod_url).hostname.toLowerCase() : null;
    const hostname = configuredHostname || fallbackHostname;
    const route = hostname ? ingress.routes.find((candidate) => candidate.hostname.toLowerCase() === hostname) : undefined;
    const actualRoute = route ? { hostname: route.hostname, service: route.service, localPort: parseLocalPortFromService(route.service) } : null;
    const status = !ingress.configured || ingress.error
      ? "unavailable"
      : config?.tunnel?.enabled
        ? actualRoute && (actualRoute.localPort === config.tunnel.localPort || parseContainerService(actualRoute.service)) ? "active" : "pending"
        : "not_configured";

    return {
      success: true,
      data: {
        supportsManagedDeployment: Boolean(config),
        configured: ingress.configured,
        error: ingress.error,
        tunnel: config?.tunnel || null,
        actualRoute,
        status,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not read the tunnel status." };
  }
}

export async function updateProjectTunnelAction(
  id: string,
  input: z.input<typeof projectTunnelSchema>
): Promise<ActionResult<{ hostname: string | null; localPort: number | null; changed: boolean; deployQueued: boolean }>> {
  try {
    const user = await requirePinVerification();
    const parsed = projectTunnelSchema.parse(input);
    const [project, existing] = await Promise.all([projects.getProjectById(id), getDeploymentConfig(id)]);
    if (!project) return { success: false, error: "Project not found" };
    if (!existing) return { success: false, error: "This project has no managed GitHub/Docker setup yet." };

    const hostname = parsed.enabled ? parsed.hostname!.trim().toLowerCase() : null;
    if (hostname) {
      const conflict = await findHostnameConflict(id, hostname, [existing.tunnel?.hostname, hostnameOf(project.prod_url)]);
      if (conflict) return { success: false, error: conflict };
    }
    const localPort = parsed.enabled
      ? edgeSettings().dropPorts ? parsed.localPort! : await allocateDeploymentPort(parsed.localPort!, existing.composeProject)
      : null;
    const previousTunnel = existing.tunnel?.enabled ? existing.tunnel : null;
    // The remembered service stays valid while the port is the same.
    const keptTarget = previousTunnel?.localPort === localPort ? { service: previousTunnel?.service ?? null, port: previousTunnel?.port ?? null } : {};
    const saved = await saveDeploymentConfig({
      ...existing,
      exposure: parsed.enabled ? "cloudflare" : "internal",
      tunnel: hostname && localPort ? { enabled: true, hostname, localPort, ...keptTarget } : null,
    });
    const nextProdUrl = hostname ? `https://${hostname}` : null;

    try {
      await projects.updateProject(id, { prod_url: nextProdUrl });
      // A new local port only becomes valid after Compose has republished it.
      // Queue that deploy first; its final stage updates ingress after the
      // container is reachable, avoiding a window where Cloudflare points to
      // a port that does not exist yet.
      const deployQueued = Boolean(parsed.enabled && (!previousTunnel || previousTunnel.localPort !== localPort));
      let changed = false;
      if (deployQueued) {
        const deployment = await queueConfiguredDeployment(id, user.email);
        if (!deployment.success) throw new Error(deployment.error || "Could not queue a deploy with the new port.");
      } else {
        const result = await updateCloudflareTunnelRoute({
          hostname,
          localPort,
          removeHostnames: previousTunnel && previousTunnel.hostname !== hostname ? [previousTunnel.hostname] : [],
          config: saved,
        });
        changed = result.changed;
      }
      await auditLogs.logAction(user.email, "update", "project", id, {
        managed_cloudflare_tunnel: parsed.enabled,
        hostname,
        local_port: localPort,
        previous_hostname: previousTunnel?.hostname || null,
        ingress_changed: changed,
        deploy_queued_for_port_change: deployQueued,
      });
      revalidatePath(`/projects/${id}`);
      revalidatePath("/projects");
      revalidatePath("/settings");
      return { success: true, data: { hostname, localPort, changed, deployQueued } };
    } catch (error) {
      await saveDeploymentConfig({ ...existing });
      await projects.updateProject(id, { prod_url: project.prod_url });
      throw error;
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not save the tunnel route." };
  }
}

/** Every service of the project joins the edge network from the next deploy or env apply on. */
export async function updateProjectSharedNetworkAction(id: string, enabled: boolean): Promise<ActionResult<{ sharedNetwork: boolean }>> {
  try {
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();
    const existing = await getDeploymentConfig(id);
    if (!existing) return { success: false, error: "This project has no managed GitHub/Docker setup yet." };
    if (!edgeSettings().network) return { success: false, error: "EDGE_NETWORK is not set, so there is no shared network to join." };

    await saveDeploymentConfig({ ...existing, sharedNetwork: enabled });
    await auditLogs.logAction(user.email, "update", "project", id, { shared_network: enabled });
    revalidatePath(`/projects/${id}`);
    return { success: true, data: { sharedNetwork: enabled } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not save the network setting." };
  }
}

// ========================================
// Deploy Operations
// ========================================

/** Queue an agent deploy of the project's configured branch (UI and GitHub webhook). */
export async function deployConfiguredProject(
  id: string,
  triggeredBy: string,
  options?: { branch?: string; commitSha?: string }
): Promise<ActionResult<{ output: string; deployId: string; logFile: string; branch: string }>> {
  return queueConfiguredDeployment(id, triggeredBy, options?.branch, options?.commitSha);
}

export async function deployProjectAction(
  id: string,
  branch?: string
): Promise<ActionResult<{ output: string; deployId?: string; logFile?: string; branch?: string }>> {
  try {
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();
    return await deployConfiguredProject(id, user.email, { branch });
  } catch (error) {
    console.error("deployProjectAction error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Deployment failed" };
  }
}

/** Log of an agent deploy; deploy records keep `agent:<jobId>` as their log reference. */
export async function checkDeployLogAction(
  logFile: string,
  _deployId?: string
): Promise<ActionResult<{ log: string; isComplete: boolean }>> {
  try {
    await requireAuth();

    const agentJobId = parseAgentLogRef(logFile);
    if (!agentJobId) {
      return { success: true, data: { log: "This deploy's log came from the old deploy system and is no longer available.", isComplete: true } };
    }
    const agentLog = await readAgentDeployLog(agentJobId);
    return { success: true, data: { log: agentLog.log, isComplete: agentLog.isComplete } };
  } catch (error) {
    console.error("checkDeployLogAction error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to check log" };
  }
}

// ========================================
// GitHub Release Operations
// ========================================

/**
 * Parse GitHub URL to extract owner and repo
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [/github\.com\/([^\/]+)\/([^\/\?#]+)/, /github\.com:([^\/]+)\/([^\/\?#\.]+)/];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ""),
      };
    }
  }
  return null;
}

/**
 * Generate a semantic version tag for the next release
 */
async function generateNextVersionTag(
  owner: string,
  repo: string,
  type: "patch" | "minor" | "major" = "patch"
): Promise<string> {
  try {
    const latest = await getLatestRelease(owner, repo);
    if (latest?.tag_name) {
      // Parse existing version (v1.2.3 or 1.2.3)
      const match = latest.tag_name.match(/v?(\d+)\.(\d+)\.(\d+)/);
      if (match) {
        let [, major, minor, patch] = match.map(Number);
        switch (type) {
          case "major":
            major++;
            minor = 0;
            patch = 0;
            break;
          case "minor":
            minor++;
            patch = 0;
            break;
          case "patch":
          default:
            patch++;
        }
        return `v${major}.${minor}.${patch}`;
      }
    }
  } catch {
    // No existing releases or error - start at v1.0.0
  }
  return "v1.0.0";
}

/**
 * Create a GitHub release for a project
 */
export async function createReleaseAction(
  projectId: string,
  options: {
    tagName?: string;
    name?: string;
    description?: string;
    autoGenerateNotes?: boolean;
    versionType?: "patch" | "minor" | "major";
    draft?: boolean;
    prerelease?: boolean;
  } = {}
): Promise<ActionResult<{ tagName: string; htmlUrl: string }>> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    if (!isGitHubConfigured()) {
      return { success: false, error: "GitHub App not configured" };
    }

    // Get project
    const project = await projects.getProjectById(projectId);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    if (!project.github_url) {
      return { success: false, error: "Project has no GitHub URL" };
    }

    const parsed = parseGitHubUrl(project.github_url);
    if (!parsed) {
      return { success: false, error: "Invalid GitHub URL" };
    }

    const { owner, repo } = parsed;

    // Generate or use provided tag name
    let tagName = options.tagName;
    if (!tagName) {
      tagName = await generateNextVersionTag(owner, repo, options.versionType || "patch");
    }

    // Generate release notes if requested
    let body = options.description || "";
    if (options.autoGenerateNotes && !body) {
      try {
        const latest = await getLatestRelease(owner, repo);
        const notes = await generateReleaseNotes(owner, repo, tagName, latest?.tag_name);
        body = notes.body;
      } catch (e) {
        console.warn("[Release] Failed to generate notes:", e);
        body = `Release ${tagName}`;
      }
    }

    // Create the release
    const release = await createRelease(owner, repo, tagName, {
      name: options.name || tagName,
      body,
      draft: options.draft || false,
      prerelease: options.prerelease || false,
    });

    // Log the action
    await auditLogs.logAction(user.email, "create", "release", projectId, {
      project: project.name,
      tag: tagName,
      draft: options.draft,
      prerelease: options.prerelease,
    });

    revalidatePath(`/projects/${projectId}`);

    return {
      success: true,
      data: {
        tagName: release.tag_name,
        htmlUrl: release.html_url,
      },
    };
  } catch (error) {
    console.error("createReleaseAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create release",
    };
  }
}

/**
 * Create a release after a successful deploy
 * This can be called after confirming deploy succeeded
 */
export async function createDeployReleaseAction(
  projectId: string,
  deployId: string
): Promise<ActionResult<{ tagName: string; htmlUrl: string }>> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    // Verify deploy succeeded
    const deploy = await deploys.getDeployById(deployId);
    if (!deploy) {
      return { success: false, error: "Deploy not found" };
    }

    if (deploy.status !== "success") {
      return { success: false, error: "Can only create release for successful deploys" };
    }

    // Get project
    const project = await projects.getProjectById(projectId);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    if (!project.github_url) {
      return { success: false, error: "Project has no GitHub URL" };
    }

    const parsed = parseGitHubUrl(project.github_url);
    if (!parsed) {
      return { success: false, error: "Invalid GitHub URL" };
    }

    const { owner, repo } = parsed;

    // Generate next patch version
    const tagName = await generateNextVersionTag(owner, repo, "patch");

    // Generate release notes based on commits since last release
    let body = "";
    try {
      const latest = await getLatestRelease(owner, repo);
      const notes = await generateReleaseNotes(owner, repo, tagName, latest?.tag_name);
      body = notes.body;
    } catch (e) {
      console.warn("[Release] Failed to generate notes:", e);
      body = `Deployed on ${new Date().toISOString().split("T")[0]}\n\nDeployed by ${user.email}`;
    }

    // Create the release
    const release = await createRelease(owner, repo, tagName, {
      name: tagName,
      body,
      draft: false,
      prerelease: false,
    });

    // Log the action
    await auditLogs.logAction(user.email, "create", "release", projectId, {
      project: project.name,
      tag: tagName,
      deployId,
      autoCreated: true,
    });

    revalidatePath(`/projects/${projectId}`);

    return {
      success: true,
      data: {
        tagName: release.tag_name,
        htmlUrl: release.html_url,
      },
    };
  } catch (error) {
    console.error("createDeployReleaseAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create release",
    };
  }
}

// ========================================
// GitHub Repository Sync
// ========================================

/**
 * Sync GitHub repositories with dashboard projects
 * Creates new projects for repos that don't exist yet
 * Updates existing projects with latest repo info
 */
export async function syncGitHubReposAction(): Promise<
  ActionResult<{
    created: number;
    updated: number;
    skipped: number;
    details: string[];
  }>
> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    if (!isGitHubConfigured()) {
      return { success: false, error: "GitHub App not configured" };
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const details: string[] = [];

    // Fetch all accessible repositories (paginated)
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await listRepositories(page, 50);
      const repos = result.data;

      if (repos.length === 0) {
        hasMore = false;
        break;
      }

      for (const repo of repos) {
        try {
          // Check if project already exists with this GitHub URL
          const existingProjects = await projects.getProjects();
          const existingProject = existingProjects.find((p) => p.github_url === repo.html_url);

          if (existingProject) {
            // Update existing project with latest repo info if needed
            const needsUpdate = existingProject.description !== repo.description || existingProject.name !== repo.name;

            if (needsUpdate) {
              await projects.updateProject(existingProject.id, {
                description: repo.description || undefined,
              });
              updated++;
              details.push(`Updated: ${repo.full_name}`);
            } else {
              skipped++;
            }
          } else {
            // Create new project for this repo
            const slug = repo.name
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "");

            // Check if slug already exists
            const existingBySlug = await projects.getProjectBySlug(slug);
            if (existingBySlug) {
              skipped++;
              details.push(`Skipped (slug exists): ${repo.full_name}`);
              continue;
            }

            // Determine technologies from repo topics/language
            const technologies: string[] = [];
            if (repo.language) {
              technologies.push(repo.language);
            }
            if (repo.topics && repo.topics.length > 0) {
              technologies.push(...repo.topics.slice(0, 5));
            }

            await projects.createProject({
              name: repo.name,
              slug,
              description: repo.description || undefined,
              status: repo.archived ? "archived" : "active",
              github_url: repo.html_url,
              tags: repo.topics || [],
              technologies,
            });

            created++;
            details.push(`Created: ${repo.full_name}`);
          }
        } catch (repoError) {
          console.error(`Failed to sync repo ${repo.full_name}:`, repoError);
          details.push(
            `Error: ${repo.full_name} - ${repoError instanceof Error ? repoError.message : "Unknown error"}`
          );
        }
      }

      // Check if there are more pages
      hasMore = result.pagination?.nextPage !== undefined;
      page++;
    }

    // Log the sync action
    await auditLogs.logAction(user.email, "sync", "github_repos", "all", {
      created,
      updated,
      skipped,
    });

    revalidatePath("/projects");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        created,
        updated,
        skipped,
        details,
      },
    };
  } catch (error) {
    console.error("syncGitHubReposAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync GitHub repositories",
    };
  }
}

/**
 * Import a single GitHub repository as a project
 */
export async function importGitHubRepoAction(
  owner: string,
  repo: string
): Promise<ActionResult<{ projectId: string }>> {
  try {
    // Check demo mode
    const demoCheck = checkDemoModeBlocked();
    if (demoCheck.blocked) return demoCheck.result;

    const user = await requirePinVerification();

    if (!isGitHubConfigured()) {
      return { success: false, error: "GitHub App not configured" };
    }

    const githubUrl = `https://github.com/${owner}/${repo}`;

    // Check if already exists
    const existingProjects = await projects.getProjects();
    const existingProject = existingProjects.find((p) => p.github_url === githubUrl);

    if (existingProject) {
      return {
        success: false,
        error: `Project already exists: ${existingProject.name}`,
      };
    }

    // Generate slug
    const slug = repo
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if slug already exists
    const existingBySlug = await projects.getProjectBySlug(slug);
    if (existingBySlug) {
      return {
        success: false,
        error: `A project with slug "${slug}" already exists`,
      };
    }

    // Fetch repo info from GitHub
    const response = await fetch(`/api/github/repos/${owner}/${repo}`);
    let repoData: {
      description?: string;
      language?: string;
      topics?: string[];
      archived?: boolean;
    } = {};

    if (response.ok) {
      const result = await response.json();
      repoData = result.data || {};
    }

    // Create the project
    const project = await projects.createProject({
      name: repo,
      slug,
      description: repoData.description || undefined,
      status: repoData.archived ? "archived" : "active",
      github_url: githubUrl,
      tags: repoData.topics || [],
      technologies: repoData.language ? [repoData.language] : [],
    });

    // Log the action
    await auditLogs.logAction(user.email, "import", "github_repo", project.id, {
      owner,
      repo,
      github_url: githubUrl,
    });

    revalidatePath("/projects");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { projectId: project.id },
    };
  } catch (error) {
    console.error("importGitHubRepoAction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import repository",
    };
  }
}
