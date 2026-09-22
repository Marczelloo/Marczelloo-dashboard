"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/layout/form-layout";
import { Button, Chip, Input, Panel, PanelHeader, Switch } from "@/components/ui";
import { getProjectTunnelStatusAction, updateProjectTunnelAction } from "@/app/actions/projects";
import { CloudflareHostnameField } from "@/components/features/cloudflare-hostname-field";
import { Cloud, ExternalLink, Pencil, RefreshCw, TriangleAlert } from "lucide-react";

type TunnelStatus = "active" | "pending" | "not_configured" | "unavailable";

type TunnelData = {
  supportsManagedDeployment: boolean;
  configured: boolean;
  error?: string;
  tunnel: { enabled: boolean; hostname: string; localPort: number } | null;
  actualRoute: { hostname: string; service: string; localPort: number | null } | null;
  status: TunnelStatus;
};

const statusMeta: Record<TunnelStatus, { label: string; tone: "ok" | "warn" | "idle" | "err" }> = {
  active: { label: "live", tone: "ok" },
  pending: { label: "needs a deploy", tone: "warn" },
  not_configured: { label: "not set", tone: "idle" },
  unavailable: { label: "unavailable", tone: "err" },
};

export function ProjectCloudflareTunnel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<TunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [hostname, setHostname] = useState("");
  const [localPort, setLocalPort] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getProjectTunnelStatusAction(projectId);
    if (!result.success || !result.data) {
      toast.error("Could not read the tunnel", { description: result.error });
      setData(null);
    } else {
      setData(result.data);
      const route = result.data.tunnel || result.data.actualRoute;
      setEnabled(Boolean(result.data.tunnel?.enabled));
      setHostname(route?.hostname || "");
      setLocalPort(route?.localPort ? String(route.localPort) : "");
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    const result = await updateProjectTunnelAction(projectId, {
      enabled,
      hostname: hostname.trim(),
      localPort: localPort ? Number(localPort) : undefined,
    });
    setSaving(false);
    if (!result.success) {
      toast.error("Could not save the route", { description: result.error });
      return;
    }
    toast.success(enabled ? "Route saved" : "Route removed", {
      description: result.data?.deployQueued
        ? "The new port goes live with the deploy that was just queued."
        : result.data?.changed
          ? "The tunnel route was updated."
          : "It was already up to date.",
    });
    setEditing(false);
    await load();
  }

  const status = data ? statusMeta[data.status] : null;
  const activeHostname = data?.tunnel?.hostname || data?.actualRoute?.hostname;

  return (
    <Panel className="lg:col-span-2">
      <PanelHeader
        title="Public route"
        icon={Cloud}
        description="The hostname, the port it reaches, and the route Cloudflare holds for it."
        actions={
          <>
            {!loading && status && <Chip tone={status.tone}>{status.label}</Chip>}
            <Button variant="ghost" size="icon-sm" onClick={() => void load()} disabled={loading} aria-label="Refresh">
              <RefreshCw className={loading ? "animate-spin" : undefined} strokeWidth={1.75} />
            </Button>
          </>
        }
      />
      <div className="grid gap-4 p-3.5">
        {loading && !data ? (
          <div className="h-24 animate-pulse rounded-md bg-white/[.03]" aria-label="Loading the route" />
        ) : !data ? (
          <p className="flex items-center gap-2 text-[13px] text-fg-3">
            <TriangleAlert className="size-4 text-err" strokeWidth={1.75} />
            The tunnel cannot be read right now.
          </p>
        ) : !data.supportsManagedDeployment ? (
          <p className="flex items-start gap-2 text-[13px] text-fg-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={1.75} />
            Connect this project to a GitHub repository and a Compose file first; only then can the dashboard manage its route.
          </p>
        ) : (
          <>
            <dl className="grid text-[13px]">
              <Fact label="Domain" value={activeHostname || "—"} />
              <Fact label="Port" value={data.tunnel?.localPort ? String(data.tunnel.localPort) : "—"} />
              <Fact label="Route target" value={data.actualRoute?.service || "no route"} />
            </dl>

            {data.status === "pending" && (
              <p className="flex items-start gap-2 rounded-md border border-warn/25 bg-warn/[.07] px-3 py-2.5 text-[12.5px] text-fg-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={1.75} />
                The saved settings and the live route differ. Save again, or deploy the project.
              </p>
            )}
            {data.status === "unavailable" && (
              <p className="flex items-start gap-2 rounded-md border border-err/25 bg-err/10 px-3 py-2.5 text-[12.5px] text-fg-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-err" strokeWidth={1.75} />
                {data.error || "Could not read the tunnel routes."}
              </p>
            )}

            {!editing ? (
              <div className="flex flex-wrap gap-2">
                {activeHostname && data.status === "active" && (
                  <Button variant="secondary" size="sm" asChild>
                    <a href={`https://${activeHostname}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink strokeWidth={1.75} />
                      Open
                    </a>
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  <Pencil strokeWidth={1.75} />
                  Edit route
                </Button>
              </div>
            ) : (
              <form
                className="grid gap-4 border-t border-line-subtle pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                <label className="flex items-center justify-between gap-4 text-[13px]">
                  <span>
                    Publish through the tunnel
                    <span className="block text-[11.5px] text-fg-3">Turning this off removes the route; the container keeps running.</span>
                  </span>
                  <Switch checked={enabled} onChange={setEnabled} aria-label="Publish through the tunnel" />
                </label>
                {enabled && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Domain" htmlFor="tunnel-hostname">
                      <CloudflareHostnameField id="tunnel-hostname" value={hostname} onChange={setHostname} />
                    </FormField>
                    <FormField label="Port" htmlFor="tunnel-port" hint="A port already in use is swapped for the first free one in 3000–3999.">
                      <Input id="tunnel-port" inputMode="numeric" value={localPort} onChange={(event) => setLocalPort(event.target.value.replace(/\D/g, ""))} placeholder="3202" className="font-mono" />
                    </FormField>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      void load();
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={saving} disabled={enabled && (!hostname.trim() || !localPort)}>
                    Save route
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 [&+&]:border-t [&+&]:border-line-subtle">
      <dt className="text-fg-3">{label}</dt>
      <dd className="min-w-0 truncate font-mono text-[12px] text-fg-2" title={value}>
        {value}
      </dd>
    </div>
  );
}
