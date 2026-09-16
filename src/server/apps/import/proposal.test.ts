import { describe, expect, it } from "vitest";
import type { Project, Service } from "@/types";
import type { ContainerFact, InventorySnapshot } from "../types";
import { buildImportProposal, toProposalView } from "./proposal";

function fact(overrides: Partial<ContainerFact>): ContainerFact {
  return { id: "id", name: "n", image: "marczelloo-tools-app", imageId: "img", status: "running", createdAt: "", composeProject: "marczelloo-tools", composeService: "app", oneOff: false, workingDir: "/home/Marczelloo_pi/projects/marczelloo-tools", configFiles: ["/home/Marczelloo_pi/projects/marczelloo-tools/docker-compose.yml", "/home/Marczelloo_pi/projects/.dashboard/deploy-logs/compose-overrides/marczelloo-tools.yaml"], env: {}, labels: {}, ports: [], mounts: [], networks: [], ...overrides };
}

const snapshot: InventorySnapshot = {
  capturedAt: "2026-09-16T10:00:00.000Z",
  imageEnv: { img: { PORT: "3000" } },
  looseContainers: [],
  ingress: { error: null, rules: [{ position: 0, hostname: "tools.marczelloo.dev", path: null, service: "http://127.0.0.1:3202", originRequest: null }, { position: 1, hostname: null, path: null, service: "http_status:404", originRequest: null }] },
  stacks: [
    {
      project: "marczelloo-tools",
      workingDir: "/home/Marczelloo_pi/projects/marczelloo-tools",
      configFiles: ["/home/Marczelloo_pi/projects/marczelloo-tools/docker-compose.yml", "/home/Marczelloo_pi/projects/.dashboard/deploy-logs/compose-overrides/marczelloo-tools.yaml"],
      containers: [fact({ name: "marczelloo-tools", env: { PORT: "3000", TOKEN: "t0p" }, ports: [{ hostIp: "127.0.0.1", hostPort: 3202, containerPort: 3000, protocol: "tcp" }] })],
      composeConfig: { name: "marczelloo-tools", services: { app: { build: {}, environment: { PORT: "3000", TOKEN: "t0p" }, ports: [{ host_ip: "127.0.0.1", published: "3202", target: 3000, protocol: "tcp" }] } } },
      composeConfigError: null,
      envFiles: [{ path: "/home/Marczelloo_pi/projects/marczelloo-tools/.env", content: null }],
      otherEnvFiles: [".env.docker.example"],
      git: { head: "ae8235d", remote: "git@github.com:Marczelloo/Marczelloo-Tools.git" },
    },
  ],
};

const projects = [
  { id: "tools", name: "Marczelloo-Tools", slug: "marczelloo-tools", github_url: "https://github.com/Marczelloo/Marczelloo-Tools" },
  { id: "arcade", name: "Arcade Portfolio", slug: "arcade-portfolio", github_url: null },
] as Project[];

describe("buildImportProposal", () => {
  it("matches the stack, plans env, dry-runs and maps routes", () => {
    const proposal = buildImportProposal({ snapshot, projects, services: [] as Service[], legacyEnv: [], deploymentConfigs: [{ projectId: "tools", composeProject: "marczelloo-tools" }] }, "proposal-1");
    const [stack] = proposal.stacks;
    expect(stack.match).toMatchObject({ projectId: "tools", confidence: "high" });
    expect(stack.env.map((entry) => entry.key)).toEqual(["TOKEN"]);
    expect(stack.dryRun?.ok).toBe(true);
    expect(stack.warnings).toEqual([
      "Pominięte pliki env w katalogu: .env.docker.example.",
      "Stack używa pliku override z katalogu logów dashboardu — przy przełączeniu trafi do konfiguracji.",
    ]);
    expect(proposal.routes[0]).toMatchObject({ projectId: "tools", target: { kind: "container", containerName: "marczelloo-tools" } });
    expect(proposal.routes[1]).toMatchObject({ projectId: null, target: { kind: "status" } });
    expect(proposal.hostnameCount).toBe(1);
    expect(proposal.projectsWithoutStack).toEqual([{ id: "arcade", name: "Arcade Portfolio" }]);
  });

  it("summarises long lists of skipped env files", () => {
    const many = { ...snapshot, stacks: [{ ...snapshot.stacks[0], otherEnvFiles: Array.from({ length: 8 }, (_, index) => `.env.backup-${index}`) }] };
    const [stack] = buildImportProposal({ snapshot: many, projects, services: [] as Service[], legacyEnv: [], deploymentConfigs: [] }, "proposal-1").stacks;
    expect(stack.warnings[0]).toBe("Pominięte pliki env w katalogu (8): .env.backup-0, .env.backup-1, .env.backup-2, .env.backup-3, .env.backup-4 i 3 innych.");
  });

  it("produces a client view without env values", () => {
    const proposal = buildImportProposal({ snapshot, projects, services: [] as Service[], legacyEnv: [], deploymentConfigs: [] }, "proposal-1");
    const view = toProposalView(proposal, projects);
    expect(JSON.stringify(view)).not.toContain("t0p");
    expect(view.stacks[0].env[0]).toEqual({ key: "TOKEN", origin: "compose", sourcePath: null, services: ["app"], secret: true, include: true, conflicts: [] });
    expect(view.projects).toEqual([{ id: "tools", name: "Marczelloo-Tools" }, { id: "arcade", name: "Arcade Portfolio" }]);
  });
});
