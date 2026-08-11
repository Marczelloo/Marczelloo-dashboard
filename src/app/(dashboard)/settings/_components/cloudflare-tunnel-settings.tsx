"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CloudCog, ExternalLink, Globe2, Loader2, RefreshCw, Save, Server, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { PinDialog } from "@/components/pin-dialog";

type TunnelConfig = {
  configPath: string | null;
  useSudo: boolean;
  tunnelName: string;
  source: "database" | "environment" | "none";
};

type TunnelRoute = {
  hostname: string;
  service: string;
  localPort: number | null;
  active: boolean;
  managed: boolean;
  project: { projectId: string; projectName: string; projectSlug: string; hostname: string; localPort: number } | null;
};

type TunnelResponse = {
  success: boolean;
  configured?: boolean;
  tunnel?: TunnelConfig;
  routes?: TunnelRoute[];
  error?: string;
};

export function CloudflareTunnelSettings() {
  const [configPath, setConfigPath] = useState("");
  const [useSudo, setUseSudo] = useState(true);
  const [tunnelName, setTunnelName] = useState("");
  const [source, setSource] = useState<TunnelConfig["source"]>("none");
  const [configured, setConfigured] = useState(false);
  const [routes, setRoutes] = useState<TunnelRoute[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/settings/cloudflare-tunnel?ts=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as TunnelResponse;
      if (!response.ok || !data.success || !data.tunnel) throw new Error(data.error || "Nie udało się odczytać konfiguracji Tunnel.");
      setConfigPath(data.tunnel.configPath || "");
      setUseSudo(data.tunnel.useSudo);
      setTunnelName(data.tunnel.tunnelName);
      setSource(data.tunnel.source);
      setConfigured(Boolean(data.configured));
      setRoutes(data.routes || []);
      if (data.error) setError(data.error);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się odczytać konfiguracji Tunnel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settings/cloudflare-tunnel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configPath, useSudo, tunnelName }),
      });
      const data = await response.json() as TunnelResponse & { requirePin?: boolean };
      if (data.requirePin) {
        setShowPinDialog(true);
        return;
      }
      if (!response.ok || !data.success) throw new Error(data.error || "Nie udało się zapisać konfiguracji Tunnel.");
      setSource("database");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się zapisać konfiguracji Tunnel.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CloudCog className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Cloudflare Tunnel
                {configured ? <Badge variant="success">Ingress online</Badge> : <Badge variant="secondary">Not configured</Badge>}
              </CardTitle>
              <CardDescription>Globalny plik ingress oraz rzeczywisty spis publicznie wystawionych hostów.</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh routes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cloudflared-config-path">Ingress config path</Label>
            <Input
              id="cloudflared-config-path"
              className="font-mono text-xs"
              placeholder="/etc/cloudflared/config.yml"
              value={configPath}
              onChange={(event) => setConfigPath(event.target.value)}
              disabled={loading || saving}
            />
            <p className="text-xs text-muted-foreground">Absolutna ścieżka pliku cloudflared na Raspberry Pi.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cloudflared-tunnel-name">Tunnel name <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="cloudflared-tunnel-name"
              className="font-mono text-xs"
              placeholder="marczelloo-pi"
              value={tunnelName}
              onChange={(event) => setTunnelName(event.target.value)}
              disabled={loading || saving}
            />
            <p className="text-xs text-muted-foreground">Potrzebna tylko, gdy dashboard ma również tworzyć DNS route w Cloudflare.</p>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-secondary/20 p-3">
          <input
            type="checkbox"
            checked={useSudo}
            onChange={(event) => setUseSudo(event.target.checked)}
            disabled={loading || saving}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="space-y-1">
            <span className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-primary" />Use sudo for config access</span>
            <span className="block text-xs text-muted-foreground">Włączone dla systemowego pliku <code>cloudflared</code> zarządzanego przez systemd.</span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 pb-6">
          <Button onClick={() => void save()} disabled={loading || saving || !configPath.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Tunnel settings
          </Button>
          <span className="text-xs text-muted-foreground">Source: {source === "database" ? "dashboard settings" : source === "environment" ? "environment fallback" : "not set"}</span>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section aria-labelledby="tunnel-routes-title" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="tunnel-routes-title" className="text-sm font-semibold">Exposed through Tunnel</h2>
              <p className="text-xs text-muted-foreground">Stan odczytany z aktywnego ingress; projekty dashboardu są oznaczone jako managed.</p>
            </div>
            <Badge variant="outline" className="font-mono">{routes.length} routes</Badge>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading ingress routes...</div>
          ) : routes.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground"><Globe2 className="h-5 w-5" />No hostname routes found. Save the config path, then refresh.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-secondary/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">Hostname</th>
                    <th className="px-3 py-2.5 text-left font-medium">Local target</th>
                    <th className="px-3 py-2.5 text-left font-medium">Project</th>
                    <th className="px-3 py-2.5 text-right font-medium">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {routes.map((route) => (
                    <tr key={`${route.hostname}|${route.service}`} className="transition-colors hover:bg-secondary/25">
                      <td className="px-3 py-3">
                        <a href={`https://${route.hostname}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:text-primary hover:underline underline-offset-4">
                          {route.hostname}<ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{route.service}</td>
                      <td className="px-3 py-3">
                        {route.project ? <a href={`/projects/${route.project.projectId}`} className="hover:text-primary hover:underline underline-offset-4">{route.project.projectName}</a> : <span className="text-muted-foreground">Legacy / external</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-2"><Badge variant={route.active ? "success" : "secondary"}>{route.active ? "Active" : "Pending"}</Badge>{route.managed && <Badge variant="outline"><Server className="mr-1 h-3 w-3" />Managed</Badge>}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </CardContent>

      <PinDialog
        open={showPinDialog}
        onSuccess={() => {
          setShowPinDialog(false);
          void save();
        }}
        onCancel={() => setShowPinDialog(false)}
      />
    </Card>
  );
}
