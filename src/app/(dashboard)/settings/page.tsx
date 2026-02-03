"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout";
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
import { Save, RefreshCw, TestTube, Check, X, Loader2, Info, Plus, Network, Clock, Shield, Key } from "lucide-react";

interface ConnectionStatus {
  status: "unknown" | "loading" | "success" | "error";
  message?: string;
}

interface PortInfo {
  port: number;
  protocol: string;
  state: string;
  process: string;
  pid: number | null;
  label: string | null;
}

interface Allowlist {
  repo_paths: string[];
  compose_projects: string[];
  container_names: string[];
}

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" description="Configure your dashboard connections" />

      <div className="p-6 space-y-6 max-w-4xl">
        <EnvironmentInfo />
        <MonitoringIntervalSettings />
        <PortainerSettings />
        <RunnerSettings />
        <RunnerAllowlistSettings />
        <PortTrackerSettings />
        <NotificationSettings />
      </div>
    </>
  );
}

function EnvironmentInfo() {
  const [info, setInfo] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/info")
      .then((res) => res.json())
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Environment Status
        </CardTitle>
        <CardDescription>Current configuration status (read-only from environment variables)</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : info ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <span className="text-sm">AtlasHub</span>
              <Badge variant={info.atlashub === "configured" ? "success" : "danger"}>{info.atlashub}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <span className="text-sm">Portainer</span>
              <Badge variant={info.portainer === "configured" ? "success" : "danger"}>{info.portainer}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <span className="text-sm">Runner</span>
              <Badge variant={info.runner === "configured" ? "success" : "danger"}>{info.runner}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <span className="text-sm">Discord</span>
              <Badge variant={info.discord === "configured" ? "success" : "secondary"}>{info.discord}</Badge>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Failed to load environment info</p>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Settings are configured via environment variables in <code>.env.local</code>. See the{" "}
          <a href="/docs" className="text-primary hover:underline">
            Documentation
          </a>{" "}
          for details.
        </p>
      </CardContent>
    </Card>
  );
}

