import type { MonitorIncident } from "@/server/atlashub/monitor";
import type { HourBucket } from "./types";

const HOUR_MS = 60 * 60 * 1000;

type IncidentSpan = Pick<MonitorIncident, "project_id" | "severity" | "started_at" | "ended_at">;

/** Hour buckets (oldest first) coloured by the project's incidents; derived from incidents, not raw checks. */
export function hourlyUptime(incidents: IncidentSpan[], projectId: string, monitored: boolean, now: Date, hours = 24): HourBucket[] {
  const currentHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const own = incidents.filter((incident) => incident.project_id === projectId);
  return Array.from({ length: hours }, (_, index) => {
    const start = currentHour - (hours - 1 - index) * HOUR_MS;
    const end = start + HOUR_MS;
    if (!monitored) return { start: new Date(start).toISOString(), state: "none" };
    let state: HourBucket["state"] = "ok";
    for (const incident of own) {
      const from = Date.parse(incident.started_at);
      const to = incident.ended_at ? Date.parse(incident.ended_at) : now.getTime();
      if (from < end && to >= start) {
        if (incident.severity === "down") {
          state = "down";
          break;
        }
        state = "warn";
      }
    }
    return { start: new Date(start).toISOString(), state };
  });
}
