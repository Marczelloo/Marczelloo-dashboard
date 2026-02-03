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
} from "lucide-react";

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
  const [envVars, setEnvVars] = useState<EnvVarDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New env var form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newIsSecret, setNewIsSecret] = useState(true);
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editIsSecret, setEditIsSecret] = useState(true);

  // Reveal state
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);

  // Bulk import
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // Load from file state
  const [showLoadFromFile, setShowLoadFromFile] = useState(false);
  const [loadingFromFile, setLoadingFromFile] = useState(false);
  const [availableEnvFiles, setAvailableEnvFiles] = useState<string[]>([]);
  const [selectedEnvFile, setSelectedEnvFile] = useState(".env");
  const [fileEnvVars, setFileEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [selectedFileVars, setSelectedFileVars] = useState<Set<string>>(new Set());

  // Copied state
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

  useEffect(() => {
    loadEnvVars();
  }, [loadEnvVars]);

  async function handleAdd() {
    if (!newKey.trim()) return;
    setAdding(true);

    try {
      const response = await fetch("/api/env-vars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          key: newKey.trim(),
          value: newValue,
          is_secret: newIsSecret,
        }),
      });
      const result = await response.json();

      if (result.success) {
        setEnvVars([...envVars, result.data]);
        setNewKey("");
        setNewValue("");
        setNewIsSecret(true);
        setShowAddForm(false);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to add environment variable");
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdate(id: string) {
    try {
      const response = await fetch(`/api/env-vars/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: editKey.trim(),
          value: editValue || undefined,
          is_secret: editIsSecret,
        }),
      });
      const result = await response.json();

      if (result.success) {
        setEnvVars(envVars.map((v) => (v.id === id ? result.data : v)));
        setEditingId(null);
        // Clear revealed value since it's been updated
        setRevealedValues((prev) => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to update environment variable");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this environment variable?")) return;

    try {
      const response = await fetch(`/api/env-vars/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (result.success) {
        setEnvVars(envVars.filter((v) => v.id !== id));
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to delete environment variable");
    }
  }

  async function handleReveal(id: string) {
    if (revealedValues[id]) {
      // Hide if already revealed
      setRevealedValues((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      return;
    }

    setRevealingId(id);
    try {
      const response = await fetch(`/api/env-vars/${id}`);
      const result = await response.json();

      if (result.success) {
        setRevealedValues((prev) => ({ ...prev, [id]: result.value }));
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

  async function handleCopy(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
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

  function startEdit(envVar: EnvVarDisplay) {
    setEditingId(envVar.id);
    setEditKey(envVar.key);
    setEditValue("");
    setEditIsSecret(envVar.is_secret);
  }

  async function handleLoadAvailableFiles() {
    if (!repoPath) return;
    setLoadingFromFile(true);
    try {
      const response = await fetch("/api/env-vars/load-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath, action: "list" }),
      });
      const result = await response.json();
      if (result.success && result.files) {
        setAvailableEnvFiles(result.files);
        if (result.files.length > 0) {
          setSelectedEnvFile(result.files[0]);
        }
      }
    } catch {
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
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Load from .env file
              </Label>
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
              <p className="text-sm text-muted-foreground">
                {loadingFromFile ? "Searching for .env files..." : "No .env files found in repository"}
              </p>
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
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newIsSecret}
                  onChange={(e) => setNewIsSecret(e.target.checked)}
                  className="rounded"
                />
                Secret (encrypted)
              </label>
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={adding || !newKey.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
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
                key={envVar.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30"
              >
                {editingId === envVar.id ? (
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
                      <Button size="sm" onClick={() => handleUpdate(envVar.id)}>
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
                        {envVar.is_secret && (
                          <Badge variant="outline" className="text-xs">
                            secret
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs text-muted-foreground font-mono">
                          {revealedValues[envVar.id] || envVar.value_masked}
                        </code>
                        {revealedValues[envVar.id] && (
                          <button
                            onClick={() => handleCopy(envVar.id, revealedValues[envVar.id])}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedId === envVar.id ? (
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
                        onClick={() => handleReveal(envVar.id)}
                        disabled={revealingId === envVar.id}
                      >
                        {revealingId === envVar.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : revealedValues[envVar.id] ? (
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
                        onClick={() => handleDelete(envVar.id)}
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
