import { describe, expect, it } from "vitest";
import { mergeActivity } from "./activity";

const projects = [{ id: "p1", name: "Drive" }] as never[];
const services = [{ id: "s1", project_id: "p1", name: "web" }] as never[];

describe("mergeActivity", () => {
  it("merges deploys, incidents and notable audit entries newest first", () => {
    const items = mergeActivity({
      projects,
      services,
      deploys: [
        { id: "d1", service_id: "s1", started_at: "2026-09-17T12:00:00.000Z", finished_at: null, status: "running", commit_sha: "7e1f0aa1234", logs_object_key: null, triggered_by: "github-webhook", error_message: null },
        { id: "d2", service_id: "s1", started_at: "2026-09-17T09:00:00.000Z", finished_at: "x", status: "failed", commit_sha: "4c5d6e7890", logs_object_key: null, triggered_by: "me", error_message: "Health check failed" },
      ],
      incidents: [
        { id: "i1", target_key: "domain:drive", kind: "domain", label: "drive.marczelloo.dev", project_id: "p1", severity: "down", reason: "502", open: false, started_at: "2026-09-17T10:00:00.000Z", ended_at: "2026-09-17T10:20:00.000Z" },
      ],
      audit: [
        { id: "a1", at: "2026-09-17T11:00:00.000Z", actor_email: "me", action: "restart", entity_type: "service", entity_id: "s1", meta_json: { name: "web" } },
        { id: "a2", at: "2026-09-17T11:30:00.000Z", actor_email: "me", action: "login", entity_type: "project", entity_id: null, meta_json: null },
        { id: "a3", at: "2026-09-17T11:40:00.000Z", actor_email: "me", action: "deploy", entity_type: "project", entity_id: "p1", meta_json: null },
      ],
    } as never);

    expect(items.map((entry) => [entry.id, entry.tone, entry.title])).toEqual([
      ["deploy:d1", "live", "Deploying · Drive"],
      ["audit:a1", "idle", "Restart · web"],
      ["incident:i1:end", "ok", "drive.marczelloo.dev recovered"],
      ["incident:i1", "err", "drive.marczelloo.dev down"],
      ["deploy:d2", "err", "Deploy failed · Drive"],
    ]);
    expect(items[0]).toMatchObject({ detail: "7e1f0aa", href: "/projects/p1?tab=deployments" });
    expect(items.at(-1)?.detail).toBe("4c5d6e7 · Health check failed");
  });

  it("limits the list", () => {
    const deploys = Array.from({ length: 12 }, (_, index) => ({ id: `d${index}`, service_id: "s1", started_at: `2026-09-17T0${index % 10}:00:00.000Z`, finished_at: "x", status: "success", commit_sha: null, logs_object_key: null, triggered_by: "me", error_message: null }));
    expect(mergeActivity({ projects, services, deploys, incidents: [], audit: [] } as never, 8)).toHaveLength(8);
  });
});
