"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { FormSection } from "@/components/layout/form-layout";
import { StatusDot } from "@/components/status-dot";
import { Button, Chip, EmptyState } from "@/components/ui";
import { Globe } from "lucide-react";

interface TunnelRoute {
  hostname: string;
  service: string;
  localPort: number | null;
  active: boolean;
  managed: boolean;
  project: { projectId: string; projectName: string } | null;
}

type ManagedTunnel = { tunnelId: string; name: string; status: string | null; zones: string[] } | { error: string };

/** The one ingress every domain goes through; routes are written by the dashboard, not by hand. */
export function TunnelSection() {
  const [routes, setRoutes] = useState<TunnelRoute[]>([]);
  const [tunnel, setTunnel] = useState<ManagedTunnel | null>(null);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/settings/cloudflare-tunnel?ts=${Date.now()}`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; configured?: boolean; routes?: TunnelRoute[]; managedTunnel?: ManagedTunnel | null; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error ?? "Could not read the tunnel configuration");
      setConfigured(Boolean(data.configured));
      setRoutes(data.routes ?? []);
      setTunnel(data.managedTunnel ?? null);
      setError(data.error ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the tunnel configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const healthy = tunnel !== null && !("error" in tunnel) && tunnel.status === "healthy";

  return (
    <FormSection id="tunnel" title="Cloudflare tunnel" description="Every domain reaches the Pi through one tunnel; routes are managed over the API, with no cloudflared restart.">
      <div className="flex flex-wrap items-center gap-3">
        <StatusDot status={configured ? (healthy ? "ok" : "warn") : "idle"} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">
            {tunnel && !("error" in tunnel) ? tunnel.name : configured ? "Tunnel" : "Not configured"}
          </p>
          <p className="truncate text-[11.5px] text-fg-3">
            {tunnel && "error" in tunnel
              ? tunnel.error
              : tunnel
                ? `${tunnel.zones.join(", ") || "no zone"} · ${tunnel.tunnelId.slice(0, 8)}…`
                : "Set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_TUNNEL_ID to manage routes from here."}
          </p>
        </div>
        <span className="flex items-center gap-2">
          {tunnel && !("error" in tunnel) && <Chip tone={healthy ? "ok" : "warn"}>{tunnel.status ?? "unknown"}</Chip>}
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw strokeWidth={1.75} />}
            Refresh
          </Button>
        </span>
      </div>

      {error && <p className="rounded-md border border-warn/25 bg-warn/10 p-3 text-[12.5px] text-warn">{error}</p>}

      <div className="rounded-md border border-line">
        <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-3 py-2">
          <p className="text-[12.5px] font-medium">Routes</p>
          <span className="font-mono text-[11px] text-fg-3">{routes.length}</span>
        </div>
        {loading && routes.length === 0 ? (
          <p className="flex items-center gap-2 px-3 py-4 text-[12.5px] text-fg-3">
            <Loader2 className="size-4 animate-spin" />
            Reading the ingress…
          </p>
        ) : routes.length === 0 ? (
          <EmptyState icon={Globe} title="No routes" description="A project's Domains tab adds one, and the record follows." className="py-6" />
        ) : (
          routes.map((route) => (
            <div key={`${route.hostname}|${route.service}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
              <StatusDot status={route.active ? "ok" : "idle"} />
              <a href={`https://${route.hostname}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 truncate font-medium hover:underline">
                {route.hostname}
                <ExternalLink className="size-3 shrink-0 text-fg-4" strokeWidth={1.75} />
              </a>
              <code className="min-w-0 truncate text-[11.5px] text-fg-3">{route.service}</code>
              <span className="ml-auto flex shrink-0 items-center gap-2 text-[11.5px] text-fg-3">
                {route.project ? (
                  <Link href={`/projects/${route.project.projectId}`} className="hover:text-fg">
                    {route.project.projectName}
                  </Link>
                ) : (
                  <span className="text-fg-4">external</span>
                )}
                {route.managed && <Chip>managed</Chip>}
              </span>
            </div>
          ))
        )}
      </div>
    </FormSection>
  );
}
