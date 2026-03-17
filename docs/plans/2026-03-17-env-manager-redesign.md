# Env Manager Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor EnvManager to use file-first approach with direct .env file editing, auto-restart on save, and import/export functionality.

**Architecture:** The .env file on the deployed server is the primary source of truth. Changes are written directly to the file via the runner API, with automatic service restart after save. The UI provides form-based editing with live refresh capabilities.

**Tech Stack:** React, TypeScript, Next.js API Routes, Runner Shell Commands

---

## Task 1: Add Service Restart API Endpoint

**Files:**
- Create: `src/app/api/services/[id]/restart/route.ts`

**Step 1: Create the restart API endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { services } from "@/server/data";
import { restartContainer } from "@/server/runner/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const service = await services.getServiceById(id);
    if (!service) {
      return NextResponse.json(
        { success: false, error: "Service not found" },
        { status: 404 }
      );
    }

    if (service.type !== "docker" || !service.container_id) {
      return NextResponse.json(
        { success: false, error: "Service is not a docker container" },
        { status: 400 }
      );
    }

    const result = await restartContainer(service.container_id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to restart container" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Container ${service.container_id} restarted`,
    });
  } catch (error) {
    console.error("[Restart] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Check if restartContainer exists in runner client**

Read: `src/server/runner/client.ts`
- If `restartContainer` exists, skip to Step 4
- If not, continue to Step 3

**Step 3: Add restartContainer function if missing**

Read the runner client to understand the pattern, then add:

```typescript
export async function restartContainer(containerId: string): Promise<RunnerResponse> {
  return executeShellCommand(`docker restart ${containerId}`);
}
```

**Step 4: Test the endpoint manually**

Use curl or the browser dev tools to POST to `/api/services/[id]/restart` and verify it restarts the container.

**Step 5: Commit**

```bash
git add src/app/api/services/[id]/restart/route.ts
git commit -m "feat: add service restart API endpoint"
```

---

## Task 2: Add Export Env File API Endpoint

**Files:**
- Create: `src/app/api/env-vars/export/route.ts`

**Step 1: Create the export endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const { repoPath, filename } = await request.json();

    if (!repoPath) {
      return NextResponse.json(
        { success: false, error: "repoPath is required" },
        { status: 400 }
      );
    }

    if (!RUNNER_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Runner not configured" },
        { status: 500 }
      );
    }

    const envFile = filename || ".env";
    const filePath = `${repoPath}/${envFile}`;

    const response = await fetch(`${RUNNER_URL}/shell`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        command: `cat "${filePath}" 2>/dev/null || echo ""`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { success: false, error: `Runner error: ${error}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    const content = result.stdout || "";

    return NextResponse.json({
      success: true,
      content,
      filename: envFile,
    });
  } catch (error) {
    console.error("[Env Export] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to export env file" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/env-vars/export/route.ts
git commit -m "feat: add env file export API endpoint"
```

---

## Task 3: Refactor EnvManager Component - State and Types

**Files:**
- Modify: `src/components/features/env-manager.tsx`

**Step 1: Define new state interface and initial state**

Replace the existing state declarations (lines ~50-88) with:

```typescript
// Types
interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}

// Data state
const [envVars, setEnvVars] = useState<EnvVar[]>([]);
const [availableFiles, setAvailableFiles] = useState<string[]>([]);
const [selectedFile, setSelectedFile] = useState<string>(".env");

// UI state
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [lastSynced, setLastSynced] = useState<Date | null>(null);
const [isRestarting, setIsRestarting] = useState(false);

// Edit state
const [editingKey, setEditingKey] = useState<string | null>(null);
const [editValue, setEditValue] = useState("");
const [editIsSecret, setEditIsSecret] = useState(true);

// Add form state
const [showAddForm, setShowAddForm] = useState(false);
const [newKey, setNewKey] = useState("");
const [newValue, setNewValue] = useState("");
const [newIsSecret, setNewIsSecret] = useState(true);
const [saving, setSaving] = useState(false);

// Import state
const [showImportModal, setShowImportModal] = useState(false);
const [importText, setImportText] = useState("");
```

**Step 2: Commit**

```bash
git add src/components/features/env-manager.tsx
git commit -m "refactor(env-manager): update state interface for file-first approach"
```

---

## Task 4: Refactor EnvManager Component - Load Functions

**Files:**
- Modify: `src/components/features/env-manager.tsx`

**Step 1: Replace loadEnvVars with loadFromFile function**

Replace the existing `loadEnvVars` callback (around line 90-105) with:

```typescript
// Load available .env files
const loadAvailableFiles = useCallback(async () => {
  if (!repoPath) return;

  try {
    const response = await fetch("/api/env-vars/load-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoPath, action: "list" }),
    });
    const result = await response.json();

    if (result.success && result.files?.length > 0) {
      setAvailableFiles(result.files);
      if (!result.files.includes(selectedFile)) {
        setSelectedFile(result.files[0]);
      }
    }
  } catch (err) {
    console.error("[EnvManager] Failed to list files:", err);
  }
}, [repoPath, selectedFile]);

// Load env vars from file
const loadFromFile = useCallback(async (filename?: string) => {
  if (!repoPath) {
    setError("No repository path configured");
    setLoading(false);
    return;
  }

  setLoading(true);
  setError(null);

  try {
    const fileToLoad = filename || selectedFile;
    const response = await fetch("/api/env-vars/load-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoPath, filename: fileToLoad }),
    });
    const result = await response.json();

    if (result.success) {
      const vars: EnvVar[] = (result.vars || []).map((v: { key: string; value: string }) => ({
        key: v.key,
        value: v.value,
        isSecret: true, // Default all to secret for safety
      }));
      setEnvVars(vars);
      setLastSynced(new Date());
    } else {
      setError(result.error || "Failed to load env file");
    }
  } catch (err) {
    console.error("[EnvManager] Load error:", err);
    setError("Failed to load env file");
  } finally {
    setLoading(false);
  }
}, [repoPath, selectedFile]);

// Initial load
useEffect(() => {
  if (repoPath) {
    loadAvailableFiles().then(() => loadFromFile());
  } else {
    setLoading(false);
  }
}, [repoPath]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Step 2: Commit**

```bash
git add src/components/features/env-manager.tsx
git commit -m "refactor(env-manager): add file-based load functions"
```

---

## Task 5: Refactor EnvManager Component - Save and Restart

**Files:**
- Modify: `src/components/features/env-manager.tsx`

**Step 1: Add save and restart helper functions**

Add after the load functions:

```typescript
// Save env vars to file and restart service
const saveToFileAndRestart = useCallback(async (vars: EnvVar[]) => {
  if (!repoPath) return false;

  setSaving(true);
  try {
    const response = await fetch("/api/env-vars/save-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoPath,
        filename: selectedFile,
        action: "write",
        vars: vars.map(v => ({ key: v.key, value: v.value })),
      }),
    });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || "Failed to save");
      return false;
    }

    // Restart the service
    if (serviceId) {
      setIsRestarting(true);
      try {
        const restartResponse = await fetch(`/api/services/${serviceId}/restart`, {
          method: "POST",
        });
        const restartResult = await restartResponse.json();

        if (!restartResult.success) {
          toast.warning("Env saved, but restart failed", {
            description: restartResult.error,
          });
        } else {
          toast.success("Env saved and service restarted");
        }
      } catch (restartErr) {
        toast.warning("Env saved, but restart failed");
      } finally {
        setIsRestarting(false);
      }
    } else {
      toast.success("Env file saved");
    }

    setLastSynced(new Date());
    return true;
  } catch (err) {
    console.error("[EnvManager] Save error:", err);
    setError("Failed to save env file");
    return false;
  } finally {
    setSaving(false);
  }
}, [repoPath, selectedFile, serviceId]);
```

**Step 2: Commit**

```bash
git add src/components/features/env-manager.tsx
git commit -m "refactor(env-manager): add save and restart helper"
```

---

## Task 6: Refactor EnvManager Component - CRUD Operations

**Files:**
- Modify: `src/components/features/env-manager.tsx`

**Step 1: Replace handleAdd function**

Replace the existing `handleAdd` function with:

```typescript
async function handleAdd() {
  if (!newKey.trim()) return;

  const newVar: EnvVar = {
    key: newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, ""),
    value: newValue,
    isSecret: newIsSecret,
  };

  // Check for duplicate
  if (envVars.some(v => v.key === newVar.key)) {
    setError(`Variable ${newVar.key} already exists`);
    return;
  }

  const updatedVars = [...envVars, newVar];
  setEnvVars(updatedVars);

  const success = await saveToFileAndRestart(updatedVars);
  if (success) {
    setNewKey("");
    setNewValue("");
    setNewIsSecret(true);
    setShowAddForm(false);
  }
}
```

**Step 2: Replace handleUpdate function**

Replace the existing `handleUpdate` function with:

```typescript
async function handleUpdate(originalKey: string) {
  if (!editKey.trim()) return;

  const updatedKey = editKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");

  // Check for duplicate if key changed
  if (originalKey !== updatedKey && envVars.some(v => v.key === updatedKey)) {
    setError(`Variable ${updatedKey} already exists`);
    return;
  }

  const updatedVars = envVars.map(v => {
    if (v.key === originalKey) {
      return {
        key: updatedKey,
        value: editValue !== "" ? editValue : v.value,
        isSecret: editIsSecret,
      };
    }
    return v;
  });

  setEnvVars(updatedVars);
  setEditingKey(null);

  const success = await saveToFileAndRestart(updatedVars);
  if (success) {
    setEditKey("");
    setEditValue("");
  }
}
```

**Step 3: Replace handleDelete function**

Replace the existing `handleDelete` function with:

```typescript
async function handleDelete(key: string) {
  if (!confirm(`Delete ${key}?`)) return;

  const updatedVars = envVars.filter(v => v.key !== key);
  setEnvVars(updatedVars);

  await saveToFileAndRestart(updatedVars);
}
```

**Step 4: Commit**

```bash
git add src/components/features/env-manager.tsx
git commit -m "refactor(env-manager): update CRUD operations for file-first"
```

---

## Task 7: Add Import and Export Functions

**Files:**
- Modify: `src/components/features/env-manager.tsx`

**Step 1: Add import function**

Add after the CRUD operations:

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

  // Merge with existing (new values override)
  const merged = [...envVars];
  for (const newVar of parsed) {
    const existingIndex = merged.findIndex(v => v.key === newVar.key);
    if (existingIndex >= 0) {
      merged[existingIndex] = newVar;
    } else {
      merged.push(newVar);
    }
  }

  setEnvVars(merged);
  setShowImportModal(false);
  setImportText("");

  const success = await saveToFileAndRestart(merged);
  if (success) {
    toast.success(`Imported ${parsed.length} variables`);
  }
}

function handleExport() {
  const content = envVars.map(v => `${v.key}=${v.value}`).join("\n");
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

**Step 2: Add Download icon import**

Add `Download` to the lucide-react import at the top of the file.

**Step 3: Commit**

```bash
git add src/components/features/env-manager.tsx
git commit -m "feat(env-manager): add import and export functions"
```

---

## Task 8: Refactor EnvManager Component - UI Render

**Files:**
- Modify: `src/components/features/env-manager.tsx`

**Step 1: Replace the return JSX with new UI**

Replace the entire return statement with the new UI structure:

```tsx
return (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between">
      <div>
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="h-4 w-4" />
          Environment Variables
        </CardTitle>
        <CardDescription>
          {serviceName || "Service"} • {selectedFile}
          {lastSynced && (
            <span className="ml-2 text-xs">
              Synced {formatRelativeTime(lastSynced)}
            </span>
          )}
        </CardDescription>
      </div>
      <div className="flex items-center gap-2">
        {isRestarting && (
          <Badge variant="warning" className="animate-pulse">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Restarting...
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadFromFile()}
          disabled={loading || saving}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowImportModal(!showImportModal)}
        >
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={envVars.length === 0}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* File Selector */}
      {availableFiles.length > 1 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm">File:</Label>
          <select
            value={selectedFile}
            onChange={(e) => {
              setSelectedFile(e.target.value);
              loadFromFile(e.target.value);
            }}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            disabled={loading}
          >
            {availableFiles.map((file) => (
              <option key={file} value={file}>{file}</option>
            ))}
          </select>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="space-y-3 p-4 rounded-lg border border-border bg-secondary/30">
          <Label>Import .env content</Label>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="KEY=value\nANOTHER_KEY=value"
            className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleImport} disabled={!importText.trim()}>
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              setShowImportModal(false);
              setImportText("");
            }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="space-y-3 p-4 rounded-lg border border-border bg-secondary/30">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Key</Label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                placeholder="DATABASE_URL"
                className="font-mono"
              />
            </div>
            <div>
              <Label>Value</Label>
              <Input
                type={newIsSecret ? "password" : "text"}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter value..."
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newIsSecret}
                onChange={(e) => setNewIsSecret(e.target.checked)}
                className="rounded"
              />
              Mask in UI
            </label>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={saving || !newKey.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : envVars.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">
            No environment variables in {selectedFile}
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add your first variable
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {envVars.map((envVar) => (
            <div
              key={envVar.key}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30"
            >
              {editingKey === envVar.key ? (
                <div className="flex-1 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={editKey}
                      onChange={(e) => setEditKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                      className="font-mono"
                    />
                    <Input
                      type="password"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Leave empty to keep current"
                    />
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
                    <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => handleUpdate(envVar.key)} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono font-medium">{envVar.key}</code>
                      {envVar.isSecret && (
                        <Badge variant="outline" className="text-xs">masked</Badge>
                      )}
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">
                      {envVar.isSecret ? "••••••••" : envVar.value}
                    </code>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingKey(envVar.key);
                        setEditKey(envVar.key);
                        setEditValue("");
                        setEditIsSecret(envVar.isSecret);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(envVar.key)}
                      className="text-destructive hover:text-destructive"
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No repo path warning */}
      {!repoPath && (
        <div className="rounded-lg bg-warning/10 p-3 text-sm text-warning">
          Configure a repository path in service settings to manage env files.
        </div>
      )}
    </CardContent>
  </Card>
);
```

**Step 2: Add helper function for relative time**

Add before the component:

```typescript
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

**Step 3: Clean up unused imports**

Remove unused imports like `Eye`, `EyeOff`, `Copy`, `Check`, `HardDrive`, `FileText`.

**Step 4: Commit**

```bash
git add src/components/features/env-manager.tsx
git commit -m "refactor(env-manager): update UI for file-first approach"
```

---

## Task 9: Remove Old DB-Related Code

**Files:**
- Modify: `src/components/features/env-manager.tsx`

**Step 1: Remove unused state variables**

Remove any remaining DB-related state like:
- `revealedValues`
- `revealingId`
- `syncToFile`
- `saveToFile`
- `showBulkImport`
- `bulkText`
- `showLoadFromFile`
- `loadingFromFile`
- `fileEnvVars`
- `selectedFileVars`
- `copiedId`

**Step 2: Remove unused functions**

Remove any remaining DB-related functions like:
- `handleReveal`
- `handleCopy`
- `handleBulkImport`
- `handleLoadAvailableFiles` (old version)
- `handleLoadEnvFile`
- `handleImportSelectedVars`
- `toggleFileVarSelection`
- `startEdit` (if separate from inline)

**Step 3: Verify no unused imports**

Make sure all imports are used.

**Step 4: Commit**

```bash
git add src/components/features/env-manager.tsx
git commit -m "refactor(env-manager): remove unused DB-related code"
```

---

## Task 10: Final Testing and Cleanup

**Step 1: Test the full flow**

1. Navigate to a service detail page with a configured repo_path
2. Verify env vars load from the deployed project
3. Add a new variable and verify it saves and restarts
4. Edit a variable and verify the update
5. Delete a variable and verify it's removed
6. Test Import with pasted .env content
7. Test Export downloads the file
8. Test Refresh button reloads from deployed project

**Step 2: Check for TypeScript errors**

```bash
cd /path/to/project
npx tsc --noEmit
```

**Step 3: Fix any errors**

Address any TypeScript or linting errors found.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete env manager redesign with file-first approach

- Refactored EnvManager to use .env file as primary source
- Added auto-restart after env changes
- Added import/export functionality
- Added refresh button to reload from deployed project
- Removed DB-first sync logic"
```

---

## Summary

This plan transforms the EnvManager from a DB-first approach to a file-first approach:

1. **New API endpoint** for restarting services
2. **New API endpoint** for exporting env files
3. **Refactored component** with simplified state
4. **Direct file operations** instead of DB sync
5. **Auto-restart** after saving changes
6. **Import/Export** functionality

The user can now:
- Load env vars from deployed project with refresh button
- Edit env vars in real-time with immediate file updates
- Import/export .env files
- Have services auto-restart after changes
