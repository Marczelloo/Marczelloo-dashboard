# Package Manager Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-project package management with update workflow, auto-rollback on failure, and update history tracking.

**Architecture:**
- **UI:** New "Packages" tab in project detail page with package status, outdated list, and update history
- **API:** REST endpoints for checking/updating packages and rollback
- **Runner:** Extended with npm operations (MVP: npm only, multi-ecosystem in Phase 3)
- **Database:** New `package_updates` table for history tracking

**Tech Stack:** Next.js 16, TypeScript, Runner Service, AtlasHub API, shadcn/ui, Framer Motion

---

## Chunk 1: Types and Database Setup

### Task 0: Define repo_path Resolution Strategy

**Decision Point:** Before implementing, we need to decide where `repo_path` comes from.

**Options:**
A) **From services table** - Use `service.repo_path` from the first service with a non-null value
B) **From project table** - Add `repo_path` column to projects table
C) **User-selected** - Let user choose which service's path to use

**Decision for MVP:** Option A - Use services table. A project may have multiple services, so we'll:
1. Fetch all services for the project
2. Find services with non-null `repo_path`
3. Use the first one, or show a selector if multiple exist

**Note:** For GitHub projects without local repo_path, we'll need to clone to a temp directory (Phase 4).

---

### Task 1: Add Package Update Types

**Files:**
- Modify: `src/types/entities.ts` - Add PackageUpdate entity and related types
- Modify: `src/types/runner.ts` - Add package operations to RunnerOperation type
- Modify: `src/types/index.ts` - Export new types (automatically via re-export)

- [ ] **Step 1: Add PackageUpdate type to src/types/entities.ts**

Add after the AuditLog type (around line 143):

```typescript
export interface PackageUpdate {
  id: string;
  project_id: string;
  ecosystem: PackageEcosystem;
  packages_updated: string[]; // JSON array of package names
  old_versions: Record<string, string>; // JSON: {"react": "19.0.0", ...}
  new_versions: Record<string, string>; // JSON: {"react": "19.0.1", ...}
  status: PackageUpdateStatus;
  test_output: string | null;
  error_message: string | null;
  branch_name: string | null; // feature branch for GitHub projects
  pr_url: string | null; // created PR URL
  rollback_data: string | null; // backed up lockfile content (JSON)
  rollback_from_id: string | null; // ID of the update this rollback reverses (if this is a rollback)
  created_at: string;
  completed_at: string | null;
}

export type PackageEcosystem = "npm" | "yarn" | "pnpm" | "pip" | "poetry" | "cargo" | "composer";
export type PackageUpdateStatus = "pending" | "success" | "failed" | "rolled_back";

// Create DTO
export interface CreatePackageUpdateInput {
  project_id: string;
  ecosystem: PackageEcosystem;
  packages_updated: string[];
  old_versions: Record<string, string>;
  new_versions: Record<string, string>;
  status: PackageUpdateStatus;
  test_output?: string | null;
  error_message?: string | null;
  branch_name?: string | null;
  pr_url?: string | null;
  rollback_data?: string | null;
  rollback_from_id?: string | null; // For rollback operations
  completed_at?: string | null;
}

// Update DTO (only status, completed_at, error_message, test_output, branch_name, pr_url can be updated)
export interface UpdatePackageUpdateInput {
  status?: PackageUpdateStatus;
  test_output?: string | null;
  error_message?: string | null;
  branch_name?: string | null;
  pr_url?: string | null;
  completed_at?: string | null;
}
```

Add `"package_update"` to `EntityType` union (around line 140):

```typescript
export type EntityType =
  | "project"
  | "service"
  | "work_item"
  | "env_var"
  | "deploy"
  | "container"
  | "auth"
  | "github_repo"
  | "release"
  | "github_issue"
  | "work_item_pr"
  | "work_item_github"
  | "github_repos"
  | "package_update"; // ADD THIS LINE
```

- [ ] **Step 2: Extend RunnerOperation type in src/types/runner.ts**

Replace the RunnerOperation type (around line 10-16) with:

```typescript
export type RunnerOperation =
  | "git_pull"
  | "docker_restart"
  | "docker_rebuild"
  | "compose_up"
  | "docker_logs"
  | "docker_status"
  | "npm_check"      // NEW: Check for outdated packages
  | "npm_update"     // NEW: Update npm packages
  | "npm_test"       // NEW: Run npm tests
  | "npm_build"      // NEW: Run npm build
  | "npm_backup"     // NEW: Backup package files
  | "npm_restore";   // NEW: Restore package files
```

- [ ] **Step 3: Add package-related types to src/types/runner.ts**

Add after the RunnerAllowlist interface (around line 47):

```typescript
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
```

- [ ] **Step 4: Commit types changes**

```bash
git add src/types/entities.ts src/types/runner.ts
git commit -m "feat(types): add package update types

- Add PackageUpdate entity with ecosystem, status tracking
- Add PackageUpdateStatus and PackageEcosystem types
- Extend RunnerOperation with npm package operations
- Add package-related request/response types"
```

---

### Task 2: Create Database Table

**Files:**
- Create: `scripts/create-package-updates-table.ts` - Migration script

- [ ] **Step 1: Create migration script**

Create `scripts/create-package-updates-table.ts`:

