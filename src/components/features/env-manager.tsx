"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Badge,
} from "@/components/ui";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Loader2,
  Upload,
  Download,
  Key,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// Helper function for relative time
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

// Types
interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
  id?: string; // DB ID for database operations
}

interface EnvManagerProps {
  serviceId: string;
  serviceName?: string;
  repoPath?: string;
}

/**
 * Merge env vars from database and file source.
 * File values take precedence (runtime truth).
 * DB provides isSecret metadata for existing vars.
 */
function mergeEnvVars(
  dbVars: Array<{ id: string; key: string; value_masked: string; is_secret: boolean }>,
  fileVars: Array<{ key: string; value: string }>
): EnvVar[] {
  const map = new Map<string, EnvVar>();

  // Add DB vars first (for id and isSecret metadata)
  for (const v of dbVars) {
    map.set(v.key, {
      key: v.key,
      value: "", // Will be filled from file
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

// Calculate differences between server and working state
function calculateDiff(server: EnvVar[], working: EnvVar[]) {
  const serverMap = new Map(server.map((v) => [v.key, v]));
  const workingMap = new Map(working.map((v) => [v.key, v]));

  const toCreate: EnvVar[] = [];
  const toUpdate: Array<{ id: string; key: string; value: string; is_secret: boolean }> = [];
  const toDelete: string[] = [];

  // Find new and updated vars
  for (const [key, workingVar] of workingMap) {
    const serverVar = serverMap.get(key);
    if (!serverVar) {
      // New var
      toCreate.push(workingVar);
    } else if (
      workingVar.value !== serverVar.value ||
      workingVar.isSecret !== serverVar.isSecret
    ) {
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

export function EnvManager({ serviceId, serviceName, repoPath }: EnvManagerProps) {
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
      let dbVars: Array<{
        id: string;
        key: string;
        value_masked: string;
        is_secret: boolean;
      }> = [];
      try {
        const dbResponse = await fetch(
          `/api/env-vars?serviceId=${serviceId}`
        );
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

  // Save all changes to both database and file, then restart
  const saveAll = useCallback(async () => {
    if (!repoPath) return false;

    setSaving(true);
    setError(null);

    try {
      const { toCreate, toUpdate, toDelete } = calculateDiff(
        serverVars,
        workingVars
      );

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
        dbOperations.push(fetch(`/api/env-vars/${id}`, { method: "DELETE" }));
      }

      const dbResults = await Promise.allSettled(dbOperations);

      // Check for DB errors
      const dbErrors = dbResults
        .filter((r) => r.status === "rejected")
        .map((r) => (r.status === "rejected" ? r.reason : "Unknown error"));

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
          vars: workingVars.map((v) => ({ key: v.key, value: v.value })),
        }),
      });
      const fileResult = await fileResponse.json();

      if (!fileResult.success) {
        setError(fileResult.error || "Failed to save to file");
        return false;
      }

      // 3. Restart the service
      if (serviceId) {
        try {
          const restartResponse = await fetch(
            `/api/services/${serviceId}/restart`,
            {
              method: "POST",
            }
          );

          // Handle successful responses (including 202 Accepted for self-restart)
          if (restartResponse.ok || restartResponse.status === 202) {
            const restartResult = await restartResponse.json().catch(() => ({ success: true, selfRestart: true }));

            if (restartResult.selfRestart) {
              toast.success("Environment variables saved - Dashboard is restarting...", {
                duration: 5000,
              });
            } else {
              toast.success("Environment variables saved and service restarted");
            }
          } else {
            // Restart failed but file was saved - warn the user
            console.error("[EnvManager] Restart failed with status:", restartResponse.status);
            toast.warning("Saved successfully, but restart failed", {
              description: `Status: ${restartResponse.status}`,
            });
          }
        } catch (restartErr) {
          // Restart failed but file was saved - warn the user
          console.error("[EnvManager] Restart error:", restartErr);
          toast.warning("Environment variables saved, but restart request failed", {
            description: restartErr instanceof Error ? restartErr.message : "Network error",
          });
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

  // Discard unsaved changes
  function handleDiscard() {
    setWorkingVars(serverVars);
    setHasUnsavedChanges(false);
    setEditingId(null);
    setShowAddForm(false);
    setError(null);
  }

  // Initial load
  useEffect(() => {
    if (repoPath) {
      loadAvailableFiles().then(() => loadFromBothSources());
    } else {
      setLoading(false);
    }
  }, [repoPath]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Add new variable to working state only
  function handleAdd() {
    if (!newKey.trim()) return;

    const newVar: EnvVar = {
      key: newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, ""),
      value: newValue,
      isSecret: newIsSecret,
    };

    // Check for duplicate
    if (workingVars.some((v) => v.key === newVar.key)) {
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

  // Update variable in working state only
  function handleUpdate(originalKey: string) {
    if (!editKey.trim()) return;

    const updatedKey = editKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");

    // Check for duplicate if key changed
    if (
      originalKey !== updatedKey &&
      workingVars.some((v) => v.key === updatedKey)
    ) {
      setError(`Variable ${updatedKey} already exists`);
      return;
    }

    setWorkingVars(
      workingVars.map((v) => {
        if (v.key === originalKey) {
          return {
            ...v,
            key: updatedKey,
            value: editValue !== "" ? editValue : v.value,
            isSecret: editIsSecret,
          };
        }
        return v;
      })
    );

    setHasUnsavedChanges(true);
    setEditingId(null);
    setError(null);
    setEditKey("");
    setEditValue("");
    setEditIsSecret(true);
    setRevealEditValue(false);
  }

  // Delete variable from working state only
  function handleDelete(key: string) {
    if (!confirm(`Delete ${key}?`)) return;

    setWorkingVars(workingVars.filter((v) => v.key !== key));
    setHasUnsavedChanges(true);
  }

  // Handle import
  function handleImport() {
    const lines = importText.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    const parsed: EnvVar[] = [];

    for (const line of lines) {
      const eqIndex = line.indexOf("=");
      if (eqIndex > 0) {
        const key = line.slice(0, eqIndex).trim();
        let value = line.slice(eqIndex + 1).trim();

        // Remove surrounding quotes
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
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
      const existingIndex = merged.findIndex((v) => v.key === newVar.key);
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
    toast.success(
      `Imported ${parsed.length} variables - click Save & Restart to apply`
    );
  }

  // Handle export
  function handleExport() {
    const content = workingVars
      .map((v) => `${v.key}=${v.value}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${selectedFile}`);
  }

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
          {saving && (
            <Badge variant="warning" className="animate-pulse">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Saving...
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
                onClick={handleDiscard}
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
                if (hasUnsavedChanges && !confirm("You have unsaved changes. Discard them?")) {
                  return;
                }
                setSelectedFile(e.target.value);
                loadFromBothSources();
              }}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              disabled={loading || saving}
            >
              {availableFiles.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
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
              placeholder="KEY=value&#10;ANOTHER_KEY=value"
              className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!importText.trim()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setImportText("");
                }}
              >
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
                  onChange={(e) =>
                    setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))
                  }
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={!newKey.trim()}>
                <Plus className="h-4 w-4" />
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
        ) : workingVars.length === 0 ? (
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
            {workingVars.map((envVar) => (
              <div
                key={envVar.key}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30"
              >
                {editingId === envVar.key ? (
                  <div className="flex-1 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={editKey}
                        onChange={(e) =>
                          setEditKey(
                            e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "")
                          )
                        }
                        className="font-mono"
                        placeholder="KEY"
                      />
                      <div className="relative">
                        <Input
                          type={editIsSecret && !revealEditValue ? "password" : "text"}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="Value"
                          className="pr-10"
                        />
                        {editIsSecret && (
                          <button
                            type="button"
                            onClick={() => setRevealEditValue(!revealEditValue)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setRevealEditValue(false);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => handleUpdate(envVar.key)}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-medium">
                          {envVar.key}
                        </code>
                        {envVar.isSecret && (
                          <Badge variant="outline" className="text-xs">
                            masked
                          </Badge>
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
                          setEditingId(envVar.key);
                          setEditKey(envVar.key);
                          setEditValue(envVar.value);
                          setEditIsSecret(envVar.isSecret);
                          setRevealEditValue(false);
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
}
