import Link from "next/link";
import { Globe, ListChecks, Plus, Rocket, Server } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/utils";
import type { Tone } from "@/lib/tone";
import type { ProjectDetail } from "@/server/projects/detail";
import type { DeployStatus, WorkItem } from "@/types";

const DEPLOY_TONE: Record<DeployStatus, Tone> = { pending: "live", running: "live", success: "ok", failed: "err", cancelled: "idle" };
const ITEM_TONE: Record<WorkItem["status"], Tone> = { open: "idle", in_progress: "live", blocked: "warn", done: "ok" };

function Section({ title, icon: Icon, action, children }: { title: string; icon: typeof Server; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-3.5 py-3">
        <h2 className="flex items-center gap-2 text-[13.5px] font-semibold">
          <Icon className="size-4 text-fg-3" strokeWidth={1.75} />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Panel>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">{children}</div>;
}

export function OverviewTab({ detail }: { detail: ProjectDetail }) {
  const { project, services, deploys, workItems, agent, config } = detail;
  const containerOf = (serviceName: string) => agent?.containers.find((container) => container.service === serviceName) ?? null;
  const open = workItems.filter((item) => item.status !== "done").slice(0, 5);
  const domains = [config?.tunnel?.hostname, detail.domain].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Section
          title={`Services (${services.length})`}
          icon={Server}
          action={
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/projects/${project.id}/services/new`}>
                <Plus strokeWidth={1.75} />
                Add service
              </Link>
            </Button>
          }
        >
          {services.length === 0 ? (
            <EmptyState icon={Server} title="No services yet" description="Add the docker service this project deploys." />
          ) : (
            services.map((service) => {
              const container = containerOf(service.name);
              return (
                <Row key={service.id}>
                  <StatusDot status={container ? (container.status === "running" ? "ok" : "err") : "idle"} />
                  <Link href={`/projects/${project.id}/services/${service.id}`} className="min-w-0 truncate font-medium hover:underline">
                    {service.name}
                  </Link>
                  {service.url && <span className="truncate font-mono text-[11.5px] text-fg-3">{service.url}</span>}
                  <span className="ml-auto flex items-center gap-2">
                    <Chip mono>{service.type}</Chip>
                    {container && <Chip tone={container.status === "running" ? "ok" : "err"}>{container.status}</Chip>}
                  </span>
                </Row>
              );
            })
          )}
        </Section>

        <Section
          title="Recent deploys"
          icon={Rocket}
          action={
            <Link href={`/projects/${project.id}?tab=deployments`} className="text-xs text-fg-3 hover:text-fg">
              All deployments
            </Link>
          }
        >
          {deploys.length === 0 ? (
            <EmptyState icon={Rocket} title="Nothing deployed yet" description="Push to the configured branch, or press Deploy above." />
          ) : (
            deploys.slice(0, 5).map((deploy) => (
              <Row key={deploy.id}>
                <StatusDot status={DEPLOY_TONE[deploy.status]} />
                <code className="text-[12.5px] text-fg-2">{deploy.commit_sha?.slice(0, 7) ?? "unknown"}</code>
                <span className="min-w-0 truncate text-fg-3">{deploy.error_message ?? deploy.triggered_by}</span>
                <span className="ml-auto flex items-center gap-2 text-[11.5px] text-fg-3">
                  {formatRelativeTime(deploy.started_at)}
                  <Chip tone={DEPLOY_TONE[deploy.status]}>{deploy.status}</Chip>
                </span>
              </Row>
            ))
          )}
        </Section>
      </div>

      <div className="flex flex-col gap-4">
        <Section
          title="Open tasks"
          icon={ListChecks}
          action={
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/projects/${project.id}/work-items/new`}>
                <Plus strokeWidth={1.75} />
                New task
              </Link>
            </Button>
          }
        >
          {open.length === 0 ? (
            <EmptyState icon={ListChecks} title="Nothing open" description="Tasks for this project show up here." />
          ) : (
            open.map((item) => (
              <Row key={item.id}>
                <StatusDot status={ITEM_TONE[item.status]} />
                <Link href={`/projects/${project.id}/work-items/${item.id}`} className="min-w-0 truncate hover:underline">
                  {item.title}
                </Link>
                <Chip tone={item.priority === "critical" ? "err" : item.priority === "high" ? "warn" : "neutral"} className="ml-auto">
                  {item.priority}
                </Chip>
              </Row>
            ))
          )}
        </Section>

        <Section
          title="Domains"
          icon={Globe}
          action={
            <Link href={`/projects/${project.id}?tab=domains`} className="text-xs text-fg-3 hover:text-fg">
              Manage
            </Link>
          }
        >
          {domains.length === 0 ? (
            <EmptyState icon={Globe} title="No domain" description="Route this project through the Cloudflare tunnel on the Domains tab." />
          ) : (
            domains.map((domain) => (
              <Row key={domain}>
                <StatusDot status={detail.tone === "idle" ? "idle" : detail.tone} />
                <a href={`https://${domain}`} target="_blank" rel="noreferrer" className="min-w-0 truncate font-mono text-[12px] hover:underline">
                  {domain}
                </a>
              </Row>
            ))
          )}
        </Section>
      </div>
    </div>
  );
}
