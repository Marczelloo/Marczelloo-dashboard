import Link from "next/link";
import { GitBranch, Globe, ListChecks, Plus, Rocket, Server } from "lucide-react";
import { NewTaskButton } from "@/components/features/new-task-button";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/card";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
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
  return <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3.5 py-2.5 text-[13px] [&+&]:border-t [&+&]:border-line-subtle">{children}</div>;
}

export function OverviewTab({ detail }: { detail: ProjectDetail }) {
  const { project, services, deploys, workItems, agent, config } = detail;
  const containerOf = (serviceName: string) => agent?.containers.find((container) => container.service === serviceName) ?? null;
  const open = workItems.filter((item) => item.status !== "done").slice(0, 5);
  const domains = [config?.tunnel?.hostname, detail.domain].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <ReleaseSummary detail={detail} />
        <Section
          title="Services"
          icon={Server}
          action={
            <span className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-fg-3">{services.length}</span>
              <Link href={`/projects/${project.id}?tab=logs`} className="text-xs text-fg-3 hover:text-fg">
                Logs
              </Link>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/projects/${project.id}/services/new`}>
                  <Plus strokeWidth={1.75} />
                  Add service
                </Link>
              </Button>
            </span>
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
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    <Chip mono>{service.type}</Chip>
                    {container && container.status !== "running" && <Chip tone="err">{container.status}</Chip>}
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
                <span className="ml-auto flex shrink-0 items-center gap-2 text-[11.5px] text-fg-3">
                  {formatRelativeTime(deploy.started_at)}
                  {deploy.status !== "success" && <Chip tone={DEPLOY_TONE[deploy.status]}>{deploy.status}</Chip>}
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
            <span className="flex items-center gap-3">
              <Link href={`/projects/${project.id}/work-items`} className="text-xs text-fg-3 hover:text-fg">
                Board
              </Link>
              <NewTaskButton projectId={project.id} variant="secondary" />
            </span>
          }
        >
          {open.length === 0 ? (
            <EmptyState icon={ListChecks} title="Nothing open" description="Tasks for this project show up here." className="py-6" />
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
            <EmptyState icon={Globe} title="No domain" description="Route it through the Cloudflare tunnel on the Domains tab." className="py-6" />
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

        <RepositoryCard detail={detail} />
      </div>
    </div>
  );
}

/** What is live right now, and how to act on it. */
function ReleaseSummary({ detail }: { detail: ProjectDetail }) {
  const live = detail.deploys.find((deploy) => deploy.status === "success") ?? detail.deploys[0] ?? null;
  const deploying = detail.attention?.kind === "deploying";
  return (
    <Panel className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 p-3.5">
      <div className="min-w-0">
        <p className="text-[11.5px] text-fg-3">{deploying ? "Deploying" : "Live release"}</p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <code className="text-[17px] font-semibold text-fg">{live?.commit_sha?.slice(0, 7) ?? "nothing deployed"}</code>
          {live?.error_message && <span className="text-[13px] text-err">{live.error_message}</span>}
        </p>
        <p className="mt-1 truncate text-[11.5px] text-fg-3">
          {live ? `${formatRelativeTime(live.started_at)} by ${live.triggered_by} · ${formatDateTime(live.started_at)}` : "Push to the configured branch, or press Deploy above."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" asChild>
          <Link href={`/projects/${detail.project.id}?tab=deployments`}>
            <Rocket strokeWidth={1.75} />
            {deploying ? "Live logs" : "Releases and rollback"}
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

/** Repository facts the project page can show without calling GitHub. */
function RepositoryCard({ detail }: { detail: ProjectDetail }) {
  const technologies = Array.isArray(detail.project.technologies) ? detail.project.technologies : [];
  const repo = detail.project.github_url?.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "") ?? null;
  return (
    <Section
      title="Repository"
      icon={GitBranch}
      action={
        <Link href={`/projects/${detail.project.id}?tab=code`} className="text-xs text-fg-3 hover:text-fg">
          Browse code
        </Link>
      }
    >
      {repo ? (
        <>
          <Row>
            <span className="text-fg-3">Repo</span>
            <a href={detail.project.github_url!} target="_blank" rel="noreferrer" className="ml-auto truncate font-mono text-[12px] hover:underline">
              {repo}
            </a>
          </Row>
          <Row>
            <span className="text-fg-3">Branch</span>
            <code className="ml-auto text-[12px] text-fg-2">{detail.config?.branch ?? "main"}</code>
          </Row>
          {technologies.length > 0 && (
            <Row>
              <span className="text-fg-3">Stack</span>
              <span className="ml-auto flex flex-wrap justify-end gap-1.5">
                {technologies.slice(0, 4).map((item) => (
                  <Chip key={item}>{item}</Chip>
                ))}
              </span>
            </Row>
          )}
        </>
      ) : (
        <EmptyState icon={GitBranch} title="No repository" description="Link one in the project settings to deploy from pushes." className="py-6" />
      )}
    </Section>
  );
}
