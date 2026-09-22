"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Cpu, Rocket, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { FormLayout, FormSection, SectionNav, type FormSectionLink } from "@/components/layout/form-layout";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button, Chip, Panel } from "@/components/ui";
import { ConnectionsSection } from "./connections-section";
import { MonitoringSection } from "./monitoring-section";
import { NotificationsSection } from "./notifications-section";
import { TunnelSection } from "./tunnel-section";

const SECTIONS: FormSectionLink[] = [
  { id: "connections", label: "Connections" },
  { id: "deploys", label: "Deploys" },
  { id: "tunnel", label: "Tunnel" },
  { id: "monitoring", label: "Monitoring" },
  { id: "notifications", label: "Alerts" },
  { id: "about", label: "About" },
];

export interface SettingsData {
  version: string;
  demo: boolean;
  agentReachable: boolean;
  discordConfigured: boolean;
  host: { hostname: string | null; projectsDir: string | null; edgeNetwork: string | null; dropPorts: boolean };
  origin: string;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">
      <span className="text-fg-3">{label}</span>
      <span className="min-w-0 max-w-full truncate text-right">{children}</span>
    </div>
  );
}

/** Dashboard-wide settings, in the same shape as a project's own settings. */
export function SettingsView({ data }: { data: SettingsData }) {
  const [copied, setCopied] = useState(false);
  const webhook = `${data.origin}/api/github/webhook`;

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhook);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the address instead");
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="How this dashboard reaches everything it manages" />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
          <SectionNav sections={SECTIONS} />
          <FormLayout
            rail={
              <>
                <Panel className="grid gap-2.5 p-3.5">
                  <p className="text-[11.5px] text-fg-3">This instance</p>
                  <p className="flex items-center gap-2 text-[13px]">
                    <span className="text-fg-3">Version</span>
                    <code className="ml-auto text-[12px] text-fg-2">{data.version}</code>
                  </p>
                  <p className="flex items-center gap-2 text-[13px]">
                    <span className="text-fg-3">Mode</span>
                    <Chip tone={data.demo ? "warn" : "ok"} className="ml-auto">
                      {data.demo ? "demo" : "live"}
                    </Chip>
                  </p>
                  <p className="flex items-center gap-2 text-[13px]">
                    <span className="text-fg-3">Host</span>
                    <code className="ml-auto truncate text-[12px] text-fg-2">{data.host.hostname ?? "—"}</code>
                  </p>
                </Panel>
                <Panel className="grid gap-2 p-3.5">
                  <p className="text-[11.5px] text-fg-3">Related</p>
                  <Link href="/host?tab=settings" className="flex items-center gap-2 text-[13px] text-fg-2 hover:text-fg">
                    <Cpu className="size-4" strokeWidth={1.75} />
                    Host and its connections
                  </Link>
                  <Link href="/deployments" className="flex items-center gap-2 text-[13px] text-fg-2 hover:text-fg">
                    <Rocket className="size-4" strokeWidth={1.75} />
                    Deployment history
                  </Link>
                  <Link href="/audit-log" className="flex items-center gap-2 text-[13px] text-fg-2 hover:text-fg">
                    <ScrollText className="size-4" strokeWidth={1.75} />
                    Audit log
                  </Link>
                </Panel>
              </>
            }
          >
            <ConnectionsSection agentReachable={data.agentReachable} />

            <FormSection id="deploys" title="Deploys" description="Every project deploys the same way: a push reaches the agent, which builds and swaps the containers.">
              <div className="-my-1">
                <Fact label="Trigger">a push to the configured branch, or Deploy on a project</Fact>
                <Fact label="Runs on">the deploy agent, on the Pi</Fact>
                <Fact label="Rollback">the previous release, from a project&apos;s Deployments tab</Fact>
                <Fact label="Projects directory">
                  <code className="text-[12px] text-fg-2">{data.host.projectsDir ?? "set on the agent"}</code>
                </Fact>
                <Fact label="Edge network">
                  <code className="text-[12px] text-fg-2">{data.host.edgeNetwork ?? "—"}</code>
                </Fact>
                <Fact label="Ports behind the tunnel">
                  <Chip tone={data.host.dropPorts ? "ok" : "idle"}>{data.host.dropPorts ? "dropped" : "published"}</Chip>
                </Fact>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2">
                <span className="text-[11.5px] text-fg-3">Webhook</span>
                <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2">{webhook}</code>
                <Button variant="ghost" size="sm" onClick={() => void copyWebhook()}>
                  {copied ? <Check strokeWidth={1.75} /> : <Copy strokeWidth={1.75} />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[11.5px] text-fg-3">Point the GitHub App at that address to deploy on push.</p>
            </FormSection>

            <TunnelSection />
            <MonitoringSection />
            <NotificationsSection configured={data.discordConfigured} />

            <FormSection id="about" title="About" description="What this is, and where the rest of it is written down.">
              <div className="-my-1">
                <Fact label="Dashboard version">
                  <code className="text-[12px] text-fg-2">{data.version}</code>
                </Fact>
                <Fact label="Docs">
                  <Link href="/docs" className="hover:underline">
                    How the pieces fit
                  </Link>
                </Fact>
                <Fact label="Configuration">
                  <Link href="/docs#env-vars" className="hover:underline">
                    Every variable it reads
                  </Link>
                </Fact>
              </div>
            </FormSection>
          </FormLayout>
        </div>
      </PageBody>
    </>
  );
}
