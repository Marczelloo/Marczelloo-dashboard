/**
 * Mock Data for Demo Mode
 *
 * Realistic sample data for portfolio demonstrations.
 * All IDs are deterministic UUIDs for consistency.
 */

import type { Project, Service, Deploy, WorkItem, UptimeCheck, AuditLog } from "@/types";
import type { GeneralTodo } from "@/server/atlashub/general-todos";

// Helper to generate past dates
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function hoursAgo(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

function minutesAgo(minutes: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

// ========================================
// Projects
// ========================================

export const mockProjects: Project[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "AtlasHub",
    slug: "atlashub",
    description:
      "Self-hosted REST API backend providing database and storage services. The backbone of all my projects.",
    status: "active",
    tags: ["backend", "api", "self-hosted"],
    technologies: ["TypeScript", "Node.js", "SQLite", "Express"],
    github_url: "https://github.com/marczelloo/atlashub",
    prod_url: null,
    vercel_url: null,
    notes: "Core infrastructure - handle with care!",
    created_at: daysAgo(120),
    updated_at: daysAgo(2),
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Portfolio Website",
    slug: "portfolio",
    description: "Personal portfolio and blog showcasing projects and technical writing.",
    status: "active",
    tags: ["frontend", "portfolio", "blog"],
    technologies: ["Next.js", "TypeScript", "TailwindCSS", "MDX"],
    github_url: "https://github.com/marczelloo/portfolio",
    prod_url: "https://marczelloo.dev",
    vercel_url: "https://portfolio-marczelloo.vercel.app",
    notes: null,
    created_at: daysAgo(90),
    updated_at: daysAgo(5),
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Dashboard",
    slug: "dashboard",
    description: "This project manager panel you're currently viewing. Meta!",
    status: "active",
    tags: ["dashboard", "devops", "self-hosted"],
    technologies: ["Next.js", "TypeScript", "TailwindCSS", "Docker"],
    github_url: "https://github.com/marczelloo/dashboard",
    prod_url: "https://dashboard.marczelloo.dev",
    vercel_url: null,
    notes: "Demo mode is enabled for portfolio viewing.",
    created_at: daysAgo(60),
    updated_at: hoursAgo(1),
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Code Snippets API",
    slug: "snippets-api",
    description: "REST API for storing and retrieving code snippets with syntax highlighting.",
    status: "maintenance",
    tags: ["api", "tools", "developer"],
    technologies: ["Go", "PostgreSQL", "Redis"],
    github_url: "https://github.com/marczelloo/snippets-api",
    prod_url: "https://api.snippets.marczelloo.dev",
    vercel_url: null,
    notes: "Migrating to Rust for better performance.",
    created_at: daysAgo(180),
    updated_at: daysAgo(30),
  },
];

// ========================================
// Services
// ========================================

export const mockServices: Service[] = [
  // AtlasHub services
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    project_id: "11111111-1111-1111-1111-111111111111",
    name: "AtlasHub API",
    type: "docker",
    url: "http://localhost:3001",
    health_url: "http://localhost:3001/health",
    portainer_endpoint_id: 1,
    container_id: "atlashub-api-container",
    stack_id: 1,
    repo_path: "/home/pi/projects/atlashub",
    compose_project: "atlashub",
    deploy_strategy: "pull_rebuild",
    created_at: daysAgo(120),
    updated_at: daysAgo(2),
  },
  // Portfolio services
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    project_id: "22222222-2222-2222-2222-222222222222",
    name: "Portfolio (Vercel)",
    type: "vercel",
    url: "https://marczelloo.dev",
    health_url: "https://marczelloo.dev",
    portainer_endpoint_id: null,
    container_id: null,
    stack_id: null,
    repo_path: null,
    compose_project: null,
    deploy_strategy: "manual",
    created_at: daysAgo(90),
    updated_at: daysAgo(5),
  },
  // Dashboard services
  {
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    project_id: "33333333-3333-3333-3333-333333333333",
    name: "Dashboard App",
    type: "docker",
    url: "http://localhost:3100",
    health_url: "http://localhost:3100/api/health",
    portainer_endpoint_id: 1,
    container_id: "dashboard-app-container",
    stack_id: 2,
    repo_path: "/home/pi/projects/dashboard",
    compose_project: "dashboard",
    deploy_strategy: "pull_rebuild",
    created_at: daysAgo(60),
    updated_at: hoursAgo(1),
  },
  {
    id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    project_id: "33333333-3333-3333-3333-333333333333",
    name: "Dashboard Runner",
    type: "docker",
    url: null,
    health_url: "http://localhost:8787/health",
    portainer_endpoint_id: 1,
    container_id: "dashboard-runner-container",
    stack_id: 2,
    repo_path: null,
    compose_project: null,
    deploy_strategy: "manual",
    created_at: daysAgo(60),
    updated_at: daysAgo(10),
  },
  // Snippets API services
  {
    id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    project_id: "44444444-4444-4444-4444-444444444444",
    name: "Snippets API",
    type: "docker",
    url: "https://api.snippets.marczelloo.dev",
    health_url: "https://api.snippets.marczelloo.dev/health",
    portainer_endpoint_id: 1,
    container_id: "snippets-api-container",
    stack_id: 3,
    repo_path: "/home/pi/projects/snippets-api",
    compose_project: "snippets",
    deploy_strategy: "pull_restart",
    created_at: daysAgo(180),
    updated_at: daysAgo(30),
  },
  // Standalone service (no project)
  {
    id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    project_id: null,
    name: "Portainer",
    type: "docker",
    url: "http://localhost:9000",
    health_url: "http://localhost:9000/api/status",
    portainer_endpoint_id: 1,
    container_id: "portainer-container",
    stack_id: null,
    repo_path: null,
    compose_project: null,
    deploy_strategy: "manual",
    created_at: daysAgo(200),
    updated_at: daysAgo(45),
  },
];

