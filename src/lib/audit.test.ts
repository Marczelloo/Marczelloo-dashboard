import { describe, expect, it } from "vitest";
import { categoryOf, detailsOf, toCsv, toneOf, verbOf, type AuditRow } from "./audit";

describe("categoryOf", () => {
  it("files events where someone would look for them", () => {
    expect(categoryOf("deploy", "project")).toBe("deploys");
    expect(categoryOf("github_webhook_trigger", "project")).toBe("deploys");
    expect(categoryOf("update", "env_var")).toBe("secrets");
    expect(categoryOf("reveal_secret", "env_var")).toBe("secrets");
    expect(categoryOf("docker_exec", "container")).toBe("containers");
    expect(categoryOf("pin_verify", "auth")).toBe("access");
    expect(categoryOf("create", "release")).toBe("github");
    expect(categoryOf("update", "project")).toBe("changes");
  });
});

describe("verbOf and toneOf", () => {
  it("reads as a sentence and flags what went wrong", () => {
    expect(verbOf("update", "work_item", null)).toBe("Updated task");
    expect(verbOf("pin_verify", "auth", { success: false })).toBe("Entered a wrong PIN");
    expect(toneOf("pin_verify", { success: false })).toBe("err");
    expect(toneOf("deploy", { status: "failed" })).toBe("err");
    expect(toneOf("reveal_secret", null)).toBe("warn");
    expect(toneOf("update", null)).toBe("neutral");
  });
});

describe("detailsOf", () => {
  it("hides secret-looking keys and drops empty values", () => {
    expect(detailsOf({ key: "DATABASE_URL", value: "postgres://x", api_token: "t", note: "", fields: ["a", "b"] })).toEqual([
      { key: "key", value: "DATABASE_URL" },
      { key: "value", value: "hidden" },
      { key: "api token", value: "hidden" },
      { key: "fields", value: "a, b" },
    ]);
  });

  it("cuts long values", () => {
    const [detail] = detailsOf({ message: "x".repeat(400) });
    expect(detail.value.length).toBe(160);
  });
});

describe("toCsv", () => {
  it("quotes cells that need it", () => {
    const row: AuditRow = {
      id: "1",
      at: "2026-09-22T10:00:00.000Z",
      actor: "a@b.c",
      action: "docker_exec",
      entityType: "container",
      category: "containers",
      tone: "warn",
      verb: "Ran in the console",
      subject: 'docker ps --format "{{.Names}}"',
      href: null,
      projectId: null,
      details: [],
    };
    expect(toCsv([row]).split("\n")[1]).toBe('2026-09-22T10:00:00.000Z,a@b.c,containers,Ran in the console,"docker ps --format ""{{.Names}}""",');
  });
});
