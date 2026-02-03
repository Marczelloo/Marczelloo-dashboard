import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import { auditLogs } from "@/server/atlashub";
import type { AuditLog } from "@/types";

interface ActivityItem {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  type: "deploy" | "create" | "update" | "delete" | "restart" | "alert";
  link?: string;
  entityType: string;
  entityId?: string | null;
}

async function getRecentActivity(): Promise<ActivityItem[]> {
  const logs = await auditLogs.getAuditLogs({ limit: 10 });

  return logs.map((log: AuditLog) => ({
    id: log.id,
    action: log.action,
    actor: log.actor_email,
    target: log.entity_type + (log.entity_id ? ` ${log.entity_id.slice(0, 8)}` : ""),
    timestamp: log.at,
    type: mapActionToType(log.action),
    link: getLink(log.entity_type, log.entity_id),
    entityType: log.entity_type,
    entityId: log.entity_id,
  }));
}

function getLink(entityType: string, entityId?: string | null): string | undefined {
  if (!entityId) return undefined;

  switch (entityType) {
    case "project":
      return `/projects/${entityId}`;
    case "service":
      return `/services/${entityId}`;
    default:
      return undefined;
  }
}

function mapActionToType(action: string): ActivityItem["type"] {
  if (action.includes("deploy") || action.includes("pull") || action.includes("build")) return "deploy";
  if (action.includes("create") || action.includes("insert")) return "create";
  if (action.includes("update") || action.includes("edit")) return "update";
  if (action.includes("delete") || action.includes("remove")) return "delete";
  if (action.includes("restart") || action.includes("stop") || action.includes("start")) return "restart";
  if (action.includes("alert") || action.includes("notify")) return "alert";
  return "update";
}

const actionColors = {
  deploy: "success",
  create: "default",
  update: "secondary",
  delete: "destructive",
  restart: "warning",
  alert: "danger",
} as const;

export async function RecentActivity() {
  const activity = await getRecentActivity();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Activity</CardTitle>
        <span className="text-sm text-muted-foreground">Last 24 hours</span>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
        ) : (
          <div className="relative space-y-4">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

            {activity.map((item) => {
              const content = (
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.target}</span>
                    <Badge variant={actionColors[item.type]}>{item.action}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    by {item.actor} • {formatRelativeTime(item.timestamp)}
                  </p>
                </div>
              );

              return (
                <div key={item.id} className="relative flex gap-4 pl-6">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary" />

                  {item.link ? (
                    <Link
                      href={item.link}
                      className="flex-1 rounded-md -mx-2 px-2 py-1 hover:bg-secondary/50 transition-colors"
                    >
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
