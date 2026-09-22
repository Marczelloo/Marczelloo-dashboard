export interface DocLink {
  id: string;
  title: string;
  /** Extra words the search matches on, beyond the title. */
  keywords?: string;
}

export interface DocGroup {
  id: string;
  label: string;
  sections: DocLink[];
}

export const DOC_GROUPS: DocGroup[] = [
  {
    id: "start",
    label: "Getting started",
    sections: [
      { id: "overview", title: "How it fits together", keywords: "architecture agent atlashub portainer cloudflared tunnel pi" },
      { id: "tour", title: "Finding your way", keywords: "navigation menu command palette ctrl k shortcuts" },
      { id: "install", title: "Installing", keywords: "setup docker compose clone env agent vendor" },
    ],
  },
  {
    id: "using",
    label: "Using it",
    sections: [
      { id: "projects", title: "Projects", keywords: "import github template dockerfile node python static tabs" },
      { id: "deploys", title: "Deploys", keywords: "push webhook build health gate rollback queue logs" },
      { id: "environment", title: "Environment variables", keywords: "env secrets encrypted apply versions restore" },
      { id: "domains", title: "Domains and the tunnel", keywords: "cloudflare route dns edge network mz-edge ports" },
      { id: "tasks", title: "Tasks", keywords: "todo work items bugs board" },
      { id: "host", title: "Host", keywords: "pi containers resources ports console terminal ssh" },
      { id: "monitoring", title: "Monitoring", keywords: "uptime incidents certificates ssl disk interval" },
      { id: "alerts", title: "Alerts", keywords: "discord notifications webhook switches" },
    ],
  },
  {
    id: "security",
    label: "Security",
    sections: [
      { id: "access", title: "Access and PIN", keywords: "cloudflare access owner emails pin session audit" },
      { id: "demo", title: "Demo instance", keywords: "demo mode mock public showcase" },
    ],
  },
  {
    id: "reference",
    label: "Reference",
    sections: [
      { id: "env-vars", title: "Configuration", keywords: "environment variables .env settings" },
      { id: "agent", title: "The agent", keywords: "mz-agent token rebuild update status jobs" },
      { id: "troubleshooting", title: "Troubleshooting", keywords: "errors failed unreachable 502 530 webhook rollback rolled back memory" },
    ],
  },
];

export function matchesQuery(link: DocLink, group: DocGroup, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${link.title} ${link.keywords ?? ""} ${group.label}`.toLowerCase().includes(needle);
}
