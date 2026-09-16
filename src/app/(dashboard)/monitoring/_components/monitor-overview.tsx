import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { StatusDot } from "@/components/status-dot";
import { formatRelativeTime } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo-mode";
import { listRecentIncidents, listStates, type MonitorIncident, type StoredState } from "@/server/atlashub/monitor";
import { getProjects } from "@/server/atlashub/projects";
import { formatDuration } from "@/server/monitoring/state-machine";

const DOT = { ok: "online", warning: "warning", down: "offline", unknown: "unknown" } as const;
const STATUS_LABEL = { ok: "działa", warning: "ostrzeżenie", down: "awaria", unknown: "nie sprawdzono" } as const;

function gb(bytes: unknown): string {
  return typeof bytes === "number" ? `${(bytes / 1_000_000_000).toFixed(1)} GB` : "—";
}

function StateRow({ state, extra }: { state: StoredState; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot status={DOT[state.status]} pulse={state.status === "down"} />
        <span className="truncate font-medium">{state.label}</span>
        {state.lastError && state.status !== "ok" && <span className="truncate text-xs text-muted-foreground">{state.lastError}</span>}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {extra}
        <span>{STATUS_LABEL[state.status]} od {formatRelativeTime(state.since)}</span>
      </div>
    </div>
  );
}

/** Stage 6 monitoring state; layout is temporary until the dashboard redesign. */
export async function MonitorOverview() {
  if (isDemoMode()) return null;

  let states: StoredState[] = [];
  let incidents: MonitorIncident[] = [];
  let projectNames = new Map<string, string>();
  try {
    const [loadedStates, loadedIncidents, projects] = await Promise.all([listStates(), listRecentIncidents(20), getProjects({ limit: 1000 })]);
    states = loadedStates;
    incidents = loadedIncidents;
    projectNames = new Map(projects.map((project) => [project.id, project.name]));
  } catch (error) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">Nie udało się wczytać stanu monitoringu: {error instanceof Error ? error.message : "błąd"}</CardContent>
      </Card>
    );
  }

  const byKey = new Map(states.map((state) => [state.key, state]));
  const platform = states.filter((state) => state.kind === "agent" || state.kind === "disk");
  const groups = new Map<string, StoredState[]>();
  for (const state of states) {
    if (state.kind !== "containers" && state.kind !== "domain") continue;
    const group = state.projectId ? projectNames.get(state.projectId) ?? "Nieznany projekt" : "Bez projektu";
    groups.set(group, [...(groups.get(group) ?? []), state]);
  }
  const problems = states.filter((state) => state.status === "down" || state.status === "warning").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Sprawdzane cele</p><p className="text-2xl font-bold">{states.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Problemy teraz</p><p className={`text-2xl font-bold ${problems ? "text-danger" : "text-success"}`}>{problems}</p></CardContent></Card>
        {platform.map((state) => (
          <Card key={state.key}>
            <CardContent className="p-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><StatusDot status={DOT[state.status]} />{state.label}</p>
              <p className="text-2xl font-bold">
                {state.kind === "disk" ? `${state.detail.freePercent ?? "—"}% wolne` : STATUS_LABEL[state.status]}
              </p>
              {state.kind === "disk" && <p className="text-xs text-muted-foreground">{gb(state.detail.freeBytes)} wolne · cache buildów {gb(state.detail.buildCacheBytes)}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {groups.size === 0 ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Monitoring jeszcze nie wykonał pierwszego cyklu.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Projekty</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, items]) => (
              <div key={name} className="space-y-2">
                <p className="text-sm font-semibold">{name}</p>
                {items.sort((a, b) => a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label)).map((state) => {
                  if (state.kind === "containers") {
                    const containers = (state.detail.containers as Array<{ name: string; status: string; restartCount: number }> | undefined) ?? [];
                    return <StateRow key={state.key} state={state} extra={<span>{containers.map((container) => `${container.name}: ${container.status}${container.restartCount ? `, ${container.restartCount} restartów` : ""}`).join(" · ") || "brak kontenerów"}</span>} />;
                  }
                  const tls = byKey.get(`tls:${state.label}`);
                  const days = tls?.detail.daysLeft;
                  return (
                    <StateRow
                      key={state.key}
                      state={state}
                      extra={
                        <>
                          {typeof state.detail.latencyMs === "number" && <span>{state.detail.latencyMs} ms</span>}
                          {typeof days === "number" && <Badge variant={tls?.status === "ok" ? "secondary" : tls?.status === "warning" ? "warning" : "danger"}>SSL {days} dni</Badge>}
                        </>
                      }
                    />
                  );
                })}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Ostatnie incydenty</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {incidents.length === 0 && <p className="text-sm text-muted-foreground">Brak incydentów.</p>}
          {incidents.map((incident) => (
            <div key={incident.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant={incident.severity === "down" ? "danger" : "warning"}>{incident.severity === "down" ? "awaria" : "ostrzeżenie"}</Badge>
                <span className="font-medium">{incident.label}</span>
                {incident.reason && <span className="truncate text-xs text-muted-foreground">{incident.reason}</span>}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(incident.started_at)} · {incident.open ? "trwa" : `trwał ${formatDuration(incident.started_at, incident.ended_at ?? incident.started_at)}`}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
