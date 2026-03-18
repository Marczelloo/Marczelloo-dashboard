# Env Manager Improvements - Design Spec

**Date:** 2026-03-18
**Status:** Approved

## Overview

Improve the env manager to support dual-sync (database + file), show actual values when editing, and enable bulk editing with a single save/restart action.

## Requirements

### 1. Dual-Source Sync
- Load from both database and .env file on mount
- Merge logic: File values take precedence (runtime truth), DB preserves for history
- Save changes to both sources on "Save & Restart"

### 2. Edit Value Display
- When editing, input field shows the actual current value
- For secret values, show masked by default with toggle to reveal

### 3. Bulk Editing
- All changes (add/edit/delete) update local state immediately
- Visual indicator for unsaved changes
- "Save & Restart" button persists all changes at once
- "Discard" button reverts to server state

## Architecture

### Component State

```typescript
interface EnvManagerState {
  // Server state (as loaded)
  serverVars: EnvVar[];
  lastSynced: Date | null;

  // Working state (local edits)
  workingVars: EnvVar[];
  hasUnsavedChanges: boolean;

  // UI state
  editingId: string | null;
  showAddForm: boolean;
  saving: boolean;
}
```

### Data Flow

```
┌─────────────┐
│   Mount     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  Load from DB               │
│  Load from File             │
│  Merge (file wins)          │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  serverVars = merged        │
│  workingVars = merged       │
│  hasUnsavedChanges = false  │
└─────────────────────────────┘
       │
       │ User edits (add/edit/delete)
       ▼
┌─────────────────────────────┐
│  workingVars = updated      │
│  hasUnsavedChanges = true   │
│  Show "unsaved" indicator   │
└─────────────────────────────┘
       │
       │ Click "Save & Restart"
       ▼
┌─────────────────────────────┐
│  POST /api/env-vars         │
│  POST /api/env-vars/save    │
│  POST /api/services/.../    │
│  restart                    │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  serverVars = workingVars   │
│  hasUnsavedChanges = false  │
│  Show success toast         │
└─────────────────────────────┘
```

### API Usage

**Load:**
```
GET /api/env-vars?serviceId={id}     → DB vars
POST /api/env-vars/load-file          → File vars
```

**Save:**
```
POST /api/env-vars                     → Create/update DB
DELETE /api/env-vars/{id}              → Delete from DB
POST /api/env-vars/save-file           → Write to file
POST /api/services/{id}/restart        → Restart service
```

## UI Changes

### Header Actions
| Button | Behavior |
|--------|----------|
| Refresh | Reload from server (discard unsaved) |
| Import | Show import modal |
| Export | Download .env file |
| **Save & Restart** | Persist all changes + restart (new) |
| **Discard** | Revert to server state (new) |

### Edit Behavior
- Click Edit → input shows actual value (not empty)
- For secrets: show `••••` initially, with eye icon to reveal
- Save is disabled until "Save & Restart" is clicked
- Cancel edit reverts that row to workingVars state

### Unsaved Indicator
- Yellow badge "Unsaved changes" when hasUnsavedChanges
- Disable switching files when unsaved
- Warn on page unload if unsaved

## Implementation Notes

### Merge Logic (Load)
```typescript
function mergeEnvVars(dbVars: EnvVar[], fileVars: EnvVar[]): EnvVar[] {
  const map = new Map<string, EnvVar>();

  // Add DB vars first (for isSecret metadata)
  for (const v of dbVars) {
    map.set(v.key, { ...v });
  }

  // File values override (runtime truth)
  for (const v of fileVars) {
    const existing = map.get(v.key);
    if (existing) {
      map.set(v.key, { ...existing, value: v.value });
    } else {
      map.set(v.key, { ...v, isSecret: true }); // Default new file vars to secret
    }
  }

  return Array.from(map.values());
}
```

### Save Logic (Batch)
```typescript
async function saveAll() {
  // 1. Calculate diff between serverVars and workingVars
  const { toCreate, toUpdate, toDelete } = calculateDiff(serverVars, workingVars);

  // 2. Database operations (parallel)
  await Promise.all([
    ...toCreate.map(v => fetch('/api/env-vars', { method: 'POST', body: JSON.stringify(v) })),
    ...toUpdate.map(v => fetch(`/api/env-vars/${v.id}`, { method: 'PATCH', body: JSON.stringify(v) })),
    ...toDelete.map(id => fetch(`/api/env-vars/${id}`, { method: 'DELETE' })),
  ]);

  // 3. File write
  await fetch('/api/env-vars/save-file', {
    method: 'POST',
    body: JSON.stringify({
      repoPath,
      filename: selectedFile,
      action: 'write',
      vars: workingVars
    })
  });

  // 4. Restart service
  await fetch(`/api/services/${serviceId}/restart`, { method: 'POST' });

  // 5. Update server state
  setServerVars(workingVars);
  setHasUnsavedChanges(false);
}
```

## Testing

- [ ] Load merges DB + file correctly
- [ ] Edit shows actual value
- [ ] Multiple edits can be made before save
- [ ] Save persists to both DB and file
- [ ] Service restarts after save
- [ ] Discard reverts to server state
- [ ] Unsaved indicator appears/disappears
- [ ] Page unload warning when unsaved
