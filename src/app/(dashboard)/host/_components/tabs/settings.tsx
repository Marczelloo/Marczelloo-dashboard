"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, Cpu, Database, Globe, Loader2, Plug, Timer } from "lucide-react";
import { toast } from "sonner";
import { StatusDot } from "@/components/status-dot";
import { Button, Chip, Panel } from "@/components/ui";
import { formatBytes, formatUptime, type HostSummary } from "@/lib/host";
import { formatRelativeTime } from "@/lib/utils";

interface Info {
  atlashub: string;
  portainer: string;
  discord: string;
  agent: string;
  cloudflare: string;
  edgeNetwork: string | null;
  tunnelOrigin: string | null;
  dropPorts: boolean;
  projectsDir: string | null;
}

function Card({ title, icon: Icon, description, children }: { title: string; icon: typeof Plug; description?: string; children: React.ReactNode }) {
  return (
    <Panel>
      <div className="border-b border-line-subtle px-3.5 py-3">
        <h2 className="flex items-center gap-2 text-[13.5px] font-semibold">
          <Icon className="size-4 text-fg-3" strokeWidth={1.75} />
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[11.5px] text-fg-3">{description}</p>}
      </div>
      {children}
    </Panel>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
      <span className="text-fg-3">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  );
}

const state = (value: string | undefined) => (value === "configured" ? { tone: "ok" as const, label: "configured" } : value === "not set" ? { tone: "idle" as const, label: "not set" } : { tone: "err" as const, label: "missing" });

/** What the dashboard needs in order to reach this host, and the one knob that belongs to it. */
export function HostSettingsTab({ summary }: { summary: HostSummary }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [savedMinutes, setSavedMinutes] = useState("");
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const [infoResponse, intervalResponse] = await Promise.all([
      fetch("/api/settings/info", { cache: "no-store" }).then((response) => response.json().catch(() => null)),
      fetch("/api/settings/monitoring-interval", { cache: "no-store" }).then((response) => response.json().catch(() => null)),
    ]);
    if (infoResponse) setInfo(infoResponse as Info);
    if (intervalResponse?.success) {
      setSavedMinutes(String(intervalResponse.interval_minutes));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function testDocker() {
    setTesting(true);
    try {
      const response = await fetch("/api/settings/test-portainer", { method: "POST" });
      const result = (await response.json().catch(() => ({}))) as { success?: boolean; endpoints?: number; error?: string };
      if (result.success) {
        toast.success(`Docker answered · ${result.endpoints} endpoint${result.endpoints === 1 ? "" : "s"}`);
      } else {
        toast.error(result.error ?? "Docker did not answer");
      }
    } finally {
      setTesting(false);
    }
  }

  const atlas = state(info?.atlashub);
  const portainer = state(info?.portainer);

  const host = summary.host;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="This host" icon={Cpu} description="What the Pi reports about itself.">
        <Fact label="Hostname">
          <code className="text-[12px] text-fg-2">{host?.hostname ?? "—"}</code>
        </Fact>
        <Fact label="Uptime">{host ? formatUptime(host.uptimeSeconds) : "—"}</Fact>
        <Fact label="Cores">{host?.cores ?? "—"}</Fact>
        <Fact label="Memory">{host ? formatBytes(host.memory.totalBytes) : "—"}</Fact>
        <Fact label="Disk">{host?.disk ? `${formatBytes(host.disk.totalBytes)} on ${host.disk.path}` : "—"}</Fact>
        <Fact label="Docker">{host?.docker ? `${host.docker.running} running · ${host.docker.stopped} stopped · ${host.docker.images} images` : "—"}</Fact>
        <Fact label="Projects directory">
          <code className="text-[12px] text-fg-2">{info?.projectsDir ?? "set on the agent"}</code>
        </Fact>
      </Card>

      <Card title="Routing" icon={Globe} description="How traffic reaches the services on this host.">
        <Fact label="Cloudflare API">
          <span className="flex items-center justify-end gap-2">
            <StatusDot status={state(info?.cloudflare).tone} />
            {state(info?.cloudflare).label}
          </span>
        </Fact>
        <Fact label="Tunnel origin">
          <code className="text-[12px] text-fg-2">{info?.tunnelOrigin ?? "—"}</code>
        </Fact>
        <Fact label="Edge network">
          <code className="text-[12px] text-fg-2">{info?.edgeNetwork ?? "—"}</code>
        </Fact>
        <Fact label="Ports dropped behind the tunnel">
          <Chip tone={info?.dropPorts ? "ok" : "idle"}>{info?.dropPorts ? "yes" : "no"}</Chip>
        </Fact>
        <Fact label="Published ports">
          <Link href="/host?tab=ports" className="hover:underline">
            {host?.publishedPorts.length ?? 0} on this host
          </Link>
        </Fact>
      </Card>

      <Card title="Connections" icon={Plug} description="How the dashboard reaches this host and its data.">
        <Fact label="Deploy agent">
          <span className="flex items-center justify-end gap-2">
            <StatusDot status={summary.reachable ? "ok" : "err"} />
            {summary.reachable ? "answering" : "not answering"}
          </span>
        </Fact>
        <Fact label="Last agent report">{summary.agent ? formatRelativeTime(summary.agent.generatedAt) : "—"}</Fact>
        <Fact label="Docker (Portainer)">
          <span className="flex items-center justify-end gap-2">
            <StatusDot status={portainer.tone} />
            {portainer.label}
          </span>
        </Fact>
        <Fact label="Database (AtlasHub)">
          <span className="flex items-center justify-end gap-2">
            <StatusDot status={atlas.tone} />
            {atlas.label}
          </span>
        </Fact>
        <Fact label="Discord alerts">
          <Chip tone={info?.discord === "configured" ? "ok" : "idle"}>{info?.discord ?? "—"}</Chip>
        </Fact>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line-subtle px-3.5 py-2.5">
          <Button variant="secondary" size="sm" onClick={() => void testDocker()} disabled={testing}>
            {testing ? <Loader2 className="animate-spin" /> : <Plug strokeWidth={1.75} />}
            Test docker
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">All dashboard settings</Link>
          </Button>
        </div>
      </Card>

      <Card title="Monitoring" icon={Timer} description="How often the loop checks the domains this host serves.">
        <Fact label="Interval">{savedMinutes ? `every ${savedMinutes} min` : "—"}</Fact>
        <Fact label="Change it">
          <Link href="/settings#monitoring" className="hover:underline">
            Settings
          </Link>
        </Fact>
        <Fact label="Results">
          <Link href="/monitoring" className="hover:underline">
            Monitoring
          </Link>
        </Fact>
      </Card>

      <Card title="Agent" icon={Boxes} description="The service on the Pi that builds, deploys and reports.">
        <Fact label="Projects tracked">{summary.agent ? Object.keys(summary.agent.projects).length : 0}</Fact>
        <Fact label="Build cache">{summary.agent?.buildCacheBytes ? `${(summary.agent.buildCacheBytes / 1024 ** 3).toFixed(1)} GB` : "—"}</Fact>
        <Fact label="Reading taken">{formatRelativeTime(summary.generatedAt)}</Fact>
        <Fact label="Updating it">
          <span className="text-fg-3">rebuild it on the Pi; the dashboard cannot restart the agent that runs it</span>
        </Fact>
      </Card>

      <Card title="Data" icon={Database} description="Where the dashboard keeps what it shows.">
        <Fact label="Projects, deploys, tasks">AtlasHub</Fact>
        <Fact label="Container state and logs">read live from docker</Fact>
        <Fact label="Host readings">read live from the agent, kept only in this page</Fact>
      </Card>

    </div>
  );
}
