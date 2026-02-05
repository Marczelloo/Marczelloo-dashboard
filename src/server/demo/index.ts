/**
 * Demo Data Layer
 *
 * Provides mock data for demo mode. Mirrors the AtlasHub API structure
 * but returns static mock data. All write operations are no-ops.
 */

import "server-only";

import {
  mockProjects,
  mockServices,
  mockDeploys,
  mockWorkItems,
  mockUptimeChecks,
  mockAuditLogs,
  mockGeneralTodos,
  mockSettings,
} from "@/lib/mock-data";

import type {
  Project,
  Service,
  Deploy,
  WorkItem,
  UptimeCheck,
  AuditLog,
  CreateProjectInput,
  UpdateProjectInput,
  CreateServiceInput,
  UpdateServiceInput,
  CreateWorkItemInput,
  UpdateWorkItemInput,
  CreateDeployInput,
  DeployStatus,
} from "@/types";

import type { GeneralTodo, TodoStatus, CreateTodoInput, UpdateTodoInput } from "@/server/atlashub/general-todos";

// ========================================
// Projects
// ========================================

export const projects = {
  async getProjects(): Promise<Project[]> {
    return mockProjects;
  },

  async getProjectById(id: string): Promise<Project | null> {
    return mockProjects.find((p) => p.id === id) || null;
  },

  async getProjectBySlug(slug: string): Promise<Project | null> {
    return mockProjects.find((p) => p.slug === slug) || null;
  },

  async createProject(_input: CreateProjectInput): Promise<Project> {
    // Return a mock created project (won't persist)
    return mockProjects[0];
  },

  async updateProject(_id: string, _input: UpdateProjectInput): Promise<Project | null> {
    // Return the original project (no actual update)
    return mockProjects.find((p) => p.id === _id) || null;
  },

  async deleteProject(_id: string): Promise<boolean> {
    return false; // No-op in demo mode
  },

  async getProjectStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    archived: number;
  }> {
    return {
      total: mockProjects.length,
      active: mockProjects.filter((p) => p.status === "active").length,
      inactive: mockProjects.filter((p) => p.status === "inactive").length,
      archived: mockProjects.filter((p) => p.status === "archived").length,
    };
  },
};

// ========================================
// Services
// ========================================

export const services = {
  async getServices(): Promise<Service[]> {
    return mockServices;
  },

  async getServiceById(id: string): Promise<Service | null> {
    return mockServices.find((s) => s.id === id) || null;
  },

  async getServicesByProjectId(projectId: string): Promise<Service[]> {
    return mockServices.filter((s) => s.project_id === projectId);
  },

  async getStandaloneServices(): Promise<Service[]> {
    return mockServices.filter((s) => s.project_id === null);
  },

  async getProjectBoundServices(): Promise<Service[]> {
    return mockServices.filter((s) => s.project_id !== null);
  },

  async getDockerServices(): Promise<Service[]> {
    return mockServices.filter((s) => s.type === "docker");
  },

  async getMonitorableServices(): Promise<Service[]> {
    return mockServices.filter((s) => s.url !== null && s.url !== "");
  },

  async createService(_input: CreateServiceInput): Promise<Service> {
    return mockServices[0];
  },

  async updateService(_id: string, _input: UpdateServiceInput): Promise<Service | null> {
    return mockServices.find((s) => s.id === _id) || null;
  },

  async deleteService(_id: string): Promise<boolean> {
    return false;
  },

  async getServiceStats(): Promise<{
    total: number;
    docker: number;
    vercel: number;
    external: number;
  }> {
    return {
      total: mockServices.length,
      docker: mockServices.filter((s) => s.type === "docker").length,
      vercel: mockServices.filter((s) => s.type === "vercel").length,
      external: mockServices.filter((s) => s.type === "external").length,
    };
  },
};

// ========================================
// Deploys
// ========================================

