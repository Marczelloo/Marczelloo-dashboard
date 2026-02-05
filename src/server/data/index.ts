/**
 * Data Wrapper Layer
 *
 * Provides a unified API that switches between real AtlasHub data
 * and mock demo data based on the DEMO_MODE environment variable.
 *
 * Usage: import { projects, services, ... } from "@/server/data";
 */

import "server-only";

import { isDemoMode } from "@/lib/demo-mode";

// Import both data sources
import * as atlashub from "@/server/atlashub";
import * as demo from "@/server/demo";

// ========================================
// Helper to get the active data source
// ========================================

function getSource() {
  return isDemoMode() ? demo : atlashub;
}

// ========================================
// Projects
// ========================================

export const projects = {
  getProjects: (...args: Parameters<typeof atlashub.projects.getProjects>) => getSource().projects.getProjects(...args),

  getProjectById: (id: string) => getSource().projects.getProjectById(id),

  getProjectBySlug: (slug: string) => getSource().projects.getProjectBySlug(slug),

  createProject: (...args: Parameters<typeof atlashub.projects.createProject>) =>
    getSource().projects.createProject(...args),

  updateProject: (...args: Parameters<typeof atlashub.projects.updateProject>) =>
    getSource().projects.updateProject(...args),

  deleteProject: (id: string) => getSource().projects.deleteProject(id),

  getProjectStats: () => getSource().projects.getProjectStats(),
};

// ========================================
// Services
// ========================================

export const services = {
  getServices: (...args: Parameters<typeof atlashub.services.getServices>) => getSource().services.getServices(...args),

  getServiceById: (id: string) => getSource().services.getServiceById(id),

  getServicesByProjectId: (projectId: string) => getSource().services.getServicesByProjectId(projectId),

  getStandaloneServices: () => getSource().services.getStandaloneServices(),

  getProjectBoundServices: () => getSource().services.getProjectBoundServices(),

  getDockerServices: () => getSource().services.getDockerServices(),

  getMonitorableServices: () => getSource().services.getMonitorableServices(),

  createService: (...args: Parameters<typeof atlashub.services.createService>) =>
    getSource().services.createService(...args),

  updateService: (...args: Parameters<typeof atlashub.services.updateService>) =>
    getSource().services.updateService(...args),

  deleteService: (id: string) => getSource().services.deleteService(id),

  getServiceStats: () => getSource().services.getServiceStats(),
};

// ========================================
// Deploys
// ========================================

export const deploys = {
  getDeploys: (...args: Parameters<typeof atlashub.deploys.getDeploys>) => getSource().deploys.getDeploys(...args),

  getDeployById: (id: string) => getSource().deploys.getDeployById(id),

  getDeploysByServiceId: (serviceId: string, limit?: number) =>
    getSource().deploys.getDeploysByServiceId(serviceId, limit),

  getRecentDeploys: (limit?: number) => getSource().deploys.getRecentDeploys(limit),

  createDeploy: (...args: Parameters<typeof atlashub.deploys.createDeploy>) =>
    getSource().deploys.createDeploy(...args),

  updateDeployStatus: (...args: Parameters<typeof atlashub.deploys.updateDeployStatus>) =>
    getSource().deploys.updateDeployStatus(...args),

  startDeploy: (id: string) => getSource().deploys.startDeploy(id),

  completeDeploy: (...args: Parameters<typeof atlashub.deploys.completeDeploy>) =>
    getSource().deploys.completeDeploy(...args),

  getDeployStats: () => getSource().deploys.getDeployStats(),

  deleteDeployById: (id: string) => getSource().deploys.deleteDeployById(id),

  clearCompletedDeploys: () => getSource().deploys.clearCompletedDeploys(),
};

// ========================================
// Work Items
// ========================================

export const workItems = {
  getWorkItems: (...args: Parameters<typeof atlashub.workItems.getWorkItems>) =>
    getSource().workItems.getWorkItems(...args),

  getOpenWorkItems: () => getSource().workItems.getOpenWorkItems(),

  getWorkItemById: (id: string) => getSource().workItems.getWorkItemById(id),

  getWorkItemsByProjectId: (projectId: string) => getSource().workItems.getWorkItemsByProjectId(projectId),

  getOpenWorkItemsByProjectId: (projectId: string) => getSource().workItems.getOpenWorkItemsByProjectId(projectId),

  createWorkItem: (...args: Parameters<typeof atlashub.workItems.createWorkItem>) =>
    getSource().workItems.createWorkItem(...args),

  updateWorkItem: (...args: Parameters<typeof atlashub.workItems.updateWorkItem>) =>
    getSource().workItems.updateWorkItem(...args),

  deleteWorkItem: (id: string) => getSource().workItems.deleteWorkItem(id),

  getWorkItemStats: () => getSource().workItems.getWorkItemStats(),
};

// ========================================
// Uptime Checks
// ========================================