// ========================================
// Deploys
// ========================================

export const mockDeploys: Deploy[] = [
  // Recent successful deploy
  {
    id: "d1111111-1111-1111-1111-111111111111",
    service_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    started_at: minutesAgo(15),
    finished_at: minutesAgo(12),
    status: "success",
    commit_sha: "a1b2c3d4e5f6789012345678901234567890abcd",
    logs_object_key: "deploys/dashboard/2026-02-05-001.log",
    triggered_by: "demo@marczelloo.dev",
    error_message: null,
  },
  // Running deploy
  {
    id: "d2222222-2222-2222-2222-222222222222",
    service_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    started_at: minutesAgo(2),
    finished_at: null,
    status: "running",
    commit_sha: "b2c3d4e5f67890123456789012345678901abcde",
    logs_object_key: "deploys/atlashub/2026-02-05-002.log",
    triggered_by: "github-webhook",
    error_message: null,
  },
  // Failed deploy
  {
    id: "d3333333-3333-3333-3333-333333333333",
    service_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    started_at: hoursAgo(3),
    finished_at: hoursAgo(3),
    status: "failed",
    commit_sha: "c3d4e5f678901234567890123456789012abcdef",
    logs_object_key: "deploys/snippets/2026-02-05-001.log",
    triggered_by: "demo@marczelloo.dev",
    error_message: "Build failed: missing dependency 'libssl-dev'",
  },
  // Older successful deploys
  {
    id: "d4444444-4444-4444-4444-444444444444",
    service_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    started_at: daysAgo(1),
    finished_at: new Date(new Date(daysAgo(1)).getTime() + 45000).toISOString(),
    status: "success",
    commit_sha: "d4e5f6789012345678901234567890123abcdefg",
    logs_object_key: "deploys/dashboard/2026-02-04-001.log",
    triggered_by: "demo@marczelloo.dev",
    error_message: null,
  },
  {
    id: "d5555555-5555-5555-5555-555555555555",
    service_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    started_at: daysAgo(2),
    finished_at: new Date(new Date(daysAgo(2)).getTime() + 62000).toISOString(),
    status: "success",
    commit_sha: "e5f67890123456789012345678901234abcdefgh",
    logs_object_key: "deploys/atlashub/2026-02-03-001.log",
    triggered_by: "github-webhook",
    error_message: null,
  },
  {
    id: "d6666666-6666-6666-6666-666666666666",
    service_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    started_at: daysAgo(3),
    finished_at: new Date(new Date(daysAgo(3)).getTime() + 38000).toISOString(),
    status: "success",
    commit_sha: "f6789012345678901234567890123456abcdefghi",
    logs_object_key: "deploys/dashboard/2026-02-02-001.log",
    triggered_by: "demo@marczelloo.dev",
    error_message: null,
  },
  {
    id: "d7777777-7777-7777-7777-777777777777",
    service_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    started_at: daysAgo(5),
    finished_at: new Date(new Date(daysAgo(5)).getTime() + 120000).toISOString(),
    status: "success",
    commit_sha: "g78901234567890123456789012345678abcdefghij",
    logs_object_key: "deploys/snippets/2026-01-31-001.log",
    triggered_by: "demo@marczelloo.dev",
    error_message: null,
  },
];

