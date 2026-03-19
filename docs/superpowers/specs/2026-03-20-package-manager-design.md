# Package Manager Feature Design

**Date:** 2026-03-20
**Status:** Design Approved
**Author:** Claude + Marczelloo

## Overview

A per-project package management feature that allows updating project dependencies through the dashboard UI with automatic rollback on test failure. Supports multiple ecosystems (npm, pip, cargo, composer, poetry, yarn, pnpm).

## Goals

- Enable safe package updates directly from the dashboard
- Automatic rollback when tests/builds fail after update
- Support both local projects and GitHub-based projects
- Track update history for each project
- Support multiple package ecosystems

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Project Detail Page - Packages Tab               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ Package Status  │  │ Outdated List   │  │ Update History  │     │
│  │                 │  │                 │  │                 │     │
│  │ - Ecosystem     │  │ - Select pkgs   │  │ - Past updates  │     │
│  │ - Outdated cnt  │  │ - Update All    │  │ - Rollback btns │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API Layer                                    │
│  /api/projects/[id]/packages/*                                      │
│    - check, update, rollback, history                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Runner Service                                 │
│  New operations: npm_update, pip_update, cargo_update, etc.         │
│  Backup/restore operations + test/build runners                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Projects (Local or GitHub)                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Packages Tab (UI)

**Location:** `/projects/[id]` → "Packages" tab

**Features:**
- Package status card showing ecosystem, outdated count, last update
- List of outdated packages with version diff (old → new)
- Checkboxes for selecting individual packages or "Update All"
- Update options: run tests, run build, create PR (GitHub)
- Update history with rollback buttons
- Real-time progress indicators during updates

**Tabs to add:**
```tsx
const tabs = [
  { id: "overview", label: "Overview" },
  { id: "services", label: "Services" },
  { id: "dependencies", label: "Dependencies" }, // existing - read-only
  { id: "packages", label: "Packages" },         // NEW - interactive
  { id: "deploys", label: "Deployments" },
  { id: "github", label: "GitHub" },
];
```

**Note:** The "Dependencies" tab remains as the read-only view from GitHub's dependency snapshot API. "Packages" is the new interactive manager.

### 2. API Routes

```
GET  /api/projects/[id]/packages          - Get project package info & status
POST /api/projects/[id]/packages/check    - Check for available updates
POST /api/projects/[id]/packages/update   - Trigger update workflow
POST /api/projects/[id]/packages/rollback - Rollback to previous state
GET  /api/projects/[id]/packages/history  - Get update history (last 20)
```

### 3. Runner Service Extensions

**New operations to add to `runner/index.ts`:**

| Operation | Description |
|-----------|-------------|
| `npm_check` | Check for outdated packages (`npm outdated`) |
| `npm_update` | Update packages (`npm update` or install specific) |
| `npm_test` | Run tests (`npm test`) |
| `npm_build` | Run build (`npm run build`) |
| `npm_backup` | Backup package.json, package-lock.json, yarn.lock |
| `npm_restore` | Restore backed up files |
| `pip_check` | Check outdated (`pip list --outdated`) |
| `pip_update` | Update (`pip install --upgrade -r requirements.txt`) |
| `pip_test` | Run tests (`pytest`) |
| `pip_backup` | Backup requirements.txt, poetry.lock |
| `pip_restore` | Restore backed up files |
| `cargo_check` | Check outdated (`cargo outdated`) |
| `cargo_update` | Update (`cargo update`) |
| `cargo_test` | Run tests (`cargo test`) |
| `cargo_build` | Run build (`cargo build`) |
| `cargo_backup` | Backup Cargo.toml, Cargo.lock |
| `cargo_restore` | Restore backed up files |
| (Similar for composer, poetry, yarn, pnpm) |

### 4. Database Schema

**New table: `package_updates`**

```sql
CREATE TABLE package_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  ecosystem TEXT NOT NULL,                    -- 'npm', 'pip', 'cargo', etc.
  packages_updated TEXT NOT NULL,             -- JSON: ["react", "next", ...]
  old_versions TEXT NOT NULL,                 -- JSON: {"react": "19.0.0", ...}
  new_versions TEXT NOT NULL,                 -- JSON: {"react": "19.0.1", ...}
  status TEXT NOT NULL,                       -- 'pending', 'success', 'failed', 'rolled_back'
  test_output TEXT,                           -- test/build results
  error_message TEXT,                         -- error details if failed
  branch_name TEXT,                           -- feature branch for GitHub projects
  pr_url TEXT,                                -- created PR URL
  rollback_data TEXT,                         -- backed up lockfile content
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_package_updates_project ON package_updates(project_id, created_at DESC);
```

**Optional projects table extensions** (for caching):
```sql
ALTER TABLE projects ADD COLUMN package_ecosystem TEXT;
ALTER TABLE projects ADD COLUMN package_last_check TIMESTAMP;
ALTER TABLE projects ADD COLUMN package_status TEXT;
ALTER TABLE projects ADD COLUMN package_data TEXT;
```

## Package Ecosystem Support

| Ecosystem | Detect File | Update Command | Test Command | Build Command |
|-----------|-------------|----------------|--------------|---------------|
| npm | package.json | `npm update` | `npm test` | `npm run build` |
| yarn | package.json + yarn.lock | `yarn upgrade` | `yarn test` | `yarn build` |
| pnpm | package.json + pnpm-lock.yaml | `pnpm update` | `pnpm test` | `pnpm build` |
| pip | requirements.txt | `pip install --upgrade -r requirements.txt` | `pytest` | (custom) |
| poetry | pyproject.toml + poetry.lock | `poetry update` | `poetry run pytest` | `poetry build` |
| cargo | Cargo.toml + Cargo.lock | `cargo update` | `cargo test` | `cargo build` |
| composer | composer.json + composer.lock | `composer update` | `phpunit` | (custom) |

**Ecosystem detection:** Check for existence of lockfiles/manifests in project root.

## Update Workflow

```
┌──────────────────────────────────────────────────────────────────────┐
│ User selects packages → Click "Update"                               │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 1. Backup Phase                                                      │
│    - Runner backs up package.json, lockfiles                        │
│    - Store in rollback_data column                                  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 2. Update Phase                                                      │
│    - Execute update command (npm update / pip install --upgrade)     │
│    - Capture output                                                  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 3. Verification Phase (parallel if possible)                         │
│    ├─> Run tests (if option enabled)                                │
│    ├─> Run build (if option enabled)                                │
│    └─> Health check (if deployed and option enabled)                │
└──────────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        SUCCESS                        FAILURE
                │                           │
                │                           ▼
                │                   ┌───────────────────┐
                │                   │ 4a. Auto-rollback │
                │                   │    - Restore backup│
                │                   │    - Re-install    │
                │                   │    - Mark: rolled_│
                │                   │      back          │
                │                   │    - Show error    │
                │                   └───────────────────┘
                │
                ▼
        ┌───────────────────────┐
        │ 4b. Handle by Type    │
        │                       │
        │ Local projects:       │
        │  - Update complete    │
        │  - Keep backup for    │
        │    manual rollback    │
        │                       │
        │ GitHub projects:      │
        │  - Commit changes     │
        │    "chore: update     │
        │     dependencies"     │
        │  - Push to branch     │
        │    deps/update-{ts}   │
        │  - Mark with branch   │
        │    name               │
        │  - User creates PR    │
        └───────────────────────┘
```

## Rollback Strategy

**Automatic Rollback (on test/build failure):**
1. Restore backed up package.json and lockfiles
2. Re-run package install to match restored lockfiles
3. Mark update status as `rolled_back`
4. Display error and test output to user

**Manual Rollback:**
- User can click "Rollback" on any recent successful update
- Same restore process as automatic
- Available for updates within retention period (configurable, default 30 days)

**Backup files stored per ecosystem:**
- npm: package.json, package-lock.json, yarn.lock, pnpm-lock.yaml
- pip: requirements.txt, poetry.lock, pyproject.toml
- cargo: Cargo.toml, Cargo.lock
- composer: composer.json, composer.lock

## Error Handling

| Error Type | Detection | User Action |
|------------|-----------|-------------|
| No package manager | No lockfile/manifest found | Prompt to configure ecosystem manually |
| Update command failed | Non-zero exit code | Show error output, retry option |
| Test failure | Test command non-zero | Auto-rollback, show test output |
| Build failure | Build command non-zero | Auto-rollback, show build logs |
| Network timeout | Command exceeds 15min | Show timeout, retry option |
| Disk space | df check before update | Block update, show free space |
| Git dirty state | Uncommitted changes (GitHub) | Prompt to stash or commit first |
| GitHub auth failure | Can't push to branch | Show auth error, reconfigure token |

## Security Considerations

1. **Command restrictions** - Extend runner blocklist for dangerous package operations
2. **Sandboxing** - Run updates in temp directory when possible (GitHub projects)
3. **Token security** - GitHub tokens for PR creation stored securely (env vars)
4. **Rate limiting** - Limit concurrent updates (max 2-3 at a time)
5. **File size limits** - Cap backup file sizes (max 5MB per lockfile)

## Implementation Phases

### Phase 1: Core Update Flow (MVP)
- Add runner operations for npm only
- Backup/restore mechanism
- Basic UI in Packages tab (npm projects)
- API endpoints for check/update/history
- Database table creation

### Phase 2: Verification & Rollback
- Test command execution
- Build command execution
- Auto-rollback on failure
- Update history display with rollback buttons

### Phase 3: Multi-Ecosystem Support
- Add pip, cargo, composer operations
- Ecosystem detection from files
- Package selection UI per ecosystem

### Phase 4: GitHub Integration
- Clone to temp directory
- Update workflow
- Commit and push to feature branch
- PR creation/update notification

## File Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── projects/
│   │       └── [id]/
│   │           ├── _components/
│   │           │   ├── project-detail-tabs.tsx       # UPDATE: add "packages" tab
│   │           │   └── packages-tab.tsx              # NEW
│   │           └── page.tsx
│   └── api/
│       └── projects/
│           └── [id]/
│               └── packages/
│                   ├── route.ts                      # GET package info
│                   ├── check/route.ts                # POST check updates
│                   ├── update/route.ts               # POST update workflow
│                   ├── rollback/route.ts             # POST rollback
│                   └── history/route.ts              # GET history

runner/
└── index.ts                                          # UPDATE: add package operations

lib/
└── package-manager/                                  # NEW
    ├── ecosystem-detector.ts
    ├── version-parser.ts
    └── rollback-manager.ts
```

## Success Criteria

- [ ] User can check for package updates from the dashboard
- [ ] User can update all packages or select individual ones
- [ ] Tests run automatically after update
- [ ] Failed updates auto-rollback to previous state
- [ ] Update history shows past 20 updates per project
- [ ] Manual rollback available for recent updates
- [ ] GitHub projects push updates to feature branches
- [ ] Multiple ecosystems supported (npm, pip, cargo, composer)