```typescript
/**
 * Migration: Create package_updates table
 *
 * Run: npx tsx scripts/create-package-updates-table.ts
 */

import "dotenv/config";

const TABLE_NAME = "package_updates";

const SQL = `
-- Create package_updates table
CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  ecosystem TEXT NOT NULL CHECK(ecosystem IN ('npm', 'yarn', 'pnpm', 'pip', 'poetry', 'cargo', 'composer')),
  packages_updated TEXT NOT NULL, -- JSON array
  old_versions TEXT NOT NULL,     -- JSON object
  new_versions TEXT NOT NULL,     -- JSON object
  status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'failed', 'rolled_back')),
  test_output TEXT,
  error_message TEXT,
  branch_name TEXT,
  pr_url TEXT,
  rollback_data TEXT,             -- JSON backup of lockfiles
  rollback_from_id TEXT,          -- ID of update this rollback reverses (null for non-rollbacks)
  created_at TEXT NOT NULL DEFAULT (datetime('epoch')),
  completed_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create index for fast project-based queries
CREATE INDEX IF NOT EXISTS idx_package_updates_project ON ${TABLE_NAME}(project_id, created_at DESC);

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_package_updates_status ON ${TABLE_NAME}(status);

-- Trigger for auto-generated IDs
CREATE TRIGGER IF NOT EXISTS trigger_package_updates_id
BEFORE INSERT ON ${TABLE_NAME}
WHEN NEW.id IS NULL
BEGIN
  SELECT 'pkg_' || lower(hex(randomblob(16))) INTO NEW.id;
