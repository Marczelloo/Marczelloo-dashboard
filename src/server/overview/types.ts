import type { UptimeState } from "@/components/ui/uptime-strip";
import type { Tone } from "@/lib/tone";
import type { DeployStatus } from "@/types";

import type { AgentStatus } from "@agent/types";
import type { GeneralTodo } from "@/server/atlashub/general-todos";
import type { MonitorIncident } from "@/server/atlashub/monitor";
import type { DeploymentConfig } from "@/server/deployments/config";
import type { TargetState } from "@/server/monitoring/types";
import type { PiMetrics } from "@/server/pi/metrics";
import type { AuditLog, Deploy, Project, Service, WorkItem } from "@/types";

export type DeployPhase = "fetch" | "config" | "build" | "start" | "health" | "rollback";

export interface HourBucket {
  start: string;
  state: UptimeState;
}

export type Attention =
  | { kind: "deploying"; jobId: string; phase: DeployPhase | null; startedAt: string | null; sha: string }
  | { kind: "down" | "degraded"; reason: string; since: string; container: { name: string; service: string; status: string; exitCode: number } | null };

export interface FleetRow {
  projectId: string;
  name: string;
  slug: string;
  domain: string | null;
  composeProject: string | null;
  /** Docker service used for restarts. */
  serviceId: string | null;
  tone: Tone;
  uptime: HourBucket[];
  containers: { running: number; total: number } | null;
  lastDeploy: { at: string; sha: string | null; status: DeployStatus } | null;
  attention: Attention | null;
}

export interface ActivityItem {
  id: string;
  at: string;
  tone: Tone;
  title: string;
  detail: string | null;
  href: string | null;
}

export interface Task {
  id: string;
  source: "todo" | "work_item";
  projectId: string | null;
  title: string;
  status: "open" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "critical";
  dueDate: string | null;
  updatedAt: string;
}

export interface HostSummary {
  hostname: string;
  cpu: number;
  memory: number;
  disk: number;
  temperature: number | null;
}

export interface Overview {
  generatedAt: string;
  domains: { up: number; total: number; checkedAt: string | null };
  incidents: { open: number; newest: { label: string; since: string } | null };
  deploys7d: { total: number; failed: number };
  host: HostSummary | null;
  fleet: FleetRow[];
  activity: ActivityItem[];
  tasksDue: Task[];
}

export interface OverviewInputs {
  projects: Project[];
  services: Service[];
  configs: Array<Pick<DeploymentConfig, "projectId" | "composeProject" | "tunnel">>;
  states: TargetState[];
  incidents: MonitorIncident[];
  deploys: Deploy[];
  audit: AuditLog[];
  todos: GeneralTodo[];
  workItems: WorkItem[];
  agent: AgentStatus | null;
  host: Pick<PiMetrics, "hostname" | "cpu" | "memory" | "disk" | "temperature"> | null;
}
