/**
 * GET /api/containers/list
 *
 * Get all Docker containers from Portainer for quick service selection
 */

import { NextResponse } from "next/server";
import { getEndpoints, getContainers, getContainerStatus } from "@/server/portainer/client";

export async function GET() {
  try {
    // Get all endpoints
    const endpoints = await getEndpoints();

    if (endpoints.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: "No Docker endpoints found",
      });
    }

    // Get containers from all endpoints
    const allContainers: {
      id: string;
      name: string;
      status: string;
      state: string;
      image: string;
      ports: string[];
      endpointId: number;
      endpointName: string;
      composeProject: string | null;
      composeService: string | null;
      labels: Record<string, string>;
    }[] = [];

    for (const endpoint of endpoints) {
      try {
        const containers = await getContainers(endpoint.Id, true);

        for (const container of containers) {
          const name = container.Names?.[0]?.replace(/^\//, "") || container.Id.slice(0, 12);
          const ports =
            container.Ports?.map((p) => {
              if (p.PublicPort && p.PrivatePort) {
                return `${p.PublicPort}:${p.PrivatePort}/${p.Type}`;
              }
              return `${p.PrivatePort}/${p.Type}`;
            }) || [];

          // Extract compose info from labels
          const labels = container.Labels || {};
          const composeProject = labels["com.docker.compose.project"] || null;
          const composeService = labels["com.docker.compose.service"] || null;

          allContainers.push({
            id: container.Id,
            name,
            status: getContainerStatus(container),
            state: container.State,
            image: container.Image,
            ports,
            endpointId: endpoint.Id,
            endpointName: endpoint.Name,
            composeProject,
            composeService,
            labels,
          });
        }
      } catch (error) {
        console.error(`Failed to get containers from endpoint ${endpoint.Name}:`, error);
      }
    }

    // Sort by name
    allContainers.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      data: allContainers,
    });
  } catch (error) {
    console.error("[Container List] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
