# Environment Manager Redesign

**Date:** 2026-03-17
**Status:** Approved
**Approach:** File-First with Direct File Operations

## Overview

Redesign the EnvManager component to use a file-first approach where the `.env` file on the deployed server is the primary source of truth. Changes are written directly to the file with automatic service restart.

## Problem Statement

1. Cannot load env file from deployed project to dashboard envs
2. Envs are not live updating when editing
3. No import/export functionality
4. Current implementation is DB-first, not file-first as desired

## Solution: File-First Architecture

### Data Flow

```
User Edit → Save to File → Auto-restart Service → Reload from File → Update UI
                    ↓
              (Optional) Sync to DB
```

### Component Structure

```
EnvManager (refactored)
├── EnvFileHeader - Refresh, Import, Export buttons
├── EnvFileSelector - Dropdown to select .env/.env.local/.env.production
├── EnvVarList - List of env vars with inline editing
│   └── EnvVarItem - Individual var with edit/delete/reveal
├── EnvVarForm - Add new variable form
└── RestartIndicator - Shows when restart is pending/in-progress
```

## UI/UX Design

### Header Actions

| Button | Icon | Action |
|--------|------|--------|
| Refresh | RefreshCw | Reload env vars from deployed project |
| Import | Upload | Upload .env file or paste text |
| Export | Download | Download current env vars as .env file |
| Add | Plus | Add new variable |

### Env File Selector

- Dropdown showing available `.env*` files (`.env`, `.env.local`, `.env.production`, etc.)
- Auto-load first file found on component mount
- Show file path as muted text below selector

### Variable List

- Each row shows: `KEY` (badge if secret) | `value` (masked by default) | actions
- Inline editing: click edit icon → form expands in place
- Live updates: optimistic UI updates with rollback on error

### Status Indicators

- Loading spinner while fetching
- "Synced" badge with timestamp when loaded
- "Restarting..." indicator when service is restarting
- Error banner with dismiss button

### Add/Edit Form

- Two inputs: Key (uppercase, alphanumeric + underscore) and Value
- "Secret" checkbox (affects display masking only, file is always plaintext)
- Save/Cancel buttons

## Error Handling

### Connection Errors

- If runner is unreachable: Show error banner with "Retry" button
- If repo path doesn't exist: Show "Configure repo path in service settings"

### File Not Found

- If no `.env` file exists: Show "Create .env" button
- After create: Load empty state with "Add your first variable"

### Concurrent Edits

- Use optimistic updates with server confirmation
- On conflict (file changed externally): Show "File changed, refresh?" dialog
- Timestamp-based conflict detection

### Restart Failures

- If restart fails: Show error with logs link
- Allow manual retry or "Skip restart" option
- Keep env changes saved even if restart fails

### Validation

- Key: Required, uppercase, alphanumeric + underscore only
- Value: No validation (any string allowed)
- Duplicate keys: Show warning, allow overwrite

### Import/Export

- Import: Parse .env format, show preview before applying
- Export: Download as `.env` file with proper formatting

## Implementation Details

### Files to Modify

1. `src/components/features/env-manager.tsx` - Major refactor
2. `src/app/api/env-vars/load-file/route.ts` - Minor tweaks
3. `src/app/api/env-vars/save-file/route.ts` - Add restart trigger

### New API Endpoint

- `POST /api/services/[id]/restart` - Restart container/service

### State Management

```typescript
interface EnvManagerState {
  // Data
  envVars: EnvVar[];           // Current env vars from file
  availableFiles: string[];    // List of .env files
  selectedFile: string;        // Currently selected file

  // UI State
  loading: boolean;
  error: string | null;
  lastSynced: Date | null;
  isRestarting: boolean;

  // Edit State
  editingKey: string | null;
  addingNew: boolean;
}

interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}
```

### Auto-restart Logic

1. After successful save to file
2. Call restart API for the service
3. Show "Restarting..." indicator
4. Poll service status until healthy
5. Clear indicator and show success toast

### Import/Export Implementation

- Import: File upload → parse → preview → write to file → restart
- Export: Read from file → format as .env → download blob

## Trade-offs

| Pros | Cons |
|------|------|
| Changes are immediate | Requires runner connection |
| No sync lag | Less secure (file is plaintext) |
| Simpler mental model | No version history in file |

## Success Criteria

1. Users can load env vars from deployed project with refresh button
2. Users can edit env vars in real-time with immediate file updates
3. Service auto-restarts after env changes
4. Import/Export functionality works correctly
5. UI shows live status of operations
