import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { auditLogs } from "@/server/atlashub";
import { getCurrentUser } from "@/server/lib/auth";
import { getSetting } from "@/server/atlashub/settings";

const READ_NOTIFICATIONS_KEY = "notifications_last_read_at";

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
  // This one is older than 7 days and should be filtered out
  {
    id: "demo-old",
    type: "info" as const,
    title: "Old Notification",
    message: "This should be filtered out (10 days old)",
    timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    read: true,
    link: undefined,
  },
].filter((n) => Date.now() - new Date(n.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000);

// Filter out notifications older than 7 days for quick dropdown
const QUICK_NOTIFICATIONS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

    // Get the last read timestamp
    let lastReadAt: Date | null = null;
    try {
      const lastReadValue = await getSetting(READ_NOTIFICATIONS_KEY);
      if (lastReadValue) {
        lastReadAt = new Date(lastReadValue);
      }
    } catch {
      // Ignore errors fetching last read time
    }

    // Get recent audit logs and transform them into notifications
    const logs = await auditLogs.getAuditLogs({ limit: 50 });

    // Filter out old notifications and map to notification format
    const now = Date.now();
    const notifications = logs
      .filter((log) => {
        const logTime = new Date(log.at).getTime();
        return now - logTime < QUICK_NOTIFICATIONS_MAX_AGE_MS;
      })
      .map((log) => {
        const logTime = new Date(log.at);
        // A notification is read if it was created before the last read time
        const read = lastReadAt ? logTime <= lastReadAt : false;

        return {
          id: log.id,
          type: getNotificationType(log.action),
          title: getNotificationTitle(log.action, log.entity_type),
          message: getNotificationMessage(log),
          timestamp: log.at,
          read,
          link: getNotificationLink(log),
        };
      });

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
