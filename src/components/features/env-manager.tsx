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
}

// Legacy interface - kept for compatibility during migration
interface EnvVarDisplay {
  id: string;
  service_id: string;
  key: string;
  value_masked: string;
  is_secret: boolean;
  updated_at: string;
}

interface EnvManagerProps {
  serviceId: string;
  serviceName?: string;
  repoPath?: string;
}

export function EnvManager({ serviceId, serviceName, repoPath }: EnvManagerProps) {
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

  // Legacy state - kept for compatibility during migration (will be removed)
  const [syncToFile, setSyncToFile] = useState(!!repoPath);
  const [saveToFile, setSaveToFile] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showLoadFromFile, setShowLoadFromFile] = useState(false);
  const [loadingFromFile, setLoadingFromFile] = useState(false);
  const [availableEnvFiles, setAvailableEnvFiles] = useState<string[]>([]);
  const [selectedEnvFile, setSelectedEnvFile] = useState(".env");
  const [fileEnvVars, setFileEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [selectedFileVars, setSelectedFileVars] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadEnvVars = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/env-vars?serviceId=${serviceId}`);
      const result = await response.json();
      if (result.success) {
        setEnvVars(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to load environment variables");
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

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

  // Initial load
  useEffect(() => {
    if (repoPath) {
      loadAvailableFiles().then(() => loadFromFile());
    } else {
      setLoading(false);
    }
  }, [repoPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadEnvVars();
  }, [loadEnvVars]);

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

    try {
      const success = await saveToFileAndRestart(updatedVars);
      if (success) {
        setNewKey("");
        setNewValue("");
        setNewIsSecret(true);
        setShowAddForm(false);
      }
    } catch (err) {
      console.error("[EnvManager] Add error:", err);
      setError("Failed to add environment variable");
    }
  }

  async function handleUpdate(id: string) {
    if (!editKey.trim()) return;

    const updatedKey = editKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");

    // Check for duplicate if key changed
    if (id !== updatedKey && envVars.some(v => v.key === updatedKey)) {
      setError(`Variable ${updatedKey} already exists`);
      return;
    }

    const updatedVars = envVars.map(v => {
      if (v.key === id) {
        return {
          key: updatedKey,
          value: editValue !== "" ? editValue : v.value,
          isSecret: editIsSecret,
        };
      }
      return v;
    });

    setEnvVars(updatedVars);
    setEditingId(null);

    try {
      const success = await saveToFileAndRestart(updatedVars);
      if (success) {
        setEditKey("");
        setEditValue("");
      }
    } catch (err) {
      console.error("[EnvManager] Update error:", err);
      setError("Failed to update environment variable");
    }
  }

  async function handleDelete(id: string) {
    const envVar = envVars.find(v => v.key === id);
    if (!envVar) return;

    if (!confirm(`Delete ${envVar.key}?`)) return;

    const updatedVars = envVars.filter(v => v.key !== id);
    setEnvVars(updatedVars);

    try {
      await saveToFileAndRestart(updatedVars);
    } catch (err) {
      console.error("[EnvManager] Delete error:", err);
      setError("Failed to delete environment variable");
    }
  }

  async function handleReveal(key: string) {
    if (revealedValues[key]) {
      // Hide if already revealed
      setRevealedValues((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      return;
    }

    setRevealingId(key);
    try {
      const response = await fetch(`/api/env-vars/${encodeURIComponent(key)}?serviceId=${serviceId}`);
      const result = await response.json();

      if (result.success) {
        setRevealedValues((prev) => ({ ...prev, [key]: result.value }));
      } else if (result.requirePin) {
        setError("PIN verification required. Please verify PIN first.");
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to reveal value");
    } finally {
      setRevealingId(null);
    }
  }

  async function handleCopy(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  }

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

  async function handleBulkImport() {
    const lines = bulkText.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    const parsed: { key: string; value: string }[] = [];

    for (const line of lines) {
      const eqIndex = line.indexOf("=");
      if (eqIndex > 0) {
        const key = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 1).trim();
        if (key) {
          parsed.push({ key, value });
        }
      }
    }

    if (parsed.length === 0) {
      setError("No valid KEY=VALUE pairs found");
      return;
    }

    setAdding(true);
    try {
      for (const { key, value } of parsed) {
        await fetch("/api/env-vars", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: serviceId,
            key,
            value,
            is_secret: true,
          }),
        });
      }
      await loadEnvVars();
      setBulkText("");
      setShowBulkImport(false);
    } catch {
      setError("Failed to import some variables");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(envVar: EnvVar) {
    setEditingId(envVar.key);
    setEditKey(envVar.key);
    setEditValue("");
    setEditIsSecret(envVar.isSecret);
  }

  async function handleLoadAvailableFiles() {
    if (!repoPath) {
      setError("No repository path configured for this service");
      return;
    }
    setLoadingFromFile(true);
    setError(null);
    try {
      console.log("[EnvManager] Loading files from:", repoPath);
      const response = await fetch("/api/env-vars/load-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath, action: "list" }),
      });
      const result = await response.json();
      console.log("[EnvManager] Load result:", result);
      if (result.success && result.files) {
        setAvailableEnvFiles(result.files);
        if (result.files.length > 0) {
          setSelectedEnvFile(result.files[0]);
        } else {
          console.log("[EnvManager] No .env files found in:", repoPath);
        }
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      console.error("[EnvManager] Error:", err);
      setError("Failed to list .env files");
    } finally {
      setLoadingFromFile(false);
    }
  }

  async function handleLoadEnvFile() {
    if (!repoPath || !selectedEnvFile) return;
    setLoadingFromFile(true);
    try {
      const response = await fetch("/api/env-vars/load-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath, filename: selectedEnvFile }),
      });
      const result = await response.json();
      if (result.success && result.vars) {
        setFileEnvVars(result.vars);
        setSelectedFileVars(new Set(result.vars.map((v: { key: string }) => v.key)));
      } else {
        setError(result.error || "Failed to load file");
      }
    } catch {
      setError("Failed to load .env file");
    } finally {
      setLoadingFromFile(false);
    }
  }

  async function handleImportSelectedVars() {
    setAdding(true);
    try {
      for (const envVar of fileEnvVars) {
        if (selectedFileVars.has(envVar.key)) {
          await fetch("/api/env-vars", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_id: serviceId,
              key: envVar.key,
              value: envVar.value,
              is_secret: true,
            }),
          });
        }
      }
      await loadEnvVars();
      setShowLoadFromFile(false);
      setFileEnvVars([]);
      setSelectedFileVars(new Set());
    } catch {
      setError("Failed to import selected variables");
    } finally {
      setAdding(false);
    }
  }

  function toggleFileVarSelection(key: string) {
    setSelectedFileVars((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
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
            title="Refresh from server"
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
              placeholder="KEY=value&#10;ANOTHER_KEY=value"
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
                {editingId === envVar.key ? (
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
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
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
                          setEditingId(envVar.key);
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
}
