import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auditLogs, projects } from "@/server/atlashub";
import {
  getCloudflareTunnelSettings,
  getDeploymentConfig,
  listCloudflareTunnelRoutes,
  saveCloudflareTunnelSettings,
} from "@/server/deployments";
import { requireAuth, requirePinVerification } from "@/server/lib/auth";

const settingsSchema = z.object({
  configPath: z.string().min(1).max(240),
  useSudo: z.boolean(),
  tunnelName: z.string().max(127).optional(),
});

function getLocalPort(service: string): number | null {
  const match = /127\.0\.0\.1:(\d+)/.exec(service) || /:(\d+)$/.exec(service);
  return match ? Number(match[1]) : null;
}

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  try {
    const [tunnel, ingress, allProjects] = await Promise.all([
      getCloudflareTunnelSettings(),
      listCloudflareTunnelRoutes(),
      projects.getProjects(),
    ]);
    const managed = (await Promise.all(allProjects.map(async (project) => {
      const deployment = await getDeploymentConfig(project.id);
      if (!deployment?.tunnel?.enabled) return null;
      return {
        projectId: project.id,
        projectName: project.name,
        projectSlug: project.slug,
        hostname: deployment.tunnel.hostname,
        localPort: deployment.tunnel.localPort,
      };
    }))).filter((route): route is NonNullable<typeof route> => Boolean(route));
    const byHostname = new Map(managed.map((route) => [route.hostname.toLowerCase(), route]));
    const found = new Set<string>();
    const routes = ingress.routes.map((route) => {
      const managedRoute = byHostname.get(route.hostname.toLowerCase());
      if (managedRoute) found.add(managedRoute.hostname.toLowerCase());
      return {
        ...route,
        localPort: getLocalPort(route.service),
        active: true,
        managed: Boolean(managedRoute),
        project: managedRoute || null,
      };
    });
    for (const route of managed) {
      if (found.has(route.hostname.toLowerCase())) continue;
      routes.push({
        hostname: route.hostname,
        service: `http://127.0.0.1:${route.localPort}`,
        localPort: route.localPort,
        active: false,
        managed: true,
        project: route,
      });
    }

    return NextResponse.json({ success: true, tunnel, configured: ingress.configured, routes, error: ingress.error });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load Tunnel settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let user;
  try {
    user = await requirePinVerification();
  } catch {
    return NextResponse.json({ success: false, requirePin: true, error: "PIN verification required" }, { status: 401 });
  }

  try {
    const input = settingsSchema.parse(await request.json());
    const tunnel = await saveCloudflareTunnelSettings(input);
    await auditLogs.logAction(user.email, "update", "service", "cloudflare-tunnel", {
      config_path: tunnel.configPath,
      use_sudo: tunnel.useSudo,
      has_tunnel_name: Boolean(tunnel.tunnelName),
    });
    return NextResponse.json({ success: true, tunnel });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to save Tunnel settings" }, { status: 400 });
  }
}