export const deploys = {
  async getDeploys(): Promise<Deploy[]> {
    return mockDeploys;
  },

  async getDeployById(id: string): Promise<Deploy | null> {
    return mockDeploys.find((d) => d.id === id) || null;
  },

  async getDeploysByServiceId(serviceId: string, limit = 10): Promise<Deploy[]> {
    return mockDeploys.filter((d) => d.service_id === serviceId).slice(0, limit);
  },

  async getRecentDeploys(limit = 20): Promise<Deploy[]> {
    return mockDeploys.slice(0, limit);
  },

  async createDeploy(_input: CreateDeployInput): Promise<Deploy> {
    return mockDeploys[0];
  },

  async updateDeployStatus(
    id: string,
    _status: DeployStatus,
    _options?: { commit_sha?: string; logs_object_key?: string; error_message?: string }
  ): Promise<Deploy | null> {
    return mockDeploys.find((d) => d.id === id) || null;
  },

  async startDeploy(id: string): Promise<Deploy | null> {
    return mockDeploys.find((d) => d.id === id) || null;
  },

  async completeDeploy(
    id: string,
    _success: boolean,
    _options?: { commit_sha?: string; logs_object_key?: string; error_message?: string }
  ): Promise<Deploy | null> {
    return mockDeploys.find((d) => d.id === id) || null;
  },

  async getDeployStats(): Promise<{
    total: number;
    success: number;
    failed: number;
    pending: number;
    running: number;
  }> {
    return {
      total: mockDeploys.length,
      success: mockDeploys.filter((d) => d.status === "success").length,
      failed: mockDeploys.filter((d) => d.status === "failed").length,
      pending: mockDeploys.filter((d) => d.status === "pending").length,
      running: mockDeploys.filter((d) => d.status === "running").length,
    };
  },

  async deleteDeployById(_id: string): Promise<boolean> {
    return false;
  },

  async clearCompletedDeploys(): Promise<number> {
    return 0;
  },
};

// ========================================
// Work Items
// ========================================

export const workItems = {
  async getWorkItems(): Promise<WorkItem[]> {
    return mockWorkItems;
  },

  async getOpenWorkItems(): Promise<WorkItem[]> {
    return mockWorkItems.filter((w) => w.status === "open" || w.status === "in_progress" || w.status === "blocked");
  },

  async getWorkItemById(id: string): Promise<WorkItem | null> {
    return mockWorkItems.find((w) => w.id === id) || null;
  },

  async getWorkItemsByProjectId(projectId: string): Promise<WorkItem[]> {
    return mockWorkItems.filter((w) => w.project_id === projectId);
  },

  async getOpenWorkItemsByProjectId(projectId: string): Promise<WorkItem[]> {
    return mockWorkItems.filter(
      (w) => w.project_id === projectId && (w.status === "open" || w.status === "in_progress" || w.status === "blocked")
    );
  },

  async createWorkItem(_input: CreateWorkItemInput): Promise<WorkItem> {
    return mockWorkItems[0];
  },

  async updateWorkItem(_id: string, _input: UpdateWorkItemInput): Promise<WorkItem | null> {
    return mockWorkItems.find((w) => w.id === _id) || null;
  },

  async deleteWorkItem(_id: string): Promise<boolean> {
    return false;
  },

  async getWorkItemStats(): Promise<{
    total: number;
    open: number;
    in_progress: number;
    done: number;
    blocked: number;
  }> {
    return {
      total: mockWorkItems.length,
      open: mockWorkItems.filter((w) => w.status === "open").length,
      in_progress: mockWorkItems.filter((w) => w.status === "in_progress").length,
      done: mockWorkItems.filter((w) => w.status === "done").length,
      blocked: mockWorkItems.filter((w) => w.status === "blocked").length,
    };
  },
};

// ========================================
// Uptime Checks
// ========================================

export const uptimeChecks = {
  async getUptimeChecks(): Promise<UptimeCheck[]> {
    return mockUptimeChecks;
  },

  async getUptimeChecksByServiceId(serviceId: string, limit = 100): Promise<UptimeCheck[]> {
    return mockUptimeChecks.filter((u) => u.service_id === serviceId).slice(0, limit);
  },

  async getLatestCheckByServiceId(serviceId: string): Promise<UptimeCheck | null> {
    const checks = mockUptimeChecks.filter((u) => u.service_id === serviceId);
    return checks[0] || null;
  },

  async createUptimeCheck(): Promise<UptimeCheck> {
    return mockUptimeChecks[0];
  },

  async getUptimeStats(
    serviceId: string,
    _hours = 24
  ): Promise<{
    uptime: number;
    avgLatency: number;
    checks: number;
    lastOk: boolean;
  }> {
    const checks = mockUptimeChecks.filter((u) => u.service_id === serviceId);
    if (checks.length === 0) {
      return { uptime: 0, avgLatency: 0, checks: 0, lastOk: false };
    }
    const okChecks = checks.filter((c) => c.ok);
    const latencies = checks.filter((c) => c.latency_ms !== null).map((c) => c.latency_ms!);
    return {
      uptime: (okChecks.length / checks.length) * 100,
      avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      checks: checks.length,
      lastOk: checks[0]?.ok ?? false,
    };
  },

  async cleanupOldChecks(_daysToKeep = 30): Promise<number> {
    return 0;
  },
};

// ========================================
// Audit Logs
// ========================================

