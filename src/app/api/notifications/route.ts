import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { auditLogs } from "@/server/atlashub";
import { getCurrentUser } from "@/server/lib/auth";

// Mock notifications for demo mode
const DEMO_NOTIFICATIONS = [
  {
    id: "demo-1",
    type: "deploy" as const,
    title: "Deployed Service",
    message: "AtlasHub API by demo@marczelloo.dev",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
    read: false,
    link: "/services/svc-demo-1",
  },
  {
    id: "demo-2",
    type: "info" as const,
    title: "Created Project",
    message: "Portfolio Website by demo@marczelloo.dev",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    read: false,
    link: "/projects/proj-demo-1",
  },
  {
    id: "demo-3",
    type: "alert" as const,
    title: "Service Restarted",
    message: "Redis Cache by demo@marczelloo.dev",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    read: true,
    link: "/services/svc-demo-3",
  },
];

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Return mock notifications in demo mode
    if (isDemoMode()) {
      return NextResponse.json({ notifications: DEMO_NOTIFICATIONS });
    }

    // Get recent audit logs and transform them into notifications
    const logs = await auditLogs.getAuditLogs({ limit: 20 });

    const notifications = logs.map((log) => ({
      id: log.id,
      type: getNotificationType(log.action),
      title: getNotificationTitle(log.action, log.entity_type),
      message: getNotificationMessage(log),
      timestamp: log.at,
      read: false, // For now, we don't track read status
      link: getNotificationLink(log),
    }));

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ notifications: [] });
  }
}

function getNotificationType(action: string): "deploy" | "alert" | "info" {
  if (action.includes("deploy") || action.includes("build")) return "deploy";
  if (action.includes("delete") || action.includes("fail")) return "alert";
  return "info";
}

function getNotificationTitle(action: string, entityType: string): string {
  const actionMap: Record<string, string> = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    deploy: "Deployed",
    restart: "Restarted",
    stop: "Stopped",
    start: "Started",
    reveal_secret: "Secret Revealed",
    login: "Logged In",
    pin_verify: "PIN Verified",
  };

  const entityMap: Record<string, string> = {
    project: "Project",
    service: "Service",
    work_item: "Work Item",
    env_var: "Environment Variable",
    deploy: "Deployment",
    container: "Container",
    auth: "Authentication",
  };

  return `${actionMap[action] || action} ${entityMap[entityType] || entityType}`;
}

function getNotificationMessage(log: {
  actor_email: string;
  entity_id?: string | null;
  meta_json?: Record<string, unknown> | null;
}): string {
  const meta = log.meta_json || {};
  const name = meta.name || meta.title || log.entity_id?.slice(0, 8) || "item";
  return `${name} by ${log.actor_email}`;
}

function getNotificationLink(log: {
  action: string;
  entity_type: string;
  entity_id?: string | null;
}): string | undefined {
  if (!log.entity_id) return undefined;

  switch (log.entity_type) {
    case "project":
      return `/projects/${log.entity_id}`;
    case "service":
      return `/services/${log.entity_id}`;
    case "work_item":
      return undefined; // Would need project_id
    default:
      return undefined;
  }
}
