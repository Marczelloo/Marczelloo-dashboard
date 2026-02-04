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
import { getPortainerToken, setPortainerToken } from "@/server/atlashub/settings";

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

// Track if we're currently refreshing the token
let isRefreshing = false;

/**
 * Set token in memory (used when DB save fails)
 */
export function setInMemoryToken(token: string, expiresAt?: Date) {
  inMemoryToken = token;
  inMemoryTokenExpiry = expiresAt || null;
}

/**
 * Clear all cached tokens (call on 401 errors)
 */
export function clearTokenCache() {
  inMemoryToken = null;
  inMemoryTokenExpiry = null;
  cachedDbToken = null;
  tokenCacheTime = 0;
  console.log("[Portainer] Token cache cleared");
}

/**
 * Attempt to refresh the Portainer token using stored credentials
 */
export async function refreshPortainerToken(): Promise<string | null> {
  const url = process.env.PORTAINER_URL;
  const username = process.env.PORTAINER_USERNAME;
  const password = process.env.PORTAINER_PASSWORD;

  if (!url || !username || !password) {
    console.log("[Portainer] Cannot refresh token - missing PORTAINER_USERNAME or PORTAINER_PASSWORD");
    return null;
  }

  if (isRefreshing) {
    // Wait for the other refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return cachedDbToken || inMemoryToken;
  }

  isRefreshing = true;
  console.log("[Portainer] Attempting to refresh token...");

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      console.error("[Portainer] Failed to refresh token:", response.status);
      return null;
    }

    const data = await response.json();
    const token = data.jwt;

    if (!token) {
      console.error("[Portainer] No JWT in auth response");
      return null;
    }

    // Token typically expires in 8 hours
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    // Save to DB
    const saved = await setPortainerToken(token, expiresAt);

    // Update in-memory cache
    inMemoryToken = token;
    inMemoryTokenExpiry = expiresAt;
    cachedDbToken = token;
    tokenCacheTime = Date.now();

    console.log(`[Portainer] Token refreshed successfully (saved to DB: ${saved})`);
    return token;
  } catch (error) {
    console.error("[Portainer] Token refresh error:", error);
    return null;
  } finally {
    isRefreshing = false;
  }
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

