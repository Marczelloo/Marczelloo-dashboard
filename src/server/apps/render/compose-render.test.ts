import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { ComposeConfig, ContainerFact } from "../types";
import { dryRunAgainstContainers, renderImportedCompose, toComposeYaml } from "./compose-render";

const config: ComposeConfig = {
  name: "marczelloo-drive",
  services: {
    drive: {
      build: { context: "/p/drive" },
      container_name: "marczelloo-drive",
      environment: { PORT: "3000", SECRET_KEY: "s" },
      ports: [{ mode: "ingress", host_ip: "127.0.0.1", target: 3000, published: "3030", protocol: "tcp" } as never],
    },
    compressor: {
      build: { context: "/p/drive" },
      environment: { PORT: "3000" },
      volumes: [{ type: "volume", source: "compression-tmp", target: "/var/lib/c" }],
      logging: { driver: "local" },
    },
  },
  volumes: { "compression-tmp": { name: "marczelloo-drive_compression-tmp" }, cache: null },
};

function container(overrides: Partial<ContainerFact>): ContainerFact {
  return { id: "x", name: "x", image: "", imageId: "img", status: "running", createdAt: "", composeProject: "marczelloo-drive", composeService: null, oneOff: false, workingDir: null, configFiles: [], env: {}, labels: {}, ports: [], mounts: [], networks: [], ...overrides };
}

describe("renderImportedCompose", () => {
  it("pins the project and volume names, adds labels and default logging", () => {
    const rendered = renderImportedCompose(config, { project: "marczelloo-drive", projectId: "p-1" });
    expect(rendered.name).toBe("marczelloo-drive");
    expect(rendered.volumes).toEqual({ "compression-tmp": { name: "marczelloo-drive_compression-tmp" }, cache: { name: "marczelloo-drive_cache" } });
    expect(rendered.services.drive.labels).toEqual({ "dev.marczelloo.project-id": "p-1", "dev.marczelloo.managed": "imported" });
    expect(rendered.services.drive.logging).toEqual({ driver: "json-file", options: { "max-size": "10m", "max-file": "3" } });
    expect(rendered.services.compressor.logging).toEqual({ driver: "local" });
    expect(rendered.services.drive.container_name).toBe("marczelloo-drive");
    expect(parse(toComposeYaml(rendered)).services.drive.ports[0].published).toBe("3030");
  });
});

describe("dryRunAgainstContainers", () => {
  const rendered = renderImportedCompose(config, { project: "marczelloo-drive", projectId: "p-1" });

  it("passes when images, volumes, ports and env match", () => {
    const report = dryRunAgainstContainers(
      rendered,
      [
        container({ name: "marczelloo-drive", composeService: "drive", image: "marczelloo-drive-drive", env: { PORT: "3000", SECRET_KEY: "s", PATH: "/bin" }, ports: [{ hostIp: "127.0.0.1", hostPort: 3030, containerPort: 3000, protocol: "tcp" }] }),
        container({
          name: "marczelloo-drive-compressor",
          composeService: "compressor",
          image: "marczelloo-drive-compressor",
          env: { PORT: "3000" },
          mounts: [
            { type: "volume", name: "marczelloo-drive_compression-tmp", source: "/v", destination: "/var/lib/c", readOnly: false },
            { type: "volume", name: "f".repeat(64), source: "/anon", destination: "/data", readOnly: false },
          ],
        }),
      ],
      { img: { PATH: "/bin" } }
    );
    expect(report.ok).toBe(true);
    expect(report.checks).toHaveLength(8);
  });

  it("reports missing services, changed values and volume drift without exposing values", () => {
    const report = dryRunAgainstContainers(
      rendered,
      [
        container({ name: "marczelloo-drive", composeService: "drive", image: "marczelloo-drive-drive", env: { PORT: "3000", SECRET_KEY: "old" }, ports: [{ hostIp: "0.0.0.0", hostPort: 3030, containerPort: 3000, protocol: "tcp" }] }),
        container({ name: "stray", composeService: "worker", image: "w" }),
        container({ name: "marczelloo-drive-compressor", composeService: "compressor", image: "marczelloo-drive-compressor", env: { PORT: "3000" }, mounts: [{ type: "volume", name: "other", source: "/v", destination: "/var/lib/c", readOnly: false }] }),
      ],
      {}
    );
    expect(report.ok).toBe(false);
    const failed = report.checks.filter((check) => !check.ok).map((check) => `${check.service}:${check.check}`);
    expect(failed).toEqual(["marczelloo-drive:ports", "marczelloo-drive:env", "stray:service", "marczelloo-drive-compressor:volumes"]);
    expect(JSON.stringify(report)).not.toContain("old");
  });
});