export const auditLogs = {
  async getAuditLogs(): Promise<AuditLog[]> {
    return mockAuditLogs;
  },

  async getRecentAuditLogs(limit = 50): Promise<AuditLog[]> {
    return mockAuditLogs.slice(0, limit);
  },

  async logAction(
    _actorEmail: string,
    _action: AuditLog["action"],
    _entityType: AuditLog["entity_type"],
    _entityId?: string,
    _metaJson?: Record<string, unknown>
  ): Promise<void> {
    // No-op in demo mode
  },

  async getAuditLogsByEntity(entityType: AuditLog["entity_type"], entityId: string, limit = 50): Promise<AuditLog[]> {
    return mockAuditLogs.filter((a) => a.entity_type === entityType && a.entity_id === entityId).slice(0, limit);
  },

  async getAuditLogsByActor(actorEmail: string, limit = 50): Promise<AuditLog[]> {
    return mockAuditLogs.filter((a) => a.actor_email === actorEmail).slice(0, limit);
  },

  async getAuditLogsByAction(action: AuditLog["action"], limit = 50): Promise<AuditLog[]> {
    return mockAuditLogs.filter((a) => a.action === action).slice(0, limit);
  },

  async cleanupOldLogs(_daysToKeep = 90): Promise<number> {
    return 0;
  },
};

// ========================================
// General Todos
// ========================================

export const generalTodos = {
  async getTodos(_status?: TodoStatus): Promise<GeneralTodo[]> {
    if (_status) {
      return mockGeneralTodos.filter((t) => t.status === _status);
    }
    return mockGeneralTodos;
  },

  async getActiveTodos(): Promise<GeneralTodo[]> {
    return mockGeneralTodos.filter((t) => t.status === "pending" || t.status === "in_progress");
  },

  async getTodoById(id: string): Promise<GeneralTodo | null> {
    return mockGeneralTodos.find((t) => t.id === id) || null;
  },

  async createTodo(_input: CreateTodoInput): Promise<GeneralTodo> {
    return mockGeneralTodos[0];
  },

  async updateTodo(_id: string, _input: UpdateTodoInput): Promise<GeneralTodo | null> {
    return mockGeneralTodos.find((t) => t.id === _id) || null;
  },

  async deleteTodo(_id: string): Promise<boolean> {
    return false;
  },

  async toggleTodoStatus(id: string): Promise<GeneralTodo | null> {
    return mockGeneralTodos.find((t) => t.id === id) || null;
  },

  async getTodosByDueDate(_before: string): Promise<GeneralTodo[]> {
    return mockGeneralTodos.filter((t) => t.due_date && t.due_date <= _before && t.status !== "completed");
  },
};

// ========================================
// Settings
// ========================================

export const settings = {
  async getSetting(key: string): Promise<string | null> {
    return mockSettings[key] || null;
  },

  async setSetting(_key: string, _value: string): Promise<boolean> {
    return false; // No-op in demo mode
  },

  async deleteSetting(_key: string): Promise<void> {
    // No-op in demo mode
  },

  async getPortainerToken(): Promise<string | null> {
    return "demo-portainer-token";
  },

  async setPortainerToken(_token: string, _expiresAt?: Date): Promise<boolean> {
    return false;
  },

  async getPortainerTokenExpiry(): Promise<Date | null> {
    return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  },

  async isPortainerTokenExpired(): Promise<boolean> {
    return false;
  },
};

import type { EnvVar } from "@/types";

// ========================================
// Env Vars (empty in demo - no secrets exposed)
// ========================================

export const envVars = {
  async getEnvVars(): Promise<EnvVar[]> {
    return [];
  },

  async getEnvVarsByServiceId(_serviceId: string): Promise<EnvVar[]> {
    return [];
  },

  async getEnvVarById(_id: string): Promise<EnvVar | null> {
    return null;
  },

  async createEnvVar(): Promise<EnvVar | null> {
    return null;
  },

  async updateEnvVar(): Promise<EnvVar | null> {
    return null;
  },

  async deleteEnvVar(): Promise<boolean> {
    return false;
  },

  async deleteEnvVarsByServiceId(_serviceId: string): Promise<number> {
    return 0;
  },

  async revealEnvVarValue(_id: string): Promise<string | null> {
    return null;
  },

  async getEnvVarsForDisplay(
    _serviceId: string
  ): Promise<(Omit<EnvVar, "value_encrypted"> & { value_masked: string })[]> {
    return [];
  },

  async bulkImportEnvVars(
    _serviceId: string,
    _envVars: { key: string; value: string; is_secret?: boolean }[]
  ): Promise<EnvVar[]> {
    return [];
  },
};
