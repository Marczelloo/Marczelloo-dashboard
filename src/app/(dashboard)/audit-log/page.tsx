import { Suspense } from "react";

export const dynamic = "force-dynamic";
import { Header } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Button } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { History, RefreshCw, AlertTriangle } from "lucide-react";
import { revalidatePath } from "next/cache";
import * as auditLogs from "@/server/atlashub/audit-logs";
import type { AuditLog, AuditAction } from "@/types";
import Link from "next/link";

async function refreshAuditLog() {
  "use server";
  revalidatePath("/audit-log");
}

export default function AuditLogPage() {
  return (
    <>
      <Header title="Audit Log" description="Activity history and security events">
        <form action={refreshAuditLog}>
          <Button variant="outline" size="sm" type="submit">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </form>
      </Header>

      <div className="p-6">
        <Suspense fallback={<AuditLogSkeleton />}>
          <AuditLogList />
        </Suspense>
      </div>
    </>
  );
}

async function AuditLogList() {
  let logs: AuditLog[] = [];
  let error: string | null = null;

  try {
    logs = await auditLogs.getRecentAuditLogs(100);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch audit logs";
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-danger" />
          <p className="text-danger font-medium mb-2">Failed to load audit logs</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No audit logs yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Actions like creating projects, deploying services, and viewing secrets will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const actionColors: Record<AuditAction, "default" | "success" | "warning" | "danger" | "secondary"> = {
    create: "success",
    update: "secondary",
    delete: "danger",
    deploy: "success",
    restart: "warning",
    stop: "danger",
    start: "success",
    reveal_secret: "warning",
    login: "secondary",
    pin_verify: "secondary",
    docker_exec: "warning",
    docker_exec_blocked: "danger",
    clear_deploys: "secondary",
  };

  const entityLinks: Record<string, (id: string) => string> = {
    project: (_id) => `/projects/${_id}`,
    service: (_id) => `/services/${_id}`,
    work_item: (_id) => `#`, // Work items are nested under projects
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map((log) => {
            const linkFn = entityLinks[log.entity_type];
            const entityLink = log.entity_id && linkFn ? linkFn(log.entity_id) : null;

            return (
              <div key={log.id} className="flex items-start justify-between rounded-lg border border-border p-4">
                <div className="flex items-start gap-4">
                  <Badge variant={actionColors[log.action] || "default"}>{log.action}</Badge>
                  <div>
                    <div className="font-medium">
                      {formatEntityType(log.entity_type)}
                      {log.entity_id &&
                        (entityLink && entityLink !== "#" ? (
                          <Link href={entityLink} className="ml-2 font-mono text-xs text-primary hover:underline">
                            {log.entity_id.slice(0, 8)}...
                          </Link>
                        ) : (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {log.entity_id.slice(0, 8)}...
                          </span>
                        ))}
                    </div>
                    <p className="text-sm text-muted-foreground">by {log.actor_email}</p>
                    {log.meta_json && Object.keys(log.meta_json).length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground font-mono bg-secondary/50 rounded p-2 max-w-lg overflow-x-auto">
                        {formatMeta(log.meta_json)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                  {formatDateTime(log.at)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function formatEntityType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatMeta(meta: Record<string, unknown>): string {
  const entries = Object.entries(meta)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return entries.join(" | ");
}

function AuditLogSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
