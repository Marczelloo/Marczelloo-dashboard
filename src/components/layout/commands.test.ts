import { describe, expect, it } from "vitest";
import { buildCommands, filterCommands } from "./commands";

const projects = [
  { id: "p1", name: "Drive", slug: "drive" },
  { id: "p2", name: "AtlasHub", slug: "atlas-hub" },
];

describe("buildCommands", () => {
  it("lists pages, projects and per-project actions", () => {
    const commands = buildCommands(projects);
    expect(commands.find((command) => command.id === "page:/")).toMatchObject({ kind: "page", label: "Overview", href: "/" });
    expect(commands.find((command) => command.id === "project:p1")).toMatchObject({ kind: "project", href: "/projects/p1" });
    expect(commands.find((command) => command.id === "deploy:p1")).toMatchObject({ kind: "action", label: "Deploy Drive", deployProjectId: "p1" });
    expect(commands.find((command) => command.id === "logs:p2")).toMatchObject({ href: "/projects/p2?tab=deployments" });
    expect(commands.find((command) => command.id === "rollback:p2")).toMatchObject({ label: "Roll back AtlasHub", href: "/projects/p2?tab=deployments" });
  });
});

describe("filterCommands", () => {
  const commands = buildCommands(projects);

  it("shows pages and projects, not actions, for an empty query", () => {
    const result = filterCommands(commands, "  ");
    expect(result.some((command) => command.kind === "action")).toBe(false);
    expect(result[0].label).toBe("Overview");
  });

  it("ranks prefix matches first, then word prefixes, then substrings", () => {
    const result = filterCommands(commands, "dri");
    expect(result[0]).toMatchObject({ id: "project:p1" });
    expect(result.map((command) => command.id)).toContain("deploy:p1");
  });

  it("matches slugs and is case-insensitive", () => {
    expect(filterCommands(commands, "ATLAS-HUB").map((command) => command.id)).toContain("project:p2");
  });

  it("respects the limit and drops non-matches", () => {
    expect(filterCommands(commands, "zzz")).toEqual([]);
    expect(filterCommands(commands, "a", 2)).toHaveLength(2);
  });
});
