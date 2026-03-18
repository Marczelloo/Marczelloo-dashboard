# Env Manager Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the env manager with dual-sync (database + file), bulk editing with manual save/restart, and proper edit value display.

**Architecture:** Component maintains separate server/working state. Changes update local state only. "Save & Restart" persists to both DB and file, then restarts. "Discard" reverts to server state.

**Tech Stack:** React, TypeScript, Next.js API Routes, existing database APIs, runner shell commands

---

## File Structure

```
src/components/features/env-manager.tsx  (modify - main refactor)
src/app/api/env-vars/route.ts            (existing - DB API)
src/app/api/env-vars/[id]/route.ts       (existing - DB individual)
src/app/api/env-vars/load-file/route.ts  (existing - file load)
src/app/api/env-vars/save-file/route.ts  (existing - file save)
src/app/api/services/[id]/restart/route.ts (existing - restart)
```

---

## Chunk 1: Component State Refactor

### Task 1: Add New State Variables

**Files:**
- Modify: `src/components/features/env-manager.tsx:58-85`

Replace existing state declarations with dual-state pattern:

- [ ] **Step 1: Update state interface and declarations**

```typescript
// Types
interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
  id?: string;  // DB ID for database operations
}

// Server state (as loaded from DB + file)
const [serverVars, setServerVars] = useState<EnvVar[]>([]);

// Working state (local edits)
const [workingVars, setWorkingVars] = useState<EnvVar[]>([]);
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

// Available files and selection
const [availableFiles, setAvailableFiles] = useState<string[]>([]);
const [selectedFile, setSelectedFile] = useState<string>(".env");

// UI state
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [lastSynced, setLastSynced] = useState<Date | null>(null);
const [saving, setSaving] = useState(false);

// Add form state
const [showAddForm, setShowAddForm] = useState(false);
const [newKey, setNewKey] = useState("");
const [newValue, setNewValue] = useState("");
const [newIsSecret, setNewIsSecret] = useState(true);

// Import state
const [showImportModal, setShowImportModal] = useState(false);
const [importText, setImportText] = useState("");

// Edit state (inline editing)
const [editingId, setEditingId] = useState<string | null>(null);
const [editKey, setEditKey] = useState("");
const [editValue, setEditValue] = useState("");
const [editIsSecret, setEditIsSecret] = useState(true);
const [revealEditValue, setRevealEditValue] = useState(false);
```

- [ ] **Step 2: Commit state refactor**

```bash
git add src/components/features/env-manager.tsx
git commit -m "refactor(env-manager): add dual state pattern for bulk editing"
```

---

## Chunk 2: Merge Logic for Dual Source

### Task 2: Add Merge Function

**Files:**
- Modify: `src/components/features/env-manager.tsx` (after line 55)

Add the merge function before the component:

- [ ] **Step 1: Add merge utility function**

```typescript
/**
 * Merge env vars from database and file source.
 * File values take precedence (runtime truth).
 * DB provides isSecret metadata for existing vars.
 */
function mergeEnvVars(dbVars: Array<{ id: string; key: string; value_masked: string; is_secret: boolean }>, fileVars: Array<{ key: string; value: string }>): EnvVar[] {
  const map = new Map<string, EnvVar>();

  // Add DB vars first (for id and isSecret metadata)
  for (const v of dbVars) {
    map.set(v.key, {
      key: v.key,
      value: "",  // Will be filled from file
      isSecret: v.is_secret,
      id: v.id,
    });
  }

  // File values override (runtime truth)
  for (const v of fileVars) {
    const existing = map.get(v.key);
    if (existing) {
      map.set(v.key, { ...existing, value: v.value });
    } else {
      // New var from file, default to secret
      map.set(v.key, { key: v.key, value: v.value, isSecret: true });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}
```

- [ ] **Step 2: Commit merge function**

```bash
git add src/components/features/env-manager.tsx
git commit -m "feat(env-manager): add merge function for DB + file sources"
```

---

## Chunk 3: Load from Both Sources

### Task 3: Refactor Load Function

**Files:**
- Modify: `src/components/features/env-manager.tsx` (replace existing loadFromFile)

- [ ] **Step 1: Replace loadFromFile with loadFromBothSources**

