import { NextResponse } from "next/server";
import { projects } from "@/server/atlashub";
import { getDeploymentConfig, listCloudflareTunnelRoutes } from "@/server/deployments";
import { getManagedTunnelSettings, getManagedTunnelStatus } from "@/server/cloudflare/managed-tunnel";
import { requireAuth } from "@/server/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const [ingress, allProjects] = await Promise.all([
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

    const managedTunnel = getManagedTunnelSettings()
      ? await getManagedTunnelStatus().catch((error: unknown) => ({ error: error instanceof Error ? error.message : "The Cloudflare API is unavailable." }))
      : null;

    return NextResponse.json(
      { success: true, managedTunnel, configured: ingress.configured, routes, error: ingress.error },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load Tunnel settings" }, { status: 500 });
  }
}