// ========================================
// Work Items
// ========================================

export const mockWorkItems: WorkItem[] = [
  // Dashboard work items
  {
    id: "w1111111-1111-1111-1111-111111111111",
    project_id: "33333333-3333-3333-3333-333333333333",
    type: "todo",
    title: "Add dark/light theme toggle",
    description: "Users should be able to switch between dark and light modes",
    status: "open",
    priority: "medium",
    labels: ["enhancement", "ui"],
    github_issue_number: 42,
    github_pr_number: null,
    created_at: daysAgo(10),
    updated_at: daysAgo(1),
  },
  {
    id: "w2222222-2222-2222-2222-222222222222",
    project_id: "33333333-3333-3333-3333-333333333333",
    type: "bug",
    title: "Fix deploy status not updating in real-time",
    description: "The deploy status badge sometimes shows 'running' even after completion",
    status: "in_progress",
    priority: "high",
    labels: ["bug", "deploy"],
    github_issue_number: 45,
    github_pr_number: 46,
    created_at: daysAgo(5),
    updated_at: hoursAgo(4),
  },
  {
    id: "w3333333-3333-3333-3333-333333333333",
    project_id: "33333333-3333-3333-3333-333333333333",
    type: "change",
    title: "Migrate to Next.js 16",
    description: "Upgrade to Next.js 16 for improved caching and performance",
    status: "done",
    priority: "medium",
    labels: ["upgrade", "performance"],
    github_issue_number: 38,
    github_pr_number: 40,
    created_at: daysAgo(20),
    updated_at: daysAgo(7),
  },
  // AtlasHub work items
  {
    id: "w4444444-4444-4444-4444-444444444444",
    project_id: "11111111-1111-1111-1111-111111111111",
    type: "todo",
    title: "Add rate limiting",
    description: "Implement request rate limiting to prevent abuse",
    status: "open",
    priority: "high",
    labels: ["security", "api"],
    github_issue_number: 12,
    github_pr_number: null,
    created_at: daysAgo(15),
    updated_at: daysAgo(3),
  },
  {
    id: "w5555555-5555-5555-5555-555555555555",
    project_id: "11111111-1111-1111-1111-111111111111",
    type: "todo",
    title: "Add backup automation",
    description: "Automatic daily backups to external storage",
    status: "blocked",
    priority: "critical",
    labels: ["infrastructure", "backup"],
    github_issue_number: 15,
    github_pr_number: null,
    created_at: daysAgo(25),
    updated_at: daysAgo(8),
  },
  // Portfolio work items
  {
    id: "w6666666-6666-6666-6666-666666666666",
    project_id: "22222222-2222-2222-2222-222222222222",
    type: "todo",
    title: "Write blog post about self-hosting",
    description: "Document the journey of self-hosting on Raspberry Pi",
    status: "in_progress",
    priority: "low",
    labels: ["content", "blog"],
    github_issue_number: null,
    github_pr_number: null,
    created_at: daysAgo(8),
    updated_at: daysAgo(1),
  },
];

// ========================================
// Uptime Checks
// ========================================

export const mockUptimeChecks: UptimeCheck[] = [
  // Recent checks for Dashboard
  {
    id: "u1111111-1111-1111-1111-111111111111",
    service_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    checked_at: minutesAgo(5),
    status_code: 200,
    latency_ms: 45,
    ssl_days_left: 89,
    ok: true,
    error: null,
  },
  {
    id: "u2222222-2222-2222-2222-222222222222",
    service_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    checked_at: minutesAgo(35),
    status_code: 200,
    latency_ms: 52,
    ssl_days_left: 89,
    ok: true,
    error: null,
  },
  // AtlasHub checks
  {
    id: "u3333333-3333-3333-3333-333333333333",
    service_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    checked_at: minutesAgo(5),
    status_code: 200,
    latency_ms: 12,
    ssl_days_left: null,
    ok: true,
    error: null,
  },
  // Portfolio checks (external)
  {
    id: "u4444444-4444-4444-4444-444444444444",
    service_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    checked_at: minutesAgo(5),
    status_code: 200,
    latency_ms: 180,
    ssl_days_left: 45,
    ok: true,
    error: null,
  },
  // Snippets API - degraded
  {
    id: "u5555555-5555-5555-5555-555555555555",
    service_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    checked_at: minutesAgo(5),
    status_code: 503,
    latency_ms: 5000,
    ssl_days_left: 30,
    ok: false,
    error: "Service unavailable - maintenance mode",
  },
  // Portainer
  {
    id: "u6666666-6666-6666-6666-666666666666",
    service_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    checked_at: minutesAgo(5),
    status_code: 200,
    latency_ms: 8,
    ssl_days_left: null,
    ok: true,
    error: null,
  },
];