function MonitoringIntervalSettings() {
  const [interval, setInterval] = useState(5);
  const [status, setStatus] = useState<ConnectionStatus>({ status: "unknown" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/monitoring-interval")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setInterval(data.interval_minutes);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveInterval() {
    setStatus({ status: "loading" });
    try {
      const response = await fetch("/api/settings/monitoring-interval", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval_ms: interval * 60000 }),
      });
      const result = await response.json();

      if (result.success) {
        setStatus({ status: "success", message: "Interval updated" });
      } else {
        setStatus({ status: "error", message: result.error });
      }
    } catch {
      setStatus({ status: "error", message: "Failed to update interval" });
    }
  }

  async function runChecks() {
    setStatus({ status: "loading", message: "Running checks..." });
    try {
      const response = await fetch("/api/monitoring/check", { method: "POST" });
      const result = await response.json();

      if (result.success) {
        setStatus({ status: "success", message: `Checked ${result.checked} service(s)` });
      } else {
        setStatus({ status: "error", message: result.error });
      }
    } catch {
      setStatus({ status: "error", message: "Failed to run checks" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Monitoring Interval
        </CardTitle>
        <CardDescription>Configure how often uptime checks run automatically</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="interval">Check Interval (minutes)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="interval"
                    type="number"
                    min={1}
                    max={60}
                    value={interval}
                    onChange={(e) => setInterval(parseInt(e.target.value, 10) || 5)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>
              <StatusIndicator status={status} />
            </div>

            <p className="text-xs text-muted-foreground">
              The scheduler runs in-process when the server starts. Changes take effect on next server restart.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={saveInterval} disabled={status.status === "loading"}>
                <Save className="h-4 w-4" />
                Save Interval
              </Button>
              <Button variant="outline" size="sm" onClick={runChecks} disabled={status.status === "loading"}>
                {status.status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Run Checks Now
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PortainerSettings() {
  const [status, setStatus] = useState<ConnectionStatus>({ status: "unknown" });
  const [tokenStatus, setTokenStatus] = useState<ConnectionStatus>({ status: "unknown" });
  const [tokenInfo, setTokenInfo] = useState<{
    hasToken: boolean;
    source: string;
    expiresAt: string | null;
    isExpired: boolean | null;
  } | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);

  useEffect(() => {
    loadTokenStatus();
  }, []);

  async function loadTokenStatus() {
    try {
      const response = await fetch("/api/settings/portainer-token");
      const result = await response.json();
      if (result.success) {
        setTokenInfo(result);
      }
    } catch {
      // Ignore errors
    }
  }

  async function testConnection() {
    setStatus({ status: "loading" });
    try {
      const response = await fetch("/api/settings/test-portainer", { method: "POST" });
      const result = await response.json();

      if (result.success) {
        setStatus({ status: "success", message: `Connected: ${result.endpoints} endpoint(s) found` });
      } else {
        setStatus({ status: "error", message: result.error });
      }
    } catch {
      setStatus({ status: "error", message: "Failed to test connection" });
    }
  }

  async function refreshToken() {
    if (!password) {
      setTokenStatus({ status: "error", message: "Password is required" });
      return;
    }

    setTokenStatus({ status: "loading" });
    try {
      const response = await fetch("/api/settings/portainer-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (result.success) {
        setTokenStatus({ status: "success", message: "Token refreshed!" });
        setPassword("");
        setShowCredentials(false);
        loadTokenStatus();
        // Also test the new connection
        setTimeout(testConnection, 500);
      } else {
        setTokenStatus({ status: "error", message: result.error });
      }
    } catch {
      setTokenStatus({ status: "error", message: "Failed to refresh token" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portainer Integration</CardTitle>
        <CardDescription>Docker container management via Portainer API</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label className="text-muted-foreground">URL</Label>
            <p className="font-mono text-sm">{process.env.NEXT_PUBLIC_PORTAINER_URL || "http://localhost:9200"}</p>
          </div>
          <StatusIndicator status={status} />
        </div>

        {/* Token Status */}
        {tokenInfo && (
          <div className="p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center gap-2 mb-1">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Token Status</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Source:{" "}
                <Badge variant="outline" className="ml-1">
                  {tokenInfo.source}
                </Badge>
              </p>
              {tokenInfo.expiresAt && (
                <p>
                  Expires: {new Date(tokenInfo.expiresAt).toLocaleString()}
                  {tokenInfo.isExpired && (
                    <Badge variant="danger" className="ml-2">
                      Expired
                    </Badge>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={testConnection} disabled={status.status === "loading"}>
            {status.status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}
            Test Connection
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCredentials(!showCredentials)}>
            <Key className="h-4 w-4" />
            {showCredentials ? "Hide" : "Refresh Token"}
          </Button>
        </div>

        {/* Token Refresh Form */}
        {showCredentials && (
          <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter your Portainer credentials to get a new API token. The token will be stored in the database and used
              for all API calls.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="portainer-username">Username</Label>
                <Input
                  id="portainer-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                />
              </div>
              <div>
                <Label htmlFor="portainer-password">Password</Label>
                <Input
                  id="portainer-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === "Enter" && refreshToken()}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button size="sm" onClick={refreshToken} disabled={tokenStatus.status === "loading" || !password}>
                {tokenStatus.status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Get New Token
              </Button>
              <StatusIndicator status={tokenStatus} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RunnerSettings() {
  const [status, setStatus] = useState<ConnectionStatus>({ status: "unknown" });

  async function testConnection() {
    setStatus({ status: "loading" });
    try {
      const response = await fetch("/api/settings/test-runner", { method: "POST" });
      const result = await response.json();

      if (result.success) {
        setStatus({ status: "success", message: `Connected (v${result.version || "1.0"})` });
      } else {
        setStatus({ status: "error", message: result.error });
      }
    } catch {
      setStatus({ status: "error", message: "Failed to test connection" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Runner Service</CardTitle>
        <CardDescription>Local runner for git and Docker operations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label className="text-muted-foreground">URL</Label>
            <p className="font-mono text-sm">http://127.0.0.1:8787</p>
          </div>
          <StatusIndicator status={status} />
        </div>

        <Button variant="outline" size="sm" onClick={testConnection} disabled={status.status === "loading"}>
          {status.status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TestTube className="h-4 w-4" />
          )}
          Test Connection
        </Button>
      </CardContent>
    </Card>
  );
}

function RunnerAllowlistSettings() {
  const [allowlist, setAllowlist] = useState<Allowlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ConnectionStatus>({ status: "unknown" });
  const [newRepo, setNewRepo] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newContainer, setNewContainer] = useState("");

  useEffect(() => {
    loadAllowlist();
  }, []);

  async function loadAllowlist() {
    setLoading(true);
    try {
      const response = await fetch("/api/settings/runner-allowlist");
      const result = await response.json();
      if (result.success) {
        setAllowlist(result.allowlist);
      }
    } catch {
      // Runner may not be running
    }
    setLoading(false);
  }

  async function saveAllowlist() {
    if (!allowlist) return;
    setStatus({ status: "loading" });
    try {
      const response = await fetch("/api/settings/runner-allowlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowlist }),
      });
      const result = await response.json();

      if (result.success) {
        setStatus({ status: "success", message: "Allowlist saved" });
        setAllowlist(result.allowlist);
      } else {
        setStatus({ status: "error", message: result.error });
      }
    } catch {
      setStatus({ status: "error", message: "Failed to save allowlist" });
    }
  }

  function addItem(type: keyof Allowlist, value: string) {
    if (!allowlist || !value.trim()) return;
    if (allowlist[type].includes(value.trim())) return;
    setAllowlist({
      ...allowlist,
      [type]: [...allowlist[type], value.trim()],
    });
    if (type === "repo_paths") setNewRepo("");
    if (type === "compose_projects") setNewProject("");
    if (type === "container_names") setNewContainer("");
  }

  function removeItem(type: keyof Allowlist, value: string) {
    if (!allowlist) return;
    setAllowlist({
      ...allowlist,
      [type]: allowlist[type].filter((v) => v !== value),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Runner Allowlist
        </CardTitle>
        <CardDescription>Control which repositories, projects, and containers the runner can manage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading allowlist...
          </div>
        ) : !allowlist ? (
          <div className="text-muted-foreground">
            <p>Could not load allowlist. Make sure the runner is running.</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={loadAllowlist}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* Repository Paths */}
            <div>
              <Label className="text-sm font-medium">Repository Paths</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Allowed paths for git operations (e.g., /home/pi/projects/my-app)
              </p>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="/home/pi/projects/my-app"
                  value={newRepo}
                  onChange={(e) => setNewRepo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem("repo_paths", newRepo)}
                />
                <Button size="sm" onClick={() => addItem("repo_paths", newRepo)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {allowlist.repo_paths.map((path) => (
                  <Badge key={path} variant="secondary" className="gap-1">
                    <code className="text-xs">{path}</code>
                    <button onClick={() => removeItem("repo_paths", path)} className="hover:text-danger">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Compose Projects */}
            <div>
              <Label className="text-sm font-medium">Compose Projects</Label>
              <p className="text-xs text-muted-foreground mb-2">Allowed docker compose project names</p>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="my-app"
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem("compose_projects", newProject)}
                />
                <Button size="sm" onClick={() => addItem("compose_projects", newProject)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {allowlist.compose_projects.map((name) => (
                  <Badge key={name} variant="secondary" className="gap-1">
                    {name}
                    <button onClick={() => removeItem("compose_projects", name)} className="hover:text-danger">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Container Names */}
            <div>
              <Label className="text-sm font-medium">Container Names</Label>
              <p className="text-xs text-muted-foreground mb-2">Allowed container names for restart/logs operations</p>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="my-container"
                  value={newContainer}
                  onChange={(e) => setNewContainer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem("container_names", newContainer)}
                />
                <Button size="sm" onClick={() => addItem("container_names", newContainer)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {allowlist.container_names.map((name) => (
                  <Badge key={name} variant="secondary" className="gap-1">
                    {name}
                    <button onClick={() => removeItem("container_names", name)} className="hover:text-danger">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="default" size="sm" onClick={saveAllowlist} disabled={status.status === "loading"}>
                {status.status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Allowlist
              </Button>
              <StatusIndicator status={status} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PortTrackerSettings() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState(3000);
  const [rangeEnd, setRangeEnd] = useState(9999);

  async function scanPorts() {
    setLoading(true);
    setError(null);
    setPorts([]);
    try {
      const response = await fetch(`/api/settings/ports?start=${rangeStart}&end=${rangeEnd}`);
      const text = await response.text();

      // Check if response is HTML (error page)
      if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
        setError("API returned error page. Check server logs.");
        return;
      }

      const result = JSON.parse(text);
      if (result.success) {
        setPorts(result.ports || []);
        if (result.ports?.length === 0) {
          setError("No ports found in range. Make sure Runner SSH is configured.");
        }
      } else {
        setError(result.error || "Failed to scan ports");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan ports");
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Port Tracker
        </CardTitle>
        <CardDescription>View which ports are in use on this machine</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div>
            <Label className="text-xs">Start Port</Label>
            <Input
              type="number"
              value={rangeStart}
              onChange={(e) => setRangeStart(parseInt(e.target.value, 10))}
              className="w-24"
            />
          </div>
          <div>
            <Label className="text-xs">End Port</Label>
            <Input
              type="number"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(parseInt(e.target.value, 10))}
              className="w-24"
            />
          </div>
          <div className="pt-5">
            <Button variant="outline" size="sm" onClick={scanPorts} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Scan Ports
            </Button>
          </div>
        </div>

        {ports.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left p-2 font-medium">Port</th>
                  <th className="text-left p-2 font-medium">Service</th>
                  <th className="text-left p-2 font-medium">Process</th>
                  <th className="text-left p-2 font-medium">PID</th>
                </tr>
              </thead>
              <tbody>
                {ports.map((port) => (
                  <tr key={port.port} className="border-t border-border">
                    <td className="p-2 font-mono">{port.port}</td>
                    <td className="p-2">
                      {port.label ? (
                        <Badge variant="outline">{port.label}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2">{port.process}</td>
                    <td className="p-2 text-muted-foreground">{port.pid || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}

        {!loading && ports.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">
            Click &quot;Scan Ports&quot; to discover which ports are in use.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
  const [status, setStatus] = useState<ConnectionStatus>({ status: "unknown" });

  async function sendTestNotification() {
    setStatus({ status: "loading" });
    try {
      const response = await fetch("/api/settings/test-discord", { method: "POST" });
      const result = await response.json();

      if (result.success) {
        setStatus({ status: "success", message: "Test notification sent!" });
      } else {
        setStatus({ status: "error", message: result.error });
      }
    } catch {
      setStatus({ status: "error", message: "Failed to send test notification" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Configure how you receive alerts and notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label className="text-muted-foreground">Discord Webhook</Label>
            <p className="font-mono text-sm truncate max-w-md">
              {process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL
                ? "••••••••" + process.env.NEXT_PUBLIC_DISCORD_WEBHOOK_URL.slice(-20)
                : "Not configured"}
            </p>
          </div>
          <StatusIndicator status={status} />
        </div>

        <Button variant="outline" size="sm" onClick={sendTestNotification} disabled={status.status === "loading"}>
          {status.status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TestTube className="h-4 w-4" />
          )}
          Send Test Notification
        </Button>
      </CardContent>
    </Card>
  );
}

function StatusIndicator({ status }: { status: ConnectionStatus }) {
  if (status.status === "unknown") return null;

  return (
    <div className="flex items-center gap-2">
      {status.status === "loading" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {status.status === "success" && (
        <>
          <Check className="h-4 w-4 text-success" />
          <span className="text-sm text-success">{status.message}</span>
        </>
      )}
      {status.status === "error" && (
        <>
          <X className="h-4 w-4 text-danger" />
          <span className="text-sm text-danger">{status.message}</span>
        </>
      )}
    </div>
  );
}
