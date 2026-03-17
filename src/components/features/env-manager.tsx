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
  Eye,
  EyeOff,
  Trash2,
  Edit2,
  Save,
  X,
  Loader2,
  Copy,
  Check,
  Upload,
  Key,
  FileText,
  RefreshCw,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";

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
          <CardDescription>Manage encrypted environment variables for {serviceName || "this service"}</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          {repoPath && (
            <label className="flex items-center gap-2 text-sm cursor-pointer" title="Sync all changes to .env file">
              <input
                type="checkbox"
                checked={syncToFile}
                onChange={(e) => setSyncToFile(e.target.checked)}
                className="rounded"
              />
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Sync to file</span>
            </label>
          )}
          <div className="flex gap-2">
            {repoPath && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowLoadFromFile(!showLoadFromFile);
                  if (!showLoadFromFile) handleLoadAvailableFiles();
                }}
              >
                <FileText className="h-4 w-4" />
                Load .env
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowBulkImport(!showBulkImport)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Load from .env File */}
        {showLoadFromFile && (
          <div className="space-y-3 p-4 rounded-lg border border-border bg-secondary/30">
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Load from .env file
                </Label>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{repoPath}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => handleLoadAvailableFiles()} disabled={loadingFromFile}>
                <RefreshCw className={`h-4 w-4 ${loadingFromFile ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {availableEnvFiles.length > 0 ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={selectedEnvFile}
                    onChange={(e) => setSelectedEnvFile(e.target.value)}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {availableEnvFiles.map((file) => (
                      <option key={file} value={file}>
                        {file}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" onClick={handleLoadEnvFile} disabled={loadingFromFile}>
                    {loadingFromFile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}
                  </Button>
                </div>

                {fileEnvVars.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {selectedFileVars.size} of {fileEnvVars.length} selected
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedFileVars(new Set(fileEnvVars.map((v) => v.key)))}
                          className="text-xs text-primary hover:underline"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedFileVars(new Set())}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {fileEnvVars.map((v) => (
                        <label
                          key={v.key}
                          className="flex items-center gap-2 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFileVars.has(v.key)}
                            onChange={() => toggleFileVarSelection(v.key)}
                            className="rounded"
                          />
                          <code className="text-xs font-mono">{v.key}</code>
                          <span className="text-xs text-muted-foreground truncate">
                            = {v.value.substring(0, 30)}
                            {v.value.length > 30 ? "..." : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={handleImportSelectedVars}
                        disabled={adding || selectedFileVars.size === 0}
                      >
                        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Import Selected
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowLoadFromFile(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>{loadingFromFile ? "Searching for .env files..." : `No .env files found at ${repoPath}`}</p>
                {!loadingFromFile && (
                  <p className="text-xs">
                    Make sure the path is correct and .env files exist. You can also use &quot;Import&quot; to paste env
                    vars directly.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bulk Import Form */}
        {showBulkImport && (
          <div className="space-y-3 p-4 rounded-lg border border-border bg-secondary/30">
            <Label>Bulk Import (KEY=VALUE format)</Label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`# Paste your .env file content\nDATABASE_URL=postgres://...\nAPI_KEY=xxx`}
              className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleBulkImport} disabled={adding || !bulkText.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowBulkImport(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Add New Form */}
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
            <div className="flex items-center gap-4 flex-wrap">
              {repoPath ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={saveToFile}
                    onChange={(e) => {
                      setSaveToFile(e.target.checked);
                      if (e.target.checked) setNewIsSecret(false);
                    }}
                    className="rounded"
                  />
                  Save to .env file
                </label>
              ) : null}
              {!saveToFile && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newIsSecret}
                    onChange={(e) => setNewIsSecret(e.target.checked)}
                    className="rounded"
                  />
                  Secret (encrypted in DB)
                </label>
              )}
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={adding || !newKey.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saveToFile ? "Add to .env" : "Add to DB"}
              </Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : envVars.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No environment variables yet. Click &quot;Add&quot; to create one.
          </p>
        ) : (
          <div className="space-y-2">
            {envVars.map((envVar) => (
              <div
                key={envVar.key}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30"
              >
                {editingId === envVar.key ? (
                  // Edit Mode
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
                        Secret
                      </label>
                      <div className="flex-1" />
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => handleUpdate(envVar.key)}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-medium">{envVar.key}</code>
                        {envVar.isSecret && (
                          <Badge variant="outline" className="text-xs">
                            secret
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs text-muted-foreground font-mono">
                          {revealedValues[envVar.key] || (envVar.isSecret ? "••••••••" : envVar.value)}
                        </code>
                        {revealedValues[envVar.key] && (
                          <button
                            onClick={() => handleCopy(envVar.key, revealedValues[envVar.key])}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedId === envVar.key ? (
                              <Check className="h-3 w-3 text-success" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReveal(envVar.key)}
                        disabled={revealingId === envVar.key}
                      >
                        {revealingId === envVar.key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : revealedValues[envVar.key] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(envVar)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(envVar.key)}
                        className="text-destructive hover:text-destructive"
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
      </CardContent>
    </Card>
  );
}