async function portainerRequest<T>(
  path: string,
  options: RequestInit = {},
  parseJson = true,
  isRetry = false
): Promise<T> {
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

  // Handle 401 Unauthorized - try to refresh token and retry
  if (response.status === 401 && !isRetry) {
    console.log("[Portainer] Got 401, attempting token refresh...");
    clearTokenCache();

    const newToken = await refreshPortainerToken();
    if (newToken) {
      // Retry the request with new token
      return portainerRequest<T>(path, options, parseJson, true);
    }
  }

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

export async function getContainerLogs(
  endpointId: number,
  containerId: string,
  tail = 1000,
  isRetry = false
): Promise<ContainerLogs> {
  try {
    const config = await getConfig();
    const url = `${config.url}/api/endpoints/${endpointId}/docker/containers/${containerId}/logs?stdout=true&stderr=true&tail=${tail}&timestamps=false`;

    // Fetch raw binary data - Docker multiplexed streams are binary
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
      cache: "no-store",
    });

    // Handle 401 Unauthorized - try to refresh token and retry
    if (response.status === 401 && !isRetry) {
      console.log("[Portainer] Got 401 on logs, attempting token refresh...");
      clearTokenCache();

      const newToken = await refreshPortainerToken();
      if (newToken) {
        return getContainerLogs(endpointId, containerId, tail, true);
      }
    }

    if (!response.ok) {
      const error = await response.text().catch(() => response.statusText);
      throw new PortainerError(`Portainer API error: ${response.status} - ${error}`, response.status);
    }

    // Get as ArrayBuffer to properly handle binary multiplexed stream
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Parse Docker multiplexed stream format
    // Each frame: [stream_type: 1 byte][0][0][0][size: 4 bytes big-endian][payload: size bytes]
    // stream_type: 0=stdin, 1=stdout, 2=stderr
    const textDecoder = new TextDecoder("utf-8", { fatal: false });
    const chunks: string[] = [];

    // Check if this is multiplexed format
    const isMultiplexed =
      uint8Array.length > 8 &&
      (uint8Array[0] === 1 || uint8Array[0] === 2) &&
      uint8Array[1] === 0 &&
      uint8Array[2] === 0 &&
      uint8Array[3] === 0;

    if (isMultiplexed) {
      let offset = 0;

      while (offset + 8 <= uint8Array.length) {
        // Read 4-byte size (big-endian) at offset+4
        const size =
          (uint8Array[offset + 4] << 24) |
          (uint8Array[offset + 5] << 16) |
          (uint8Array[offset + 6] << 8) |
          uint8Array[offset + 7];

        offset += 8;

        // Sanity check
        if (size <= 0 || size > 10000000 || offset + size > uint8Array.length) {
          break;
        }

        // Extract payload and decode as UTF-8
        const payload = uint8Array.slice(offset, offset + size);
        chunks.push(textDecoder.decode(payload));
        offset += size;
      }

      console.log(`[Portainer] Parsed ${chunks.length} multiplexed frames from ${uint8Array.length} bytes`);
    } else {
      // Plain text - decode the whole buffer
      chunks.push(textDecoder.decode(uint8Array));
    }

    let logs = chunks.join("");

    // Clean up control characters but keep newlines, tabs
    logs = logs.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();

    return {
      logs,
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

export async function killContainer(endpointId: number, containerId: string): Promise<PortainerActionResult> {
  return performContainerAction(endpointId, containerId, "kill");
}

export async function removeContainer(
  endpointId: number,
  containerId: string,
  force = false
): Promise<PortainerActionResult> {
  try {
    await portainerRequest(`/endpoints/${endpointId}/docker/containers/${containerId}?force=${force}`, {
      method: "DELETE",
    });
    return { success: true, message: "Container removed successfully" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface ContainerStats {
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
  network_rx: number;
  network_tx: number;
  block_read: number;
  block_write: number;
}

export async function getContainerStats(endpointId: number, containerId: string): Promise<ContainerStats | null> {
  try {
    const stats = await portainerRequest<{
      cpu_stats: { cpu_usage: { total_usage: number }; system_cpu_usage: number; online_cpus: number };
      precpu_stats: { cpu_usage: { total_usage: number }; system_cpu_usage: number };
      memory_stats: { usage: number; limit: number };
      networks?: Record<string, { rx_bytes: number; tx_bytes: number }>;
      blkio_stats?: { io_service_bytes_recursive?: Array<{ op: string; value: number }> };
    }>(`/endpoints/${endpointId}/docker/containers/${containerId}/stats?stream=false`);

    // Calculate CPU percentage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;

    // Calculate memory
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 1;
    const memoryPercent = (memoryUsage / memoryLimit) * 100;

    // Network I/O
    let networkRx = 0;
    let networkTx = 0;
    if (stats.networks) {
      for (const net of Object.values(stats.networks)) {
        networkRx += net.rx_bytes || 0;
        networkTx += net.tx_bytes || 0;
      }
    }

    // Block I/O
    let blockRead = 0;
    let blockWrite = 0;
    if (stats.blkio_stats?.io_service_bytes_recursive) {
      for (const io of stats.blkio_stats.io_service_bytes_recursive) {
        if (io.op === "read" || io.op === "Read") blockRead += io.value;
        if (io.op === "write" || io.op === "Write") blockWrite += io.value;
      }
    }

    return {
      cpu_percent: Math.round(cpuPercent * 100) / 100,
      memory_usage: memoryUsage,
      memory_limit: memoryLimit,
      memory_percent: Math.round(memoryPercent * 100) / 100,
      network_rx: networkRx,
      network_tx: networkTx,
      block_read: blockRead,
      block_write: blockWrite,
    };
  } catch (error) {
    console.error(`[Portainer] Failed to get stats for container ${containerId}:`, error);
    return null;
  }
}

export interface ContainerInspect {
  Id: string;
  Created: string;
  Path: string;
  Args: string[];
  State: {
    Status: string;
    Running: boolean;
    Paused: boolean;
    Restarting: boolean;
    OOMKilled: boolean;
    Dead: boolean;
    Pid: number;
    ExitCode: number;
    Error: string;
    StartedAt: string;
    FinishedAt: string;
  };
  Image: string;
  Name: string;
  RestartCount: number;
  Driver: string;
  Platform: string;
  Mounts: Array<{
    Type: string;
    Source: string;
    Destination: string;
    Mode: string;
    RW: boolean;
  }>;
  Config: {
    Hostname: string;
    Env: string[];
    Cmd: string[];
    Image: string;
    WorkingDir: string;
    Labels: Record<string, string>;
  };
  NetworkSettings: {
    IPAddress: string;
    Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null>;
  };
  HostConfig: {
    Memory: number;
    CpuShares: number;
    RestartPolicy: { Name: string; MaximumRetryCount: number };
  };
}

export async function inspectContainer(endpointId: number, containerId: string): Promise<ContainerInspect | null> {
  try {
    return await portainerRequest<ContainerInspect>(`/endpoints/${endpointId}/docker/containers/${containerId}/json`);
  } catch (error) {
    console.error(`[Portainer] Failed to inspect container ${containerId}:`, error);
    return null;
  }
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
