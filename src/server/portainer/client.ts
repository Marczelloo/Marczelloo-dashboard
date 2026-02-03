/**
 * Portainer API Client - Docker container management
 */

import "server-only";
import type {
  PortainerEndpoint,
  PortainerContainer,
  PortainerStack,
  ContainerAction,
  ContainerLogs,
  PortainerActionResult,
} from "@/types";
import { getPortainerToken } from "@/server/atlashub/settings";

// ========================================
// Configuration
// ========================================

// In-memory token cache (works even if DB table doesn't exist)
let inMemoryToken: string | null = null;
let inMemoryTokenExpiry: Date | null = null;

// Cache for DB token to avoid repeated lookups
let cachedDbToken: string | null = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_TTL = 60_000; // 1 minute

/**
 * Set token in memory (used when DB save fails)
 */
export function setInMemoryToken(token: string, expiresAt?: Date) {
  inMemoryToken = token;
  inMemoryTokenExpiry = expiresAt || null;
}

async function getConfig() {
  const url = process.env.PORTAINER_URL;

  if (!url) {
    throw new Error("PORTAINER_URL environment variable is not set");
  }

  // Try to get token from DB first (with caching)
  let token: string | null = null;

  if (Date.now() - tokenCacheTime < TOKEN_CACHE_TTL && cachedDbToken) {
    token = cachedDbToken;
  } else {
    try {
      token = await getPortainerToken();
      cachedDbToken = token;
      tokenCacheTime = Date.now();
    } catch {
      // DB lookup failed, fallback to other sources
    }
  }

  // Fallback to in-memory token (set during this session)
  if (!token && inMemoryToken) {
    // Check if in-memory token is still valid
    if (!inMemoryTokenExpiry || inMemoryTokenExpiry > new Date()) {
      token = inMemoryToken;
    }
  }

  // Fallback to environment variable
  if (!token) {
    token = process.env.PORTAINER_TOKEN || null;
  }

  if (!token) {
    throw new Error("No Portainer token available. Configure PORTAINER_TOKEN or refresh token in Settings.");
  }

  return { url: url.replace(/\/$/, ""), token };
}

// ========================================
// HTTP Client
// ========================================

async function portainerRequest<T>(path: string, options: RequestInit = {}, parseJson = true): Promise<T> {
  const config = await getConfig();
  const url = `${config.url}/api${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.text().catch(() => response.statusText);
    throw new PortainerError(`Portainer API error: ${response.status} - ${error}`, response.status);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  // Return raw text if parseJson is false
  if (!parseJson) {
    return text as T;
  }

  return JSON.parse(text);
}

// ========================================
// Error Class
// ========================================

export class PortainerError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "PortainerError";
  }
}

// ========================================
// Endpoints
// ========================================

export async function getEndpoints(): Promise<PortainerEndpoint[]> {
  return portainerRequest<PortainerEndpoint[]>("/endpoints");
}

export async function getEndpoint(endpointId: number): Promise<PortainerEndpoint> {
  return portainerRequest<PortainerEndpoint>(`/endpoints/${endpointId}`);
}

// ========================================
// Containers
// ========================================

export async function getContainers(endpointId: number, all = true): Promise<PortainerContainer[]> {
  return portainerRequest<PortainerContainer[]>(`/endpoints/${endpointId}/docker/containers/json?all=${all}`);
}

export async function getContainer(endpointId: number, containerId: string): Promise<PortainerContainer> {
  const containers = await getContainers(endpointId);
  const container = containers.find((c) => c.Id === containerId || c.Id.startsWith(containerId));

  if (!container) {
    throw new PortainerError(`Container ${containerId} not found`, 404);
  }

  return container;
}

export async function getContainerLogs(endpointId: number, containerId: string, tail = 100): Promise<ContainerLogs> {
  try {
    const response = await portainerRequest<string>(
      `/endpoints/${endpointId}/docker/containers/${containerId}/logs?stdout=true&stderr=true&tail=${tail}&timestamps=true`,
      {},
      false // Don't parse as JSON - logs are raw text
    );

    return {
      logs: typeof response === "string" ? response : JSON.stringify(response),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[Portainer] Failed to get logs for container ${containerId}:`, error);
    throw error;
  }
}

export async function performContainerAction(
  endpointId: number,
  containerId: string,
  action: ContainerAction
): Promise<PortainerActionResult> {
  try {
    if (action === "recreate") {
      // Recreate requires special handling through Portainer's recreate endpoint
      await portainerRequest(`/endpoints/${endpointId}/docker/containers/${containerId}/recreate`, {
        method: "POST",
        body: JSON.stringify({ PullImage: true }),
      });
    } else {
      await portainerRequest(`/endpoints/${endpointId}/docker/containers/${containerId}/${action}`, { method: "POST" });
    }

    return { success: true, message: `Container ${action} successful` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function startContainer(endpointId: number, containerId: string): Promise<PortainerActionResult> {
  return performContainerAction(endpointId, containerId, "start");
}

export async function stopContainer(endpointId: number, containerId: string): Promise<PortainerActionResult> {
  return performContainerAction(endpointId, containerId, "stop");
}

export async function restartContainer(endpointId: number, containerId: string): Promise<PortainerActionResult> {
  return performContainerAction(endpointId, containerId, "restart");
}

export async function recreateContainer(endpointId: number, containerId: string): Promise<PortainerActionResult> {
  return performContainerAction(endpointId, containerId, "recreate");
}

// ========================================
// Stacks
// ========================================

export async function getStacks(endpointId?: number): Promise<PortainerStack[]> {
  const query = endpointId ? `?filters={"EndpointID":${endpointId}}` : "";
  return portainerRequest<PortainerStack[]>(`/stacks${query}`);
}

export async function getStack(stackId: number): Promise<PortainerStack> {
  return portainerRequest<PortainerStack>(`/stacks/${stackId}`);
}

export async function redeployStack(
  stackId: number,
  endpointId: number,
  pullImage = true
): Promise<PortainerActionResult> {
  try {
    await portainerRequest(`/stacks/${stackId}/git/redeploy?endpointId=${endpointId}`, {
      method: "PUT",
      body: JSON.stringify({
        pullImage,
        prune: false,
      }),
    });

    return { success: true, message: "Stack redeployed successfully" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ========================================
// Health Check Helpers
// ========================================

export function getContainerStatus(container: PortainerContainer): "running" | "stopped" | "unhealthy" | "unknown" {
  const state = container.State.toLowerCase();

  if (state === "running") {
    if (container.Health?.Status === "unhealthy") {
      return "unhealthy";
    }
    return "running";
  }

  if (state === "exited" || state === "dead" || state === "created") {
    return "stopped";
  }

  return "unknown";
}

export function getContainerHealthColor(container: PortainerContainer): "success" | "warning" | "danger" {
  const status = getContainerStatus(container);

  switch (status) {
    case "running":
      return "success";
    case "unhealthy":
      return "warning";
    case "stopped":
    case "unknown":
      return "danger";
  }
}
