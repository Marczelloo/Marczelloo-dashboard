"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Network } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { Chip, EmptyState, Panel, SegmentedControl } from "@/components/ui";
import { isPublic } from "@/lib/host";
import type { HostInfo } from "@agent/types";

const KNOWN: Record<number, string> = {
  22: "SSH",
  80: "HTTP",
  443: "HTTPS",
  2333: "Lavalink",
  3000: "AtlasHub",
  3100: "Dashboard",
  5432: "PostgreSQL",
  6379: "Redis",
  9000: "Portainer",
  9443: "Portainer HTTPS",
};

type Filter = "all" | "public";

/**
 * What the Pi actually publishes. Everything served through the tunnel should be
 * bound to loopback; anything else is reachable from the local network.
 */
export function PortsTab({ host }: { host: HostInfo }) {
  const [filter, setFilter] = useState<Filter>("all");
  const ports = useMemo(() => [...host.publishedPorts].sort((a, b) => a.hostPort - b.hostPort), [host.publishedPorts]);
  const exposed = ports.filter((port) => isPublic(port.hostIp));
  const visible = filter === "public" ? exposed : ports;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<Filter>
          aria-label="Filter ports"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: ports.length },
            { value: "public", label: "Reachable from the LAN", count: exposed.length },
          ]}
        />
        <p className="ml-auto text-[11.5px] text-fg-3">Published by docker; the tunnel reaches containers over the edge network instead.</p>
      </div>

      <Panel>
        {visible.length === 0 ? (
          <EmptyState
            icon={Network}
            title={filter === "public" ? "Nothing is exposed" : "No published ports"}
            description={filter === "public" ? "Every binding sits on loopback, which is how it should be." : "Containers reach each other over the edge network without publishing ports."}
          />
        ) : (
          visible.map((port) => (
            <div key={`${port.hostIp}:${port.hostPort}/${port.protocol}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
              <StatusDot status={isPublic(port.hostIp) ? "warn" : "ok"} />
              <span className="w-[68px] font-mono tabular-nums">{port.hostPort}</span>
              <span className="w-[120px] truncate text-fg-3">{KNOWN[port.hostPort] ?? "—"}</span>
              <Link href="/host?tab=containers" className="min-w-0 truncate font-mono text-[12px] text-fg-2 hover:underline">
                {port.container}
              </Link>
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <Chip mono>
                  {port.hostIp}:{port.hostPort}→{port.containerPort}/{port.protocol}
                </Chip>
                <Chip tone={isPublic(port.hostIp) ? "warn" : "ok"}>{isPublic(port.hostIp) ? "LAN" : "loopback"}</Chip>
              </span>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