export const uptimeChecks = {
  getUptimeChecks: (...args: Parameters<typeof atlashub.uptimeChecks.getUptimeChecks>) =>
    getSource().uptimeChecks.getUptimeChecks(...args),

  getUptimeChecksByServiceId: (serviceId: string, limit?: number) =>
    getSource().uptimeChecks.getUptimeChecksByServiceId(serviceId, limit),

  getLatestCheckByServiceId: (serviceId: string) => getSource().uptimeChecks.getLatestCheckByServiceId(serviceId),

  createUptimeCheck: (...args: Parameters<typeof atlashub.uptimeChecks.createUptimeCheck>) =>
    getSource().uptimeChecks.createUptimeCheck(...args),

  getUptimeStats: (...args: Parameters<typeof atlashub.uptimeChecks.getUptimeStats>) =>
    getSource().uptimeChecks.getUptimeStats(...args),
};

// ========================================
// Audit Logs
// ========================================

export const auditLogs = {
  getAuditLogs: (...args: Parameters<typeof atlashub.auditLogs.getAuditLogs>) =>
    getSource().auditLogs.getAuditLogs(...args),

  getRecentAuditLogs: (limit?: number) => getSource().auditLogs.getRecentAuditLogs(limit),

  logAction: (...args: Parameters<typeof atlashub.auditLogs.logAction>) => getSource().auditLogs.logAction(...args),

  getAuditLogsByEntity: (...args: Parameters<typeof atlashub.auditLogs.getAuditLogsByEntity>) =>
    getSource().auditLogs.getAuditLogsByEntity(...args),

  getAuditLogsByActor: (...args: Parameters<typeof atlashub.auditLogs.getAuditLogsByActor>) =>
    getSource().auditLogs.getAuditLogsByActor(...args),

  getAuditLogsByAction: (...args: Parameters<typeof atlashub.auditLogs.getAuditLogsByAction>) =>
    getSource().auditLogs.getAuditLogsByAction(...args),
};

// ========================================
// General Todos
// ========================================

export const generalTodos = {
  getTodos: (...args: Parameters<typeof atlashub.generalTodos.getTodos>) => getSource().generalTodos.getTodos(...args),

  getActiveTodos: () => getSource().generalTodos.getActiveTodos(),

  getTodoById: (id: string) => getSource().generalTodos.getTodoById(id),

  createTodo: (...args: Parameters<typeof atlashub.generalTodos.createTodo>) =>
    getSource().generalTodos.createTodo(...args),

  updateTodo: (...args: Parameters<typeof atlashub.generalTodos.updateTodo>) =>
    getSource().generalTodos.updateTodo(...args),

  deleteTodo: (id: string) => getSource().generalTodos.deleteTodo(id),

  toggleTodoStatus: (id: string) => getSource().generalTodos.toggleTodoStatus(id),

  getTodosByDueDate: (before: string) => getSource().generalTodos.getTodosByDueDate(before),
};

// ========================================
// Settings
// ========================================

export const settings = {
  getSetting: (key: string) => getSource().settings.getSetting(key),

  setSetting: (key: string, value: string) => getSource().settings.setSetting(key, value),

  deleteSetting: (key: string) => getSource().settings.deleteSetting(key),

  getPortainerToken: () => getSource().settings.getPortainerToken(),

  setPortainerToken: (token: string, expiresAt?: Date) => getSource().settings.setPortainerToken(token, expiresAt),

  getPortainerTokenExpiry: () => getSource().settings.getPortainerTokenExpiry(),

  isPortainerTokenExpired: () => getSource().settings.isPortainerTokenExpired(),
};

// ========================================
// Env Vars
// ========================================

export const envVars = {
  getEnvVars: (...args: Parameters<typeof atlashub.envVars.getEnvVars>) => getSource().envVars.getEnvVars(...args),

  getEnvVarsByServiceId: (serviceId: string) => getSource().envVars.getEnvVarsByServiceId(serviceId),

  getEnvVarById: (id: string) => getSource().envVars.getEnvVarById(id),

  createEnvVar: (...args: Parameters<typeof atlashub.envVars.createEnvVar>) =>
    getSource().envVars.createEnvVar(...args),

  updateEnvVar: (id: string, input: Parameters<typeof atlashub.envVars.updateEnvVar>[1]) =>
    getSource().envVars.updateEnvVar(id, input),

  deleteEnvVar: (id: string) => getSource().envVars.deleteEnvVar(id),

  revealEnvVarValue: (id: string) => getSource().envVars.revealEnvVarValue(id),

  getEnvVarsForDisplay: (serviceId: string) => getSource().envVars.getEnvVarsForDisplay(serviceId),
};

// Re-export types that might be needed
export type { GeneralTodo, TodoStatus, CreateTodoInput, UpdateTodoInput } from "@/server/atlashub/general-todos";
