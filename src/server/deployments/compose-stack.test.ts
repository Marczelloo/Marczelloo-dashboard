import { describe, expect, it } from "vitest";
import { buildComposeRecreateCommand, stackFromContainers } from "./compose-stack";

const labels = (service: string, extra: Record<string, string> = {}) => ({
  "com.docker.compose.project": "marczelloo-tools",
  "com.docker.compose.service": service,
  "com.docker.compose.project.working_dir": "/home/Marczelloo_pi/projects/marczelloo-tools",
  "com.docker.compose.project.config_files":
    "/home/Marczelloo_pi/projects/marczelloo-tools/docker-compose.yml,/home/Marczelloo_pi/projects/.dashboard/deploy-logs/compose-overrides/marczelloo-tools.yaml",
  ...extra,
});

describe("stackFromContainers", () => {
  it("reads working dir, all config files and running services", () => {
    const stack = stackFromContainers("marczelloo-tools", [
      { labels: labels("app"), status: "running" },
      { labels: labels("bootstrap"), status: "exited" },
      { labels: labels("app", { "com.docker.compose.oneoff": "True" }), status: "running" },
    ]);
    expect(stack).toEqual({
      project: "marczelloo-tools",
      workingDir: "/home/Marczelloo_pi/projects/marczelloo-tools",
      configFiles: [
        "/home/Marczelloo_pi/projects/marczelloo-tools/docker-compose.yml",
        "/home/Marczelloo_pi/projects/.dashboard/deploy-logs/compose-overrides/marczelloo-tools.yaml",
      ],
      services: ["app"],
    });
  });

  it("refuses containers from inconsistent compose invocations", () => {
    expect(() =>
      stackFromContainers("marczelloo-tools", [
        { labels: labels("app"), status: "running" },
        { labels: labels("worker", { "com.docker.compose.project.working_dir": "/tmp/x" }), status: "running" },
      ])
    ).toThrow(/różnych/);
  });

  it("limits a mixed project to the target container's invocation", () => {
    const base = "/home/Marczelloo_pi/projects/atlas-hub/docker-compose.yml";
    const atlas = (service: string, files: string) => ({
      "com.docker.compose.project": "atlas-hub",
      "com.docker.compose.service": service,
      "com.docker.compose.project.working_dir": "/home/Marczelloo_pi/projects/atlas-hub",
      "com.docker.compose.project.config_files": files,
    });
    const containers = [
      { name: "/atlashub-gateway", labels: atlas("gateway", base), status: "running" },
      { name: "/atlashub-dashboard", labels: atlas("dashboard", base), status: "running" },
      { name: "/atlashub-postgres", labels: atlas("postgres", `${base},/home/Marczelloo_pi/projects/atlas-hub/docker-compose.override.yml`), status: "running" },
    ];

    expect(stackFromContainers("atlas-hub", containers, "atlashub-gateway")).toMatchObject({ configFiles: [base], services: ["gateway", "dashboard"] });
    expect(() => stackFromContainers("atlas-hub", containers)).toThrow(/różnych/);
    expect(() => stackFromContainers("atlas-hub", containers, "missing")).toThrow(/różnych/);
  });

  it("refuses a stack without running services", () => {
    expect(() => stackFromContainers("marczelloo-tools", [{ labels: labels("app"), status: "exited" }])).toThrow(/działających/);
  });
});

describe("buildComposeRecreateCommand", () => {
  it("recreates only named services without building", () => {
    expect(
      buildComposeRecreateCommand({
        project: "atlas-hub",
        workingDir: "/home/Marczelloo_pi/projects/atlas-hub",
        configFiles: ["/home/Marczelloo_pi/projects/atlas-hub/docker-compose.yml"],
        services: ["gateway", "dashboard"],
      })
    ).toBe(
      "docker compose -p 'atlas-hub' --project-directory '/home/Marczelloo_pi/projects/atlas-hub' -f '/home/Marczelloo_pi/projects/atlas-hub/docker-compose.yml' up -d --no-build --no-deps 'gateway' 'dashboard'"
    );
  });

  it("rejects unsafe identifiers and paths", () => {
    const base = { project: "x", workingDir: "/home/a", configFiles: ["/home/a/c.yml"], services: ["s"] };
    expect(() => buildComposeRecreateCommand({ ...base, project: "x;rm" })).toThrow();
    expect(() => buildComposeRecreateCommand({ ...base, workingDir: "relative" })).toThrow();
    expect(() => buildComposeRecreateCommand({ ...base, configFiles: ["/home/../etc/c.yml"] })).toThrow();
    expect(() => buildComposeRecreateCommand({ ...base, services: ["s s"] })).toThrow();
  });
});
