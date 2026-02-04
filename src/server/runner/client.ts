/**
 * Runner Service Client - Local deployment operations
 *
 * Executes git pull and docker operations through a secure local runner service.
 * The runner only accepts operations from localhost with a shared secret.
 */

import "server-only";
import type { RunnerRequest, RunnerResponse } from "@/types";

// ========================================
// Configuration
// ========================================

function getConfig() {
  const url = process.env.RUNNER_URL;
  const token = process.env.RUNNER_TOKEN;

  if (!url) {
    throw new Error("RUNNER_URL environment variable is not set");
  }
  if (!token) {
    throw new Error("RUNNER_TOKEN environment variable is not set");
  }

  return { url: url.replace(/\/$/, ""), token };
}

// ========================================
// HTTP Client
// ========================================

async function runnerRequest(request: RunnerRequest): Promise<RunnerResponse> {
  const config = getConfig();

  const response = await fetch(`${config.url}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.text().catch(() => response.statusText);
    throw new RunnerError(`Runner error: ${response.status} - ${error}`, response.status);
  }

  return response.json();
}

// ========================================
// Error Class
// ========================================

export class RunnerError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "RunnerError";
  }
}

// ========================================
// Operations
// ========================================

/**
 * Execute git pull in a repository
 */
export async function gitPull(repoPath: string): Promise<RunnerResponse> {
  return runnerRequest({
    operation: "git_pull",
    target: { repo_path: repoPath },
  });
}

/**
 * Restart a Docker container
 */
export async function dockerRestart(containerName: string): Promise<RunnerResponse> {
  return runnerRequest({
    operation: "docker_restart",
    target: { container_name: containerName },
  });
}

/**
 * Rebuild a Docker service with compose
 */
export async function dockerRebuild(composeProject: string, serviceName?: string): Promise<RunnerResponse> {
  return runnerRequest({
    operation: "docker_rebuild",
    target: {
      compose_project: composeProject,
      service_name: serviceName,
    },
    options: { build: true },
  });
}

/**
 * Run docker compose up
 */
export async function composeUp(composeProject: string, build = true): Promise<RunnerResponse> {
  return runnerRequest({
    operation: "compose_up",
    target: { compose_project: composeProject },
    options: { build },
  });
}

/**
 * Get Docker container logs
 */
export async function dockerLogs(containerName: string, tail = 100): Promise<RunnerResponse> {
  return runnerRequest({
    operation: "docker_logs",
    target: { container_name: containerName },
    options: { tail },
  });
}

/**
 * Get Docker container status
 */
export async function dockerStatus(containerName: string): Promise<RunnerResponse> {
  return runnerRequest({
    operation: "docker_status",
    target: { container_name: containerName },
  });
}

/**
 * Execute a command inside a Docker container
 * Uses the shell endpoint to run docker exec
 */
export async function dockerExec(
  containerName: string,
  command: string
): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
  const config = getConfig();

  // Sanitize container name and command to prevent injection
  // Only allow alphanumeric, dashes, underscores, and dots in container name
  if (!/^[a-zA-Z0-9_.-]+$/.test(containerName)) {
    throw new RunnerError("Invalid container name format", 400);
  }

  try {
    const response = await fetch(`${config.url}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({
        command: `docker exec ${containerName} ${command}`,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.text().catch(() => response.statusText);
      return {
        success: false,
        stdout: "",
        stderr: "",
        error: `Runner error: ${response.status} - ${error}`,
      };
    }

    const result = await response.json();
    return {
      success: result.exit_code === 0 || (!result.exit_code && !result.stderr),
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      error: result.exit_code !== 0 ? `Exit code: ${result.exit_code}` : undefined,
    };
  } catch (error) {
    return {
      success: false,
      stdout: "",
      stderr: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ========================================
// Deployment Workflows
// ========================================

/**
 * Full deployment: git pull + rebuild + restart
 */
export async function deploy(
  repoPath: string,
  composeProject: string,
  strategy: "pull_restart" | "pull_rebuild" | "compose_up"
): Promise<{
  success: boolean;
  steps: RunnerResponse[];
  commit_sha?: string;
  error?: string;
}> {
  const steps: RunnerResponse[] = [];

  try {
    // Step 1: Git pull
    const pullResult = await gitPull(repoPath);
    steps.push(pullResult);

    if (!pullResult.success) {
      return {
        success: false,
        steps,
        error: pullResult.error || "Git pull failed",
      };
    }

    // Step 2: Based on strategy
    let deployResult: RunnerResponse;

    switch (strategy) {
      case "pull_restart":
        deployResult = await dockerRestart(composeProject);
        break;
      case "pull_rebuild":
        deployResult = await dockerRebuild(composeProject);
        break;
      case "compose_up":
        deployResult = await composeUp(composeProject);
        break;
    }

    steps.push(deployResult);

    if (!deployResult.success) {
      return {
        success: false,
        steps,
        error: deployResult.error || "Deploy failed",
      };
    }

    return {
      success: true,
      steps,
      commit_sha: pullResult.commit_sha,
    };
  } catch (error) {
    return {
      success: false,
      steps,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