```typescript
// Load env vars from both database and file
const loadFromBothSources = useCallback(async () => {
  if (!repoPath) {
    setError("No repository path configured");
    setLoading(false);
    return;
  }

  setLoading(true);
  setError(null);

  try {
    // Load from database
    let dbVars: Array<{ id: string; key: string; value_masked: string; is_secret: boolean }> = [];
    try {
      const dbResponse = await fetch(`/api/env-vars?serviceId=${serviceId}`);
      const dbResult = await dbResponse.json();
      if (dbResult.success) {
        dbVars = dbResult.data || [];
      }
    } catch (dbErr) {
      console.error("[EnvManager] DB load error:", dbErr);
      // Continue with file-only if DB fails
    }

    // Load from file
    let fileVars: Array<{ key: string; value: string }> = [];
    try {
      const fileResponse = await fetch("/api/env-vars/load-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath, filename: selectedFile }),
      });
      const fileResult = await fileResponse.json();
      if (fileResult.success) {
        fileVars = fileResult.vars || [];
      }
    } catch (fileErr) {
      console.error("[EnvManager] File load error:", fileErr);
    }

    // Merge both sources
    const merged = mergeEnvVars(dbVars, fileVars);

    setServerVars(merged);
    setWorkingVars(merged);
    setHasUnsavedChanges(false);
    setLastSynced(new Date());
  } catch (err) {
    console.error("[EnvManager] Load error:", err);
    setError("Failed to load environment variables");
  } finally {
    setLoading(false);
  }
}, [repoPath, selectedFile, serviceId]);
```

- [ ] **Step 2: Update initial load effect**

Replace the existing useEffect (around line 208) with:

```typescript
// Initial load
useEffect(() => {
  if (repoPath) {
    loadAvailableFiles().then(() => loadFromBothSources());
  } else {
    setLoading(false);
  }
}, [repoPath]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Update refresh button handler**

Change the refresh button onClick (around line 413) to call `loadFromBothSources()` instead of `loadFromFile()`.

- [ ] **Step 4: Commit load refactor**

```bash
git add src/components/features/env-manager.tsx
git commit -m "feat(env-manager): load from both database and file sources"
```

---

## Chunk 4: Save to Both Sources

### Task 4: Add Save All Function

**Files:**
- Modify: `src/components/features/env-manager.tsx` (replace saveToFileAndRestart)

- [ ] **Step 1: Add calculateDiff helper and saveAll function**

Replace the existing `saveToFileAndRestart` function with:

```typescript
// Calculate differences between server and working state
function calculateDiff(server: EnvVar[], working: EnvVar[]) {
  const serverMap = new Map(server.map(v => [v.key, v]));
  const workingMap = new Map(working.map(v => [v.key, v]));

  const toCreate: EnvVar[] = [];
  const toUpdate: Array<{ id: string; key: string; value: string; is_secret: boolean }> = [];
  const toDelete: string[] = [];

  // Find new and updated vars
  for (const [key, workingVar] of workingMap) {
    const serverVar = serverMap.get(key);
    if (!serverVar) {
      // New var
      toCreate.push(workingVar);
    } else if (workingVar.value !== serverVar.value || workingVar.isSecret !== serverVar.isSecret) {
      // Updated var (has DB ID)
      if (serverVar.id) {
        toUpdate.push({
          id: serverVar.id,
          key: workingVar.key,
          value: workingVar.value,
          is_secret: workingVar.isSecret,
        });
      }
    }
  }

  // Find deleted vars
  for (const [key, serverVar] of serverMap) {
    if (!workingMap.has(key) && serverVar.id) {
      toDelete.push(serverVar.id);
    }
  }

  return { toCreate, toUpdate, toDelete };
}

