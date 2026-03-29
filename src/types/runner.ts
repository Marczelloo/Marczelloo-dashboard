// ========================================
// Runner Service Types
// ========================================

import type { PackageEcosystem } from "./entities";

export interface RunnerConfig {
  url: string;
  token: string;
}

export type RunnerOperation =
  | "git_pull"
  | "docker_restart"
  | "docker_rebuild"
  | "compose_up"
  | "docker_logs"
  | "docker_status"
  | "npm_check"      // Check for outdated packages
  | "npm_update"     // Update npm packages
  | "npm_test"       // Run npm tests
  | "npm_build"      // Run npm build
  | "npm_backup"     // Backup package files
  | "npm_restore"    // Restore package files
  | "container_npm_check";  // Check packages inside a Docker container

export interface RunnerRequest {
  operation: RunnerOperation;
  target: {
    repo_path?: string;
    compose_project?: string;
    container_name?: string;
    service_name?: string;
    packages?: string[]; // For npm_update operation
  };
  options?: {
    tail?: number;
    build?: boolean;
    test_command?: string; // For npm_test operation
    build_command?: string; // For npm_build operation
    backup_data?: string; // For npm_restore operation
  };
}

export interface RunnerResponse {
  success: boolean;
  operation: RunnerOperation;
  output?: string;
  commit_sha?: string;
  error?: string;
  duration_ms?: number;
  timestamp: string;
}

// Allowed operations whitelist (configured server-side)
export interface RunnerAllowlist {
  repo_paths: string[];
  compose_projects: string[];
  container_names: string[];
}

// Package Management Types
export interface NpmOutdatedResult {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  location?: string;
}

export interface PackageUpdateRequest {
  ecosystem: PackageEcosystem;
  packages?: string[]; // Specific packages to update, or empty for all
  runTests: boolean;
  runBuild: boolean;
  isGitHubProject: boolean;
  githubBranch?: string;
}

export interface PackageUpdateResult {
  success: boolean;
  updated: string[];
  oldVersions: Record<string, string>;
  newVersions: Record<string, string>;
  testPassed?: boolean;
  buildPassed?: boolean;
  testOutput?: string;
  buildOutput?: string;
  error?: string;
  branchName?: string;
  commitSha?: string;
}

export interface BackupData {
  "package.json": string;
  "package-lock.json"?: string;
  "yarn.lock"?: string;
  "pnpm-lock.yaml"?: string;
}