// ========================================
// Audit Logs
// ========================================

export const mockAuditLogs: AuditLog[] = [
  {
    id: "al111111-1111-1111-1111-111111111111",
    at: minutesAgo(15),
    actor_email: "demo@marczelloo.dev",
    action: "deploy",
    entity_type: "service",
    entity_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    meta_json: { deploy_id: "d1111111-1111-1111-1111-111111111111" },
  },
  {
    id: "al222222-2222-2222-2222-222222222222",
    at: minutesAgo(30),
    actor_email: "demo@marczelloo.dev",
    action: "update",
    entity_type: "project",
    entity_id: "33333333-3333-3333-3333-333333333333",
    meta_json: { fields: ["notes"] },
  },
  {
    id: "al333333-3333-3333-3333-333333333333",
    at: hoursAgo(2),
    actor_email: "demo@marczelloo.dev",
    action: "pin_verify",
    entity_type: "auth",
    entity_id: null,
    meta_json: { success: true },
  },
  {
    id: "al444444-4444-4444-4444-444444444444",
    at: hoursAgo(3),
    actor_email: "demo@marczelloo.dev",
    action: "deploy",
    entity_type: "service",
    entity_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    meta_json: { deploy_id: "d3333333-3333-3333-3333-333333333333", status: "failed" },
  },
  {
    id: "al555555-5555-5555-5555-555555555555",
    at: daysAgo(1),
    actor_email: "demo@marczelloo.dev",
    action: "create",
    entity_type: "work_item",
    entity_id: "w1111111-1111-1111-1111-111111111111",
    meta_json: { title: "Add dark/light theme toggle" },
  },
  {
    id: "al666666-6666-6666-6666-666666666666",
    at: daysAgo(1),
    actor_email: "github-webhook",
    action: "github_webhook_trigger",
    entity_type: "service",
    entity_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    meta_json: { branch: "main", commit: "e5f67890" },
  },
  {
    id: "al777777-7777-7777-7777-777777777777",
    at: daysAgo(2),
    actor_email: "demo@marczelloo.dev",
    action: "restart",
    entity_type: "container",
    entity_id: "atlashub-api-container",
    meta_json: null,
  },
  {
    id: "al888888-8888-8888-8888-888888888888",
    at: daysAgo(3),
    actor_email: "demo@marczelloo.dev",
    action: "login",
    entity_type: "auth",
    entity_id: null,
    meta_json: { method: "cloudflare_access" },
  },
];

// ========================================
// General Todos
// ========================================

export const mockGeneralTodos: GeneralTodo[] = [
  {
    id: "gt111111-1111-1111-1111-111111111111",
    title: "Set up monitoring alerts",
    description: "Configure Discord notifications for downtime events",
    priority: "high",
    status: "in_progress",
    due_date: daysAgo(-2), // 2 days in the future
    completed_at: null,
    created_at: daysAgo(5),
    updated_at: hoursAgo(6),
  },
  {
    id: "gt222222-2222-2222-2222-222222222222",
    title: "Review SSL certificates",
    description: "Check expiration dates and set up auto-renewal",
    priority: "medium",
    status: "pending",
    due_date: daysAgo(-7), // 7 days in the future
    completed_at: null,
    created_at: daysAgo(10),
    updated_at: daysAgo(10),
  },
  {
    id: "gt333333-3333-3333-3333-333333333333",
    title: "Update Docker images",
    description: "Pull latest base images for security patches",
    priority: "medium",
    status: "completed",
    due_date: daysAgo(3),
    completed_at: daysAgo(2),
    created_at: daysAgo(8),
    updated_at: daysAgo(2),
  },
  {
    id: "gt444444-4444-4444-4444-444444444444",
    title: "Document deployment process",
    description: "Write comprehensive guide for future reference",
    priority: "low",
    status: "pending",
    due_date: null,
    completed_at: null,
    created_at: daysAgo(15),
    updated_at: daysAgo(15),
  },
  {
    id: "gt555555-5555-5555-5555-555555555555",
    title: "Backup Pi SD card",
    description: "Create full system backup before any major changes",
    priority: "critical",
    status: "pending",
    due_date: daysAgo(-1), // tomorrow
    completed_at: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  },
];

