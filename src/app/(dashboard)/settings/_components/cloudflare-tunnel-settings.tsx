"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CloudCog, ExternalLink, Globe2, Loader2, RefreshCw, Server } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type TunnelRoute = {
  hostname: string;
  service: string;
  localPort: number | null;
  active: boolean;
  managed: boolean;
  project: { projectId: string; projectName: string; projectSlug: string; hostname: string; localPort: number } | null;
};

type ManagedTunnel = { tunnelId: string; name: string; status: string | null; zones: string[] } | { error: string };

type TunnelResponse = {
  success: boolean;
  managedTunnel?: ManagedTunnel | null;
  configured?: boolean;
  routes?: TunnelRoute[];
  error?: string;
};

export function CloudflareTunnelSettings() {
  const [configured, setConfigured] = useState(false);
  const [routes, setRoutes] = useState<TunnelRoute[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [managedTunnel, setManagedTunnel] = useState<ManagedTunnel | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/settings/cloudflare-tunnel?ts=${Date.now()}`, { cache: "no-store" });
      const data = await response.json() as TunnelResponse;
      if (!response.ok || !data.success) throw new Error(data.error || "Nie udało się odczytać konfiguracji Tunnel.");
      setConfigured(Boolean(data.configured));
      setRoutes(data.routes || []);
      setManagedTunnel(data.managedTunnel ?? null);
      if (data.error) setError(data.error);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się odczytać konfiguracji Tunnel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
              <CardDescription>Trasy i rekordy DNS zarządzane przez Cloudflare API, bez restartu cloudflared.</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh routes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {managedTunnel ? (
          "error" in managedTunnel ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>Tryb Cloudflare API jest włączony, ale API nie odpowiada: {managedTunnel.error}</span>
            </div>
          ) : (
            <div className="grid gap-3 border-b border-border/60 pb-6 sm:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">Tunel</p>
                <p className="mt-1 text-sm font-medium">{managedTunnel.name} <Badge variant={managedTunnel.status === "healthy" ? "success" : "warning"} className="ml-1">{managedTunnel.status ?? "?"}</Badge></p>
              </div>
              <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">ID</p>
                <p className="mt-1 truncate font-mono text-xs" title={managedTunnel.tunnelId}>{managedTunnel.tunnelId}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground">Domeny</p>
                <p className="mt-1 text-sm">{managedTunnel.zones.join(", ") || "—"}</p>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Cloudflare API nie jest skonfigurowane — ustaw CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID i CLOUDFLARE_TUNNEL_ID.</span>
          </div>
        )}

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
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground"><Globe2 className="h-5 w-5" />Brak tras w tunelu.</div>
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

    </Card>
  );
}