// Save all changes to both database and file, then restart
const saveAll = useCallback(async () => {
  if (!repoPath) return false;

  setSaving(true);
  setError(null);

  try {
    const { toCreate, toUpdate, toDelete } = calculateDiff(serverVars, workingVars);

    // 1. Database operations (parallel)
    const dbOperations = [];

    for (const v of toCreate) {
      dbOperations.push(
        fetch("/api/env-vars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: serviceId,
            key: v.key,
            value: v.value,
            is_secret: v.isSecret,
          }),
        })
      );
    }

    for (const v of toUpdate) {
      dbOperations.push(
        fetch(`/api/env-vars/${v.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: v.key,
            value: v.value,
            is_secret: v.is_secret,
          }),
        })
      );
    }

    for (const id of toDelete) {
      dbOperations.push(
        fetch(`/api/env-vars/${id}`, { method: "DELETE" })
      );
    }

    const dbResults = await Promise.allSettled(dbOperations);

    // Check for DB errors
    const dbErrors = dbResults.filter(r => r.status === "rejected").map(r =>
      r.status === "rejected" ? r.reason : "Unknown error"
    );

    if (dbErrors.length > 0) {
      console.error("[EnvManager] DB errors:", dbErrors);
      // Continue to file save even if DB fails
    }

    // 2. Save to file
    const fileResponse = await fetch("/api/env-vars/save-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoPath,
        filename: selectedFile,
        action: "write",
        vars: workingVars.map(v => ({ key: v.key, value: v.value })),
      }),
    });
    const fileResult = await fileResponse.json();

    if (!fileResult.success) {
      setError(fileResult.error || "Failed to save to file");
      return false;
    }

    // 3. Restart the service
    if (serviceId) {
      const restartResponse = await fetch(`/api/services/${serviceId}/restart`, {
        method: "POST",
      });
      const restartResult = await restartResponse.json();

      if (!restartResult.success) {
        toast.warning("Saved successfully, but restart failed", {
          description: restartResult.error,
        });
      } else {
        toast.success("Environment variables saved and service restarted");
      }
    } else {
      toast.success("Environment variables saved");
    }

    // 4. Update server state
    setServerVars(workingVars);
    setHasUnsavedChanges(false);
    setLastSynced(new Date());

    return true;
  } catch (err) {
    console.error("[EnvManager] Save error:", err);
    setError("Failed to save environment variables");
    return false;
  } finally {
    setSaving(false);
  }
}, [repoPath, selectedFile, serviceId, serverVars, workingVars]);
```

- [ ] **Step 2: Commit save function**

```bash
git add src/components/features/env-manager.tsx
git commit -m "feat(env-manager): add save all function for DB + file sync"
```

---

## Chunk 5: Edit Operations (Local State Only)

### Task 5: Update Edit Handlers

**Files:**
- Modify: `src/components/features/env-manager.tsx` (replace handleAdd, handleUpdate, handleDelete)

- [ ] **Step 1: Replace handleAdd with local-only version**

```typescript
// Add new variable to working state only
function handleAdd() {
  if (!newKey.trim()) return;

  const newVar: EnvVar = {
    key: newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, ""),
    value: newValue,
    isSecret: newIsSecret,
  };

  // Check for duplicate
  if (workingVars.some(v => v.key === newVar.key)) {
    setError(`Variable ${newVar.key} already exists`);
    return;
  }

  setWorkingVars([...workingVars, newVar]);
  setHasUnsavedChanges(true);
  setError(null);

  // Reset form
  setNewKey("");
  setNewValue("");
  setNewIsSecret(true);
  setShowAddForm(false);
}
```

- [ ] **Step 2: Replace handleUpdate with local-only version**

```typescript
// Update variable in working state only
function handleUpdate(originalKey: string) {
  if (!editKey.trim()) return;

  const updatedKey = editKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");

  // Check for duplicate if key changed
  if (originalKey !== updatedKey && workingVars.some(v => v.key === updatedKey)) {
    setError(`Variable ${updatedKey} already exists`);
    return;
  }

  setWorkingVars(workingVars.map(v => {
    if (v.key === originalKey) {
      return {
        ...v,
        key: updatedKey,
        value: editValue !== "" ? editValue : v.value,
        isSecret: editIsSecret,
      };
    }
    return v;
  }));

  setHasUnsavedChanges(true);
  setEditingId(null);
  setError(null);
  setEditKey("");
  setEditValue("");
  setEditIsSecret(true);
  setRevealEditValue(false);
}
```

- [ ] **Step 3: Replace handleDelete with local-only version**

```typescript
// Delete variable from working state only
function handleDelete(key: string) {
  if (!confirm(`Delete ${key}?`)) return;

  setWorkingVars(workingVars.filter(v => v.key !== key));
  setHasUnsavedChanges(true);
}
```

- [ ] **Step 4: Commit handler updates**

```bash
git add src/components/features/env-manager.tsx
git commit -m "refactor(env-manager): change handlers to local-state only"
```

---

## Chunk 6: Edit Value Display Fix

### Task 6: Show Actual Value in Edit Mode

**Files:**
- Modify: `src/components/features/env-manager.tsx` (update edit button onClick)

- [ ] **Step 1: Update edit button to populate actual value**

Find the edit button onClick handler (around line 620) and replace with:

```typescript
<Button
  size="sm"
  variant="ghost"
  onClick={() => {
    const envVar = workingVars.find(v => v.key === envVar.key);
    if (envVar) {
      setEditingId(envVar.key);
      setEditKey(envVar.key);
      setEditValue(envVar.value);
      setEditIsSecret(envVar.isSecret);
      setRevealEditValue(false);
    }
  }}
>
  <Edit2 className="h-4 w-4" />
</Button>
```

Actually, there's a bug - the envVar variable is shadowed. Fix it:

```typescript
{envVars.map((envVar) => (
  // ...
  <Button
    size="sm"
    variant="ghost"
    onClick={() => {
      setEditingId(envVar.key);
      setEditKey(envVar.key);
      setEditValue(envVar.value);
      setEditIsSecret(envVar.isSecret);
      setRevealEditValue(false);
    }}
  >
    <Edit2 className="h-4 w-4" />
  </Button>
```

Wait, we also need to change `envVars` to `workingVars` in the map. Let me fix the whole display section.

- [ ] **Step 2: Change envVars to workingVars in the display**

Find `{envVars.map((envVar) => (` and change to `{workingVars.map((envVar) => (`.

Also find other references to `envVars.length` in the display section and change to `workingVars.length`.

- [ ] **Step 3: Commit edit value fix**

```bash
git add src/components/features/env-manager.tsx
git commit -m "fix(env-manager): show actual value in edit mode"
```

---

## Chunk 7: UI - Save, Discard, Unsaved Indicator

### Task 7: Add Save/Discard Buttons and Unsaved Indicator

**Files:**
- Modify: `src/components/features/env-manager.tsx` (header section)

- [ ] **Step 1: Add Save & Restart and Discard buttons to header**

Update the header buttons section (around line 403) to include the new buttons:

```typescript
<div className="flex items-center gap-2">
  {isRestarting && (
    <Badge variant="warning" className="animate-pulse">
      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      Restarting...
    </Badge>
  )}

  {hasUnsavedChanges && (
    <Badge variant="warning" className="animate-pulse">
      Unsaved changes
    </Badge>
  )}

  <Button
    variant="outline"
    size="sm"
    onClick={() => loadFromBothSources()}
    disabled={loading || saving}
    title="Refresh from server"
  >
    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
  </Button>

  <Button
    variant="outline"
    size="sm"
    onClick={() => setShowImportModal(!showImportModal)}
    disabled={saving}
  >
    <Upload className="h-4 w-4" />
    Import
  </Button>

  <Button
    variant="outline"
    size="sm"
    onClick={handleExport}
    disabled={workingVars.length === 0 || saving}
  >
    <Download className="h-4 w-4" />
    Export
  </Button>

  {hasUnsavedChanges && (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setWorkingVars(serverVars);
          setHasUnsavedChanges(false);
          setEditingId(null);
          setShowAddForm(false);
          setError(null);
        }}
        disabled={saving}
      >
        Discard
      </Button>

      <Button
        variant="default"
        size="sm"
        onClick={saveAll}
        disabled={saving}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-1" />
        )}
        Save & Restart
      </Button>
    </>
  )}

  <Button
    variant="outline"
    size="sm"
    onClick={() => setShowAddForm(!showAddForm)}
    disabled={saving}
  >
    <Plus className="h-4 w-4" />
    Add
  </Button>
</div>
```

- [ ] **Step 2: Update handleExport to use workingVars**

```typescript
function handleExport() {
  const content = workingVars.map(v => `${v.key}=${v.value}`).join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = selectedFile;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Downloaded ${selectedFile}`);
}
```

- [ ] **Step 3: Update import to use workingVars**

Find `handleImport` and update to use `workingVars`:

```typescript
async function handleImport() {
  const lines = importText.split("\n").filter(l => l.trim() && !l.startsWith("#"));
  const parsed: EnvVar[] = [];

  for (const line of lines) {
    const eqIndex = line.indexOf("=");
    if (eqIndex > 0) {
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();

      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key) {
        parsed.push({ key, value, isSecret: true });
      }
    }
  }

  if (parsed.length === 0) {
    setError("No valid KEY=VALUE pairs found");
    return;
  }

  // Merge with working vars (new values override)
  const merged = [...workingVars];
  for (const newVar of parsed) {
    const existingIndex = merged.findIndex(v => v.key === newVar.key);
    if (existingIndex >= 0) {
      merged[existingIndex] = newVar;
    } else {
      merged.push(newVar);
    }
  }

  setWorkingVars(merged);
  setHasUnsavedChanges(true);
  setShowImportModal(false);
  setImportText("");
  toast.success(`Imported ${parsed.length} variables - click Save to apply`);
}
```

- [ ] **Step 4: Update empty state to use workingVars**

```typescript
) : workingVars.length === 0 ? (
```

- [ ] **Step 5: Commit UI updates**

```bash
git add src/components/features/env-manager.tsx
git commit -m "feat(env-manager): add Save/Discard buttons and unsaved indicator"
```

---

## Chunk 8: Edit Input Improvements

### Task 8: Improve Edit Input with Reveal Toggle

**Files:**
- Modify: `src/components/features/env-manager.tsx` (edit section)

- [ ] **Step 1: Update edit mode to show value with reveal toggle**

Replace the edit mode section (around line 569) with:

```typescript
{editingId === envVar.key ? (
  <div className="flex-1 space-y-2">
    <div className="grid gap-2 sm:grid-cols-2">
      <Input
        value={editKey}
        onChange={(e) => setEditKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
        className="font-mono"
        placeholder="KEY"
      />
      <div className="relative">
        <Input
          type={editIsSecret && !revealEditValue ? "password" : "text"}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder="Value"
          className="pr-8"
        />
        {editIsSecret && (
          <button
            type="button"
            onClick={() => setRevealEditValue(!revealEditValue)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {revealEditValue ? "👁️" : "•••"}
          </button>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={editIsSecret}
          onChange={(e) => setEditIsSecret(e.target.checked)}
          className="rounded"
        />
        Mask in UI
      </label>
      <div className="flex-1" />
      <Button size="sm" variant="ghost" onClick={() => {
        setEditingId(null);
        setRevealEditValue(false);
      }}>
        <X className="h-4 w-4" />
      </Button>
      <Button size="sm" onClick={() => handleUpdate(envVar.key)}>
        <Save className="h-4 w-4" />
      </Button>
    </div>
  </div>
) : (
```

- [ ] **Step 2: Commit edit input improvements**

```bash
git add src/components/features/env-manager.tsx
git commit -m "feat(env-manager): add reveal toggle in edit mode"
```

---

## Chunk 9: Page Unload Warning

### Task 9: Add Unsaved Changes Warning on Navigation

**Files:**
- Modify: `src/components/features/env-manager.tsx`

- [ ] **Step 1: Add beforeunload event listener**

Add this useEffect after the initial load effect:

```typescript
// Warn on unsaved changes
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = "";
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [hasUnsavedChanges]);
```

- [ ] **Step 2: Commit unload warning**

```bash
git add src/components/features/env-manager.tsx
git commit -m "feat(env-manager): add unsaved changes warning on navigation"
```

---

## Chunk 10: Final Testing and Polish

### Task 10: Test and Verify

- [ ] **Step 1: Manual testing checklist**

Test the following scenarios:
1. Load component - vars from DB + file merge correctly
2. Click Edit - actual value shown in input
3. Edit value - only local state updates
4. Add new var - appears in list, "Unsaved changes" badge shows
5. Delete var - removed from list, "Unsaved changes" badge shows
6. Click Save & Restart - all changes persist, service restarts
7. Click Discard - reverts to server state
8. Click Export - downloads current working state
9. Import new vars - adds to working state, shows unsaved
10. Refresh button - reloads from server, discards unsaved

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Fix any TypeScript errors**

- [ ] **Step 4: Commit final polish**

```bash
git add .
git commit -m "chore(env-manager): final polish and testing"
```

---

## Summary

This plan refactors the env manager to:
1. Load from both database and file sources
2. Track changes locally (workingVars) separate from server state
3. Save all changes at once to both DB and file
4. Show actual values in edit mode
5. Add "Save & Restart" and "Discard" buttons
6. Warn on unsaved changes

Total commits: ~10
Files modified: 1 (env-manager.tsx)
Lines changed: ~300 (refactor, mostly restructure)