// ========================================
// Settings (key-value pairs)
// ========================================

export const mockSettings: Record<string, string> = {
  portainer_url: "http://localhost:9000",
  runner_url: "http://localhost:8787",
  discord_webhook_enabled: "true",
  monitoring_interval_minutes: "30",
  default_deploy_strategy: "pull_rebuild",
};

// ========================================
// Mock Containers (for demo mode)
// ========================================

export interface MockContainer {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  Created: number;
  Ports: Array<{ PrivatePort: number; PublicPort?: number; Type: string }>;
}

export interface MockEndpoint {
  Id: number;
  Name: string;
}

export const mockEndpoints: MockEndpoint[] = [{ Id: 1, Name: "Raspberry Pi" }];

export const mockContainers: MockContainer[] = [
  {
    Id: "abc123def456789012345678901234567890abcdef",
    Names: ["/atlashub-api"],
    Image: "atlashub:latest",
    State: "running",
    Status: "Up 5 days",
    Created: Math.floor(Date.now() / 1000) - 432000, // 5 days ago
    Ports: [{ PrivatePort: 3001, PublicPort: 3001, Type: "tcp" }],
  },
  {
    Id: "def456789012345678901234567890abcdef123456",
    Names: ["/dashboard-app"],
    Image: "marczelloo-dashboard:latest",
    State: "running",
    Status: "Up 2 days",
    Created: Math.floor(Date.now() / 1000) - 172800, // 2 days ago
    Ports: [{ PrivatePort: 3100, PublicPort: 3100, Type: "tcp" }],
  },
  {
    Id: "789012345678901234567890abcdef123456789abc",
    Names: ["/dashboard-runner"],
    Image: "marczelloo-runner:latest",
    State: "running",
    Status: "Up 2 days",
    Created: Math.floor(Date.now() / 1000) - 172800,
    Ports: [{ PrivatePort: 8787, PublicPort: 8787, Type: "tcp" }],
  },
  {
    Id: "abcdef123456789012345678901234567890defabc",
    Names: ["/portainer"],
    Image: "portainer/portainer-ce:latest",
    State: "running",
    Status: "Up 30 days",
    Created: Math.floor(Date.now() / 1000) - 2592000, // 30 days ago
    Ports: [
      { PrivatePort: 9000, PublicPort: 9000, Type: "tcp" },
      { PrivatePort: 9443, PublicPort: 9443, Type: "tcp" },
    ],
  },
  {
    Id: "567890123456789012345678901234567890fedcba",
    Names: ["/redis-cache"],
    Image: "redis:7-alpine",
    State: "running",
    Status: "Up 15 days",
    Created: Math.floor(Date.now() / 1000) - 1296000, // 15 days ago
    Ports: [{ PrivatePort: 6379, Type: "tcp" }],
  },
  {
    Id: "fedcba098765432109876543210987654321098765",
    Names: ["/snippets-api"],
    Image: "snippets-api:latest",
    State: "exited",
    Status: "Exited (1) 3 hours ago",
    Created: Math.floor(Date.now() / 1000) - 604800, // 7 days ago
    Ports: [{ PrivatePort: 8080, PublicPort: 8080, Type: "tcp" }],
  },
];

// ========================================
// Mock Pi Metrics (for demo mode)
// ========================================

export interface MockPiMetrics {
  hostname: string;
  uptime: string;
  cpu: {
    usage: number;
    cores: number;
    load1: number;
    load5: number;
    load15: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    available: number;
    usagePercent: number;
  };
  disk: {
    total: string;
    used: string;
    available: string;
    usagePercent: number;
    mount: string;
  };
  temperature: number | null;
  docker: {
    containersRunning: number;
    containersStopped: number;
    imagesCount: number;
  };
  network: {
    ip: string;
  };
}

export const mockPiMetrics: MockPiMetrics = {
  hostname: "raspberrypi",
  uptime: "45 days, 3 hours",
  cpu: {
    usage: 23,
    cores: 4,
    load1: 0.92,
    load5: 0.78,
    load15: 0.65,
  },
  memory: {
    total: 3906,
    used: 1842,
    free: 512,
    available: 2064,
    usagePercent: 47,
  },
  disk: {
    total: "58G",
    used: "24G",
    available: "32G",
    usagePercent: 42,
    mount: "/",
  },
  temperature: 48.5,
  docker: {
    containersRunning: 5,
    containersStopped: 1,
    imagesCount: 12,
  },
  network: {
    ip: "192.168.1.100",
  },
};