END;
`;

async function createTable() {
  const apiUrl = process.env.ATLASHUB_API_URL;
  const secretKey = process.env.ATLASHUB_SECRET_KEY;

  if (!apiUrl || !secretKey) {
    console.error("Error: ATLASHUB_API_URL and ATLASHUB_SECRET_KEY must be set");
    process.exit(1);
  }

  try {
    // Execute raw SQL via AtlasHub
    const response = await fetch(`${apiUrl}/v1/raw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": secretKey,
      },
      body: JSON.stringify({ sql: SQL }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create table: ${error}`);
    }

    const result = await response.json();
    console.log("✅ package_updates table created successfully");
    console.log("Result:", result);
  } catch (error) {
    console.error("❌ Error creating table:", error);
    process.exit(1);
  }
}

createTable();
```

- [ ] **Step 2: Run the migration**

```bash
npx tsx scripts/create-package-updates-table.ts
```

Expected output:
```
✅ package_updates table created successfully
Result: { ... }
```

- [ ] **Step 3: Add migration script to package.json**

Add to `scripts` section in `package.json`:

```json
"db:create-package-updates": "npx tsx scripts/create-package-updates-table.ts"
```

- [ ] **Step 4: Commit migration**

```bash
git add scripts/create-package-updates-table.ts package.json
git add -f docs/superpowers/specs/2026-03-20-package-manager-design.md
git commit -m "feat(db): add package_updates table migration

- Create package_updates table with project FK
- Add indexes for project and status queries
- Add auto-generated ID trigger
- Add npm script for running migration"
```

---

## Chunk 2: Runner Service Extensions

### Task 3: Extend Runner with NPM Operations

**Files:**
- Modify: `runner/index.ts` - Add npm operations

- [ ] **Step 1: Add npm operations to validOperations array**

In `runner/index.ts`, find the `validOperations` array (around line 140-151) and add:

```typescript
const validOperations = [
  "git_pull",
  "docker_restart",
  "docker_rebuild",
  "compose_up",
  "docker_logs",
  "docker_status",
  // Package management operations (NEW)
  "npm_check",
  "npm_update",
  "npm_test",
  "npm_build",
  "npm_backup",
  "npm_restore",
];
```

- [ ] **Step 2: Extend RunnerRequest interface**

Find the `RunnerRequest` interface (around line 96-108) and extend it:

```typescript
interface RunnerRequest {
  operation: string;
  target: {
    repo_path?: string;
    compose_project?: string;
    container_name?: string;
    service_name?: string;
    // NEW: Package management fields
    packages?: string[];      // Specific packages to update
    ecosystem?: string;       // 'npm', 'yarn', 'pnpm', etc.
    test_command?: string;    // Custom test command
    build_command?: string;   // Custom build command
  };
  options?: {
    tail?: number;
    build?: boolean;
    // NEW: Package update options
    run_tests?: boolean;
    run_build?: boolean;
    backup_data?: string;     // Pre-stored backup data
  };
}
```

- [ ] **Step 3: Add npm operation cases to executeOperation**

Find the `executeOperation` function's switch statement (around line 164-218) and add before the closing `}`:

```typescript
// After case "docker_status": ...

case "npm_check": {
  if (!target.repo_path) throw new Error("repo_path required for npm_check");
  const cwd = `cd "${target.repo_path}" &&`;
  const result = await execAsync(`${cwd} npm outdated --json`);
  output = result.stdout;

  // npm outdated returns non-zero when packages are outdated, treat as success
  if (result.stderr && !result.stdout) {
    output = result.stderr;
  }
  break;
}

case "npm_update": {
  if (!target.repo_path) throw new Error("repo_path required for npm_update");
  const packages = target.packages && target.packages.length > 0
    ? target.packages.join(" ")
    : "";
  const result = await execAsync(
    `cd "${target.repo_path}" && npm update ${packages} --json`
  );
  output = result.stdout + result.stderr;
  break;
}

case "npm_test": {
  if (!target.repo_path) throw new Error("repo_path required for npm_test");
  const testCmd = options?.test_command || "npm test";
  const result = await execAsync(`cd "${target.repo_path}" && ${testCmd} -- --json`, {
    timeout: 5 * 60 * 1000, // 5 minute timeout for tests
  });
  output = result.stdout + result.stderr;
  break;
}

case "npm_build": {
  if (!target.repo_path) throw new Error("repo_path required for npm_build");
  const buildCmd = options?.build_command || "npm run build";
  const result = await execAsync(`cd "${target.repo_path}" && ${buildCmd}`, {
    timeout: 10 * 60 * 1000, // 10 minute timeout for builds
  });
  output = result.stdout + result.stderr;
  break;
}

case "npm_backup": {
  if (!target.repo_path) throw new Error("repo_path required for npm_backup");
  const fs = require("fs").promises;

  const backupData: Record<string, string> = {};
  const filesToBackup = ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"];

  for (const file of filesToBackup) {
    try {
      const filePath = `${target.repo_path}/${file}`;
      const content = await fs.readFile(filePath, "utf-8");
      backupData[file] = content;
    } catch {
      // File doesn't exist, skip
    }
  }

  output = JSON.stringify(backupData);
  break;
}

case "npm_restore": {
  if (!target.repo_path) throw new Error("repo_path required for npm_restore");
  if (!options?.backup_data) throw new Error("backup_data required for npm_restore");

  const fs = require("fs").promises;
  const backupData = JSON.parse(options.backup_data as string);

  for (const [filename, content] of Object.entries(backupData)) {
    const filePath = `${target.repo_path}/${filename}`;
    await fs.writeFile(filePath, content as string);
  }

  // Run npm install to ensure dependencies match restored lockfile
  const result = await execAsync(`cd "${target.repo_path}" && npm install`);
  output = JSON.stringify(backupData) + "\n" + result.stdout + result.stderr;
  break;
}
```

> **Note:** npm operations can produce large JSON output. Node's execAsync defaults to 1MB maxBuffer which should be sufficient. If you encounter "maxBuffer exceeded" errors, increase it by passing `maxBuffer: 2 * 1024 * 1024` (2MB) to the execAsync options.

- [ ] **Step 4: Test runner locally**

```bash
# Kill existing runner if running, then start
npx tsx runner/index.ts
```

In another terminal, test the new operations:

```bash
# Test npm_check (replace with actual repo path)
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_RUNNER_TOKEN" \
  -d '{"operation":"npm_check","target":{"repo_path":"/path/to/your/project"}}'
```

- [ ] **Step 5: Commit runner changes**

```bash
git add runner/index.ts
git commit -m "feat(runner): add npm package management operations

- Add npm_check, npm_update, npm_test, npm_build operations
- Add npm_backup and npm_restore for rollback capability
- Extend RunnerRequest with package management fields
- Add timeout handling for long-running tests/builds"
```

---

## Chunk 3: Package Manager Repository

### Task 4: Create Package Updates Repository

**Files:**
- Create: `src/server/atlashub/package-updates.ts` - Repository for package_updates table

- [ ] **Step 1: Create package-updates repository**

Create `src/server/atlashub/package-updates.ts`:

```typescript
/**
 * Package Updates Repository - CRUD operations for package update records
 */

import "server-only";
import * as db from "./client";
import type {
  PackageUpdate,
  CreatePackageUpdateInput,
  UpdatePackageUpdateInput,
  QueryOptions,
} from "@/types";

const TABLE = "package_updates";

/**
 * Get package updates for a project
 */
export async function getPackageUpdates(
  projectId: string,
  options?: QueryOptions
): Promise<PackageUpdate[]> {
  const response = await db.select<PackageUpdate>(TABLE, {
    filters: [{ operator: "eq", column: "project_id", value: projectId }],
    order: { column: "created_at", direction: "desc" },
    limit: 20, // Last 20 updates
    ...options,
  });
  return response.data;
}

/**
 * Get a single package update by ID
 */
export async function getPackageUpdateById(id: string): Promise<PackageUpdate | null> {
  return db.selectById<PackageUpdate>(TABLE, id);
}

/**
 * Get the latest successful package update for rollback
 */
export async function getLatestRollbackableUpdate(
  projectId: string,
  ecosystem: string
): Promise<PackageUpdate | null> {
  const response = await db.select<PackageUpdate>(TABLE, {
    filters: [
      { operator: "eq", column: "project_id", value: projectId },
      { operator: "eq", column: "ecosystem", value: ecosystem },
      { operator: "eq", column: "status", value: "success" },
    ],
    order: { column: "created_at", direction: "desc" },
    limit: 1,
  });
  return response.data[0] || null;
}

/**
 * Create a new package update record
 */
export async function createPackageUpdate(
  input: CreatePackageUpdateInput
): Promise<PackageUpdate> {
  const response = await db.insert<PackageUpdate>(TABLE, {
    ...input,
    created_at: new Date().toISOString(),
  });
  return response.data[0];
}

/**
 * Update a package update record
 */
export async function updatePackageUpdate(
  id: string,
  input: UpdatePackageUpdateInput
): Promise<PackageUpdate | null> {
  return db.updateById<PackageUpdate>(TABLE, id, input);
}

/**
 * Mark update as rolled back
 */
export async function markAsRolledBack(
  id: string,
  errorMessage?: string
): Promise<PackageUpdate | null> {
  return updatePackageUpdate(id, {
    status: "rolled_back",
    completed_at: new Date().toISOString(),
    error_message: errorMessage || "Rolled back after failed tests",
  });
}

/**
 * Mark update as successful
 */
export async function markAsSuccess(
  id: string,
  branchName?: string,
  prUrl?: string
): Promise<PackageUpdate | null> {
  return updatePackageUpdate(id, {
    status: "success",
    completed_at: new Date().toISOString(),
    branch_name: branchName,
    pr_url: prUrl,
  });
}

/**
 * Mark update as failed
 */
export async function markAsFailed(
  id: string,
  errorMessage: string,
  testOutput?: string
): Promise<PackageUpdate | null> {
  return updatePackageUpdate(id, {
    status: "failed",
    completed_at: new Date().toISOString(),
    error_message: errorMessage,
    test_output: testOutput,
  });
}
```

- [ ] **Step 2: Export from atlashub index**

Modify `src/server/atlashub/index.ts` to add:

```typescript
export * as packageUpdates from "./package-updates";
```

- [ ] **Step 3: Commit repository**

```bash
git add src/server/atlashub/package-updates.ts src/server/atlashub/index.ts
git commit -m "feat(atlashub): add package updates repository

- CRUD operations for package_updates table
- Helper methods for status transitions (success, failed, rolled_back)
- Query methods for project history and rollback targets"
```

---

## Chunk 4: Runner Client Extensions

### Task 5: Extend Runner Client with Package Operations

**Files:**
- Modify: `src/server/runner/client.ts` - Add package management functions

- [ ] **Step 1: Add package operation types and functions**

Add to `src/server/runner/client.ts` after the existing operations (after line 263):

```typescript
// ========================================
// Package Management Operations
// ========================================

/**
 * Check for outdated npm packages
 */
export async function npmCheck(
  repoPath: string
): Promise<{ success: boolean; outdated: NpmOutdatedResult[]; error?: string }> {
  const config = getConfig();

  try {
    const response = await fetch(`${config.url}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({
        operation: "npm_check",
        target: { repo_path: repoPath },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, outdated: [], error };
    }

    const result = await response.json();

    if (!result.success) {
      return { success: false, outdated: [], error: result.error };
    }

    // Parse JSON output from npm outdated
    let outdated: NpmOutdatedResult[] = [];
    try {
      const parsed = JSON.parse(result.output);
      outdated = Object.entries(parsed).map(([name, data]: [string, unknown]) => {
        const pkg = data as { current: string; wanted: string; latest: string };
        return { name, ...pkg };
      });
    } catch {
      // npm outdated outputs errors to stdout when no packages
      outdated = [];
    }

    return { success: true, outdated };
  } catch (error) {
    return {
      success: false,
      outdated: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update npm packages
 */
export async function npmUpdate(
  repoPath: string,
  packages?: string[]
): Promise<RunnerResponse> {
  return runnerRequest({
    operation: "npm_update",
    target: { repo_path: repoPath, packages },
  });
}

/**
 * Run npm tests
 */
export async function npmTest(
  repoPath: string,
  testCommand?: string
): Promise<{ success: boolean; output: string; error?: string }> {
  const result = await runnerRequest({
    operation: "npm_test",
    target: { repo_path: repoPath },
    options: { test_command: testCommand },
  });

  return {
    success: result.success,
    output: result.output || "",
    error: result.error,
  };
}

/**
 * Run npm build
 */
export async function npmBuild(
  repoPath: string,
  buildCommand?: string
): Promise<{ success: boolean; output: string; error?: string }> {
  const result = await runnerRequest({
    operation: "npm_build",
    target: { repo_path: repoPath },
    options: { build_command: buildCommand },
  });

  return {
    success: result.success,
    output: result.output || "",
    error: result.error,
  };
}

/**
 * Backup package files for rollback
 */
export async function npmBackup(
  repoPath: string
): Promise<{ success: boolean; backup: BackupData; error?: string }> {
  const result = await runnerRequest({
    operation: "npm_backup",
    target: { repo_path: repoPath },
  });

  if (!result.success) {
    return {
      success: false,
      backup: {},
      error: result.error,
    };
  }

  try {
    const backup = JSON.parse(result.output || "{}");
    return { success: true, backup };
  } catch {
    return {
      success: false,
      backup: {},
      error: "Failed to parse backup data",
    };
  }
}

/**
 * Restore package files from backup
 */
export async function npmRestore(
  repoPath: string,
  backup: BackupData
): Promise<RunnerResponse> {
  return runnerRequest({
    operation: "npm_restore",
    target: { repo_path: repoPath },
    options: { backup_data: JSON.stringify(backup) },
  });
}
```

- [ ] **Step 2: Import new types**

Add to the imports at the top of `src/server/runner/client.ts`:

```typescript
import type { NpmOutdatedResult, BackupData } from "@/types";
```

- [ ] **Step 3: Commit runner client changes**

```bash
git add src/server/runner/client.ts
git commit -m "feat(runner): add package management client functions

- Add npmCheck for detecting outdated packages
- Add npmUpdate, npmTest, npmBuild operations
- Add npmBackup and npmRestore for rollback support
- Proper type definitions for package operations"
```

---

## Chunk 5: API Routes

### Task 6: Create Package Info API Route

**Files:**
- Create: `src/app/api/projects/[id]/packages/route.ts`

- [ ] **Step 1: Create GET /api/projects/[id]/packages route**

Create `src/app/api/projects/[id]/packages/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { projects, services } from "@/server/atlashub";

/**
 * GET /api/projects/[id]/packages
 * Get available repo_paths for a project's services
 * Note: This endpoint helps the UI find which services have repo_path for package operations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const project = await projects.getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch services with repo_path for this project
    const allServices = await services.getServices({
      filters: [
        { operator: "eq", column: "project_id", value: id },
        { operator: "neq", column: "repo_path", value: null }
      ],
      select: ["id", "name", "repo_path", "type"],
    });

    // Extract available repo_paths
    const availableRepoPaths = allServices.map((s) => ({
      service_id: s.id,
      service_name: s.name,
      repo_path: s.repo_path,
    }));

    // Detect ecosystem from lockfile presence (via service name/type heuristics for MVP)
    // Full ecosystem detection via file checking will be in Phase 3
    const ecosystem = "npm"; // MVP default

    return NextResponse.json({
      ecosystem,
      available_repo_paths: availableRepoPaths,
      default_repo_path: availableRepoPaths[0]?.repo_path || null,
      has_repo_path: availableRepoPaths.length > 0,
    });
  } catch (error) {
    console.error("Error fetching package info:", error);
    return NextResponse.json(
      { error: "Failed to fetch package info" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create POST /api/projects/[id]/packages/check route**

Create `src/app/api/projects/[id]/packages/check/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { projects } from "@/server/atlashub";
import { npmCheck } from "@/server/runner";

/**
 * POST /api/projects/[id]/packages/check
 * Check for available package updates
 *
 * Body: { repo_path: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const project = await projects.getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { repo_path } = body;

    if (!repo_path) {
      return NextResponse.json(
        { error: "repo_path is required" },
        { status: 400 }
      );
    }

    const result = await npmCheck(repo_path);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to check packages" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ecosystem: "npm",
      outdated: result.outdated,
      outdated_count: result.outdated.length,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error checking packages:", error);
    return NextResponse.json(
      { error: "Failed to check packages" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create POST /api/projects/[id]/packages/update route**

Create `src/app/api/projects/[id]/packages/update/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { projects, packageUpdates } from "@/server/atlashub";
import {
  npmCheck,
  npmUpdate,
  npmTest,
  npmBuild,
  npmBackup,
  npmRestore,
} from "@/server/runner";
import type { PackageEcosystem } from "@/types";

/**
 * POST /api/projects/[id]/packages/update
 * Update packages with optional test/build verification and rollback
 *
 * Body: {
 *   repo_path: string;
 *   packages?: string[];
 *   run_tests?: boolean;
 *   run_build?: boolean;
 *   is_github_project?: boolean;
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const project = await projects.getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      repo_path,
      packages = [],
      run_tests = true,
      run_build = false,
      is_github_project = false,
    } = body;

    if (!repo_path) {
      return NextResponse.json(
        { error: "repo_path is required" },
        { status: 400 }
      );
    }

    // Step 1: Get current state (before update)
    const beforeCheck = await npmCheck(repo_path);
    const oldVersions: Record<string, string> = {};
    beforeCheck.outdated.forEach((pkg) => {
      oldVersions[pkg.name] = pkg.current;
    });

    // For packages not showing as outdated but being explicitly updated
    packages.forEach((pkg: string) => {
      if (!oldVersions[pkg]) {
        oldVersions[pkg] = "unknown";
      }
    });

    // Step 2: Backup current package files
    const backupResult = await npmBackup(repo_path);
    if (!backupResult.success) {
      return NextResponse.json(
        { error: "Failed to backup package files", details: backupResult.error },
        { status: 500 }
      );
    }

    // Step 3: Create package update record (pending)
    const updateRecord = await packageUpdates.createPackageUpdate({
      project_id: id,
      ecosystem: "npm" as PackageEcosystem,
      packages_updated: packages.length > 0 ? packages : beforeCheck.outdated.map((p) => p.name),
      old_versions: oldVersions,
      new_versions: {}, // Will fill after update
      status: "pending",
      rollback_data: JSON.stringify(backupResult.backup),
    });

    // Step 4: Run the update
    const updateResult = await npmUpdate(
      repo_path,
      packages.length > 0 ? packages : undefined
    );

    if (!updateResult.success) {
      await packageUpdates.markAsFailed(
        updateRecord.id,
        updateResult.error || "Update failed"
      );
      return NextResponse.json(
        { error: "Package update failed", details: updateResult.error },
        { status: 500 }
      );
    }

    // Step 5: Get new versions
    const afterCheck = await npmCheck(repo_path);
    const newVersions: Record<string, string> = {};
    afterCheck.outdated.forEach((pkg) => {
      newVersions[pkg.name] = pkg.wanted; // The version after update
    });
    // Updated packages that are now at latest
    const allUpdated = packages.length > 0 ? packages : beforeCheck.outdated.map((p) => p.name);

    // Step 6: Run tests if requested
    let testPassed = true;
    let testOutput = "";
    if (run_tests) {
      const testResult = await npmTest(repo_path);
      testPassed = testResult.success;
      testOutput = testResult.output;

      if (!testPassed) {
        // Auto-rollback on test failure
        await npmRestore(repo_path, backupResult.backup);
        await packageUpdates.markAsRolledBack(
          updateRecord.id,
          `Tests failed: ${testResult.error || testOutput.slice(0, 500)}`
        );

        return NextResponse.json(
          {
            error: "Tests failed, packages rolled back",
            update_id: updateRecord.id,
            test_output: testOutput,
          },
          { status: 400 }
        );
      }
    }

    // Step 7: Run build if requested
    let buildPassed = true;
    let buildOutput = "";
    if (run_build) {
      const buildResult = await npmBuild(repo_path);
      buildPassed = buildResult.success;
      buildOutput = buildResult.output;

      if (!buildPassed) {
        // Auto-rollback on build failure
        await npmRestore(repo_path, backupResult.backup);
        await packageUpdates.markAsRolledBack(
          updateRecord.id,
          `Build failed: ${buildResult.error || buildOutput.slice(0, 500)}`
        );

        return NextResponse.json(
          {
            error: "Build failed, packages rolled back",
            update_id: updateRecord.id,
            build_output: buildOutput,
          },
          { status: 400 }
        );
      }
    }

    // Step 8: Mark as success
    await packageUpdates.markAsSuccess(updateRecord.id);

    // Note: GitHub integration (commit, push to feature branch) is Phase 4
    // For MVP, updates are applied directly to the local repo

    return NextResponse.json({
      success: true,
      update_id: updateRecord.id,
      updated: allUpdated,
      test_passed: testPassed,
      build_passed: buildPassed,
      new_versions: newVersions,
    });
  } catch (error) {
    console.error("Error updating packages:", error);
    return NextResponse.json(
      { error: "Failed to update packages" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Create GET /api/projects/[id]/packages/history route**

Create `src/app/api/projects/[id]/packages/history/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { projects, packageUpdates } from "@/server/atlashub";

/**
 * GET /api/projects/[id]/packages/history
 * Get package update history for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const project = await projects.getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const history = await packageUpdates.getPackageUpdates(id);

    return NextResponse.json({
      history,
      count: history.length,
    });
  } catch (error) {
    console.error("Error fetching package history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Create POST /api/projects/[id]/packages/rollback route**

Create `src/app/api/projects/[id]/packages/rollback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { projects, packageUpdates } from "@/server/atlashub";
import { npmRestore, npmBackup } from "@/server/runner";

/**
 * POST /api/projects/[id]/packages/rollback
 * Rollback to a previous package state
 *
 * Body: { update_id: string; repo_path: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const project = await projects.getProjectById(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { update_id, repo_path } = body;

    if (!update_id) {
      return NextResponse.json(
        { error: "update_id is required" },
        { status: 400 }
      );
    }

    if (!repo_path) {
      return NextResponse.json(
        { error: "repo_path is required" },
        { status: 400 }
      );
    }

    // Get the update record
    const updateRecord = await packageUpdates.getPackageUpdateById(update_id);

    if (!updateRecord || updateRecord.project_id !== id) {
      return NextResponse.json(
        { error: "Update not found" },
        { status: 404 }
      );
    }

    if (!updateRecord.rollback_data) {
      return NextResponse.json(
        { error: "No rollback data available for this update" },
        { status: 400 }
      );
    }

    // Backup current state before rolling back
    const currentBackup = await npmBackup(repo_path);

    // Restore the old package files
    const backupData = JSON.parse(updateRecord.rollback_data);
    const restoreResult = await npmRestore(repo_path, backupData);

    if (!restoreResult.success) {
      return NextResponse.json(
        { error: "Rollback failed", details: restoreResult.error },
        { status: 500 }
      );
    }

    // Create a new update record for the rollback
    await packageUpdates.createPackageUpdate({
      project_id: id,
      ecosystem: updateRecord.ecosystem,
      packages_updated: updateRecord.packages_updated,
      old_versions: updateRecord.new_versions, // Swapped: current becomes old
      new_versions: updateRecord.old_versions, // Swapped: old becomes new
      status: "success",
      rollback_data: JSON.stringify(currentBackup.backup || {}),
      rollback_from_id: update_id, // Track which update we rolled back
    });

    return NextResponse.json({
      success: true,
      message: "Rollback completed",
      rolled_back_from: update_id,
    });
  } catch (error) {
    console.error("Error rolling back packages:", error);
    return NextResponse.json(
      { error: "Failed to rollback packages" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: Commit API routes**

```bash
git add src/app/api/projects
git commit -m "feat(api): add package management API routes

- GET /api/projects/[id]/packages - Get package info
- POST /api/projects/[id]/packages/check - Check for updates
- POST /api/projects/[id]/packages/update - Update packages with auto-rollback
- GET /api/projects/[id]/packages/history - Get update history
- POST /api/projects/[id]/packages/rollback - Rollback to previous state"
```

---

## Chunk 6: UI Components - Packages Tab

### Task 7: Create Packages Tab Component

**Files:**
- Create: `src/app/(dashboard)/projects/[id]/_components/packages-tab.tsx`

- [ ] **Step 1: Create the packages tab component**

Create `src/app/(dashboard)/projects/[id]/_components/packages-tab.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  Clock,
  History,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Project } from "@/types";

interface PackagesTabProps {
  project: Project;
}

interface PackageCheckResult {
  ecosystem: string;
  outdated: Array<{
    name: string;
    current: string;
    wanted: string;
    latest: string;
  }>;
  outdated_count: number;
  checked_at: string;
}

interface PackageUpdateRecord {
  id: string;
  ecosystem: string;
  packages_updated: string[];
  old_versions: Record<string, string>;
  new_versions: Record<string, string>;
  status: "pending" | "success" | "failed" | "rolled_back";
  test_output: string | null;
  error_message: string | null;
  branch_name: string | null;
  pr_url: string | null;
  created_at: string;
  completed_at: string | null;
}

interface RepoPathOption {
  service_id: string;
  service_name: string;
  repo_path: string;
}

export function PackagesTab({ project }: PackagesTabProps) {
  const [checkResult, setCheckResult] = useState<PackageCheckResult | null>(null);
  const [history, setHistory] = useState<PackageUpdateRecord[]>([]);
  const [availableRepoPaths, setAvailableRepoPaths] = useState<RepoPathOption[]>([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());

  // Fetch available repo paths and history on mount
  useEffect(() => {
    fetchRepoPaths();
    fetchHistory();
  }, [project.id]);

  const fetchRepoPaths = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/packages`);
      if (response.ok) {
        const data = await response.json();
        setAvailableRepoPaths(data.available_repo_paths || []);
        if (data.default_repo_path) {
          setSelectedRepoPath(data.default_repo_path);
        }
      }
    } catch (err) {
      console.error("Failed to fetch repo paths:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/packages/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const handleCheck = async () => {
    if (!selectedRepoPath) {
      setError("No repository path available. Please configure a service with repo_path.");
      return;
    }

    setChecking(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${project.id}/packages/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_path: selectedRepoPath }),
      });

      if (!response.ok) {
        throw new Error("Failed to check packages");
      }

      const data = await response.json();
      setCheckResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check packages");
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRepoPath) {
      setError("No repository path available. Please configure a service with repo_path.");
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${project.id}/packages/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_path: selectedRepoPath,
          packages: Array.from(selectedPackages),
          run_tests: true,
          run_build: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update packages");
      }

      const data = await response.json();
      // Refresh history and check result
      await fetchHistory();
      await handleCheck();
      setSelectedPackages(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update packages");
    } finally {
      setUpdating(false);
    }
  };

  const togglePackage = (packageName: string) => {
    const newSelected = new Set(selectedPackages);
    if (newSelected.has(packageName)) {
      newSelected.delete(packageName);
    } else {
      newSelected.add(packageName);
    }
    setSelectedPackages(newSelected);
  };

  const getStatusIcon = (status: PackageUpdateRecord["status"]) => {
    switch (status) {
      case "success":
        return <Check className="h-4 w-4 text-success" />;
      case "failed":
        return <X className="h-4 w-4 text-destructive" />;
      case "rolled_back":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getVersionColor = (current: string, latest: string) => {
    const currentParts = current.split(".").map(Number);
    const latestParts = latest.split(".").map(Number);

    if (currentParts[0] !== latestParts[0]) return "destructive"; // Major
    if (currentParts[1] !== latestParts[1]) return "warning"; // Minor
    return "secondary"; // Patch
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Repo Path Selection (if multiple available) */}
        {availableRepoPaths.length > 1 && (
          <Card>
            <CardContent className="pt-4">
              <label className="text-sm font-medium mb-2 block">Select Repository:</label>
              <select
                value={selectedRepoPath}
                onChange={(e) => setSelectedRepoPath(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background"
              >
                {availableRepoPaths.map((option) => (
                  <option key={option.service_id} value={option.repo_path}>
                    {option.service_name} ({option.repo_path})
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        )}

        {/* No Repo Path Warning */}
        {availableRepoPaths.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No repository path configured.</p>
              <p className="text-sm mt-1">Add a service with a repo_path to enable package management.</p>
            </CardContent>
          </Card>
        )}

        {/* Package Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Package Status
              {availableRepoPaths.length === 1 && (
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  ({availableRepoPaths[0].service_name})
                </span>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheck}
              disabled={checking || !selectedRepoPath}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
              Check for Updates
            </Button>
          </CardHeader>
          <CardContent>
            {checking ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : checkResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <span>Ecosystem:</span>
                  <Badge variant="secondary">{checkResult.ecosystem}</Badge>
                  <span>Outdated:</span>
                  <Badge
                    variant={checkResult.outdated_count > 0 ? "warning" : "success"}
                  >
                    {checkResult.outdated_count}
                  </Badge>
                </div>

                {checkResult.outdated_count > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {checkResult.outdated_count} package(s) can be updated
                      </p>
                      <Button
                        size="sm"
                        disabled={updating || selectedPackages.size === 0}
                        onClick={handleUpdate}
                      >
                        {updating ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Package className="h-4 w-4 mr-2" />
                            Update {selectedPackages.size || "All"}
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {checkResult.outdated.map((pkg) => (
                        <div
                          key={pkg.name}
                          className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                          onClick={() => togglePackage(pkg.name)}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedPackages.has(pkg.name)}
                              onChange={() => togglePackage(pkg.name)}
                              className="h-4 w-4"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="font-medium text-sm">{pkg.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                              {pkg.current}
                            </code>
                            <span className="text-muted-foreground">→</span>
                            <Badge
                              variant={getVersionColor(pkg.current, pkg.latest)}
                              className="text-xs"
                            >
                              {pkg.latest}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {checkResult.outdated_count === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Check className="h-12 w-12 mx-auto mb-2 text-success" />
                    <p>All packages are up to date!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Click "Check for Updates" to see outdated packages</p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar - History */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Update History
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchHistory}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No updates yet
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {history.map((update) => (
                  <div
                    key={update.id}
                    className="p-3 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(update.status)}
                        <span className="text-xs font-medium">
                          {update.packages_updated.length} package(s)
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(update.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {update.packages_updated.slice(0, 3).map((pkg) => (
                        <Badge key={pkg} variant="outline" className="text-xs">
                          {pkg}
                        </Badge>
                      ))}
                      {update.packages_updated.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{update.packages_updated.length - 3}
                        </Badge>
                      )}
                    </div>

                    {update.status === "failed" && update.error_message && (
                      <p className="text-xs text-destructive truncate">
                        {update.error_message}
                      </p>
                    )}

                    {update.pr_url && (
                      <a
                        href={update.pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View PR →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit packages tab component**

```bash
git add src/app/\(dashboard\)/projects/\[id\]/_components/packages-tab.tsx
git commit -m "feat(ui): add packages tab component

- Display package status and outdated packages
- Check for available updates
- Select individual packages or update all
- Show update history with status indicators
- Error handling and loading states"
```

---

### Task 8: Integrate Packages Tab into Project Detail

**Files:**
- Modify: `src/app/(dashboard)/projects/[id]/_components/project-detail-tabs.tsx`

- [ ] **Step 1: Add "packages" to TabId union**

Find the `type TabId` (around line 51) and add "packages":

```typescript
type TabId = "overview" | "github" | "repository" | "packages" | "security" | "settings";
```

- [ ] **Step 2: Add packages tab to TABS array**

Find the `TABS` constant (around line 64-80) and add the packages tab:

```typescript
const TABS: Tab[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <Activity className="h-4 w-4" />,
    description: "Services, deploys & tasks",
  },
  { id: "github", label: "GitHub", icon: <Github className="h-4 w-4" />, description: "Activity & workflows" },
  {
    id: "repository",
    label: "Repository",
    icon: <FolderTree className="h-4 w-4" />,
    description: "Files & dependencies",
  },
  {
    id: "packages", // NEW TAB
    label: "Packages",
    icon: <Package className="h-4 w-4" />,
    description: "Package management",
  },
  { id: "security", label: "Security", icon: <Shield className="h-4 w-4" />, description: "Alerts & changelog" },
  { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" />, description: "Project configuration" },
];
```

- [ ] **Step 3: Import PackagesTab component**

Add to the imports section:

```typescript
import { PackagesTab } from "./packages-tab";
```

- [ ] **Step 4: Add packages tab to AnimatePresence**

Find the AnimatePresence section (around line 263-286) and add the packages case:

```typescript
{activeTab === "overview" && (
  <OverviewTab
    project={project}
    services={services}
    workItems={workItems}
    deploys={deploys}
    refreshingDeployId={refreshingDeployId}
    onRefreshDeploy={handleRefreshDeploy}
  />
)}
{activeTab === "github" && <GitHubTab project={project} />}
{activeTab === "repository" && <RepositoryTab project={project} />}
{activeTab === "packages" && <PackagesTab project={project} />} {/* NEW */}
{activeTab === "security" && <SecurityTab project={project} />}
{activeTab === "settings" && <SettingsTab project={project} />}
```

- [ ] **Step 5: Commit integration**

```bash
git add src/app/\(dashboard\)/projects/\[id\]/_components/project-detail-tabs.tsx
git commit -m "feat(ui): integrate packages tab into project detail

- Add 'packages' to TabId union
- Add packages tab to TABS array
- Render PackagesTab component when active
- Position between Repository and Security tabs"
```

---

## Chunk 7: Testing and Finalization

### Task 9: End-to-End Testing

- [ ] **Step 1: Manual smoke test**

1. Start the dev server: `npm run dev`
2. Navigate to a project detail page
3. Click on the "Packages" tab
4. Verify the tab loads without errors
5. Verify "Check for Updates" button is present
6. Verify empty state shows when no check has been run

- [ ] **Step 2: Test package check flow**

1. Click "Check for Updates"
2. Verify loading spinner appears
3. Mock a response (or use real project with repo_path)
4. Verify outdated packages display correctly
5. Verify package selection checkboxes work

- [ ] **Step 3: Test API routes directly**

```bash
# Test history endpoint
curl http://localhost:3000/api/projects/PROJECT_ID/packages/history

# Test check endpoint (with actual repo_path)
curl -X POST http://localhost:3000/api/projects/PROJECT_ID/packages/check \
  -H "Content-Type: application/json" \
  -d '{"repo_path": "/path/to/project"}'
```

- [ ] **Step 4: Verify runner operations**

```bash
# Test runner directly
curl -X POST http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"operation":"npm_check","target":{"repo_path":"/path/to/project"}}'
```

- [ ] **Step 5: Check for console errors**

Open browser DevTools and verify no console errors when:
- Navigating to the Packages tab
- Clicking "Check for Updates"
- Selecting/deselecting packages

- [ ] **Step 6: Commit any fixes**

```bash
git commit -am "fix: address issues found during testing"
```

---

### Task 10: Documentation and Cleanup

- [ ] **Step 1: Update CLAUDE.md (if exists)**

Document the new feature in project documentation if applicable.

- [ ] **Step 2: Create a simple README for the feature**

Create `docs/features/package-manager.md`:

```markdown
# Package Manager Feature

The Package Manager allows updating project dependencies directly from the dashboard with automatic rollback on test failure.

## Features

- Check for outdated npm packages
- Update all packages or select specific ones
- Automatic test execution after update
- Auto-rollback if tests fail
- Update history with manual rollback option
- Per-project package management

## Usage

1. Navigate to a project
2. Click the "Packages" tab
3. Click "Check for Updates"
4. Select packages to update (or leave all selected for "Update All")
5. Click "Update" to run the update
6. Tests run automatically; rollback occurs on failure

## API Endpoints

- `GET /api/projects/[id]/packages/history` - Get update history
- `POST /api/projects/[id]/packages/check` - Check for updates
- `POST /api/projects/[id]/packages/update` - Update packages
- `POST /api/projects/[id]/packages/rollback` - Rollback to previous state

## Current Limitations (MVP)

- npm ecosystem only
- repo_path must be configured on a service (auto-detected from services table)
- GitHub integration (branch creation) not yet implemented (Phase 4)
- Multi-ecosystem support (pip, cargo, etc.) planned for Phase 3
```

- [ ] **Step 3: Final commit**

```bash
git add docs/features/package-manager.md
git commit -m "docs: add package manager feature documentation"
```

---

## Chunk 8: Plan Review

### Task 11: Plan Document Review

- [ ] **Step 1: Dispatch plan reviewer**

```bash
# Use the Agent tool with general-purpose subagent
# Provide: path to this plan file
```

- [ ] **Step 2: Address any feedback**

If reviewer finds issues, fix them and re-dispatch.

- [ ] **Step 3: Final verification**

Ensure all steps are complete and documented.

---

## Summary Checklist

- [ ] Chunk 1: Types and Database Setup
- [ ] Chunk 2: Runner Service Extensions
- [ ] Chunk 3: Package Manager Repository
- [ ] Chunk 4: Runner Client Extensions
- [ ] Chunk 5: API Routes
- [ ] Chunk 6: UI Components - Packages Tab
- [ ] Chunk 7: Testing and Finalization
- [ ] Chunk 8: Plan Review

---

## Next Steps After MVP

1. **Store repo_path on Service or Project** - Avoid requiring it in request body
2. **GitHub Integration** - Clone repos, commit updates, push to feature branches
3. **Multi-Ecosystem** - Add pip, cargo, composer support
4. **Custom Test/Build Commands** - Per-project configuration
5. **Auto-Update Scheduler** - Periodic checks for security updates
