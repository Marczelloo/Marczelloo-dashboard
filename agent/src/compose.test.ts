import { describe, expect, it } from "vitest";
import { buildOverride, composeArgs, edgeAttachment, imageRepository, loopbackPortOverride, renderOverride, resolveComposeFile } from "./compose";
import type { DeployTarget } from "./types";

const target: DeployTarget = {
  projectId: "11111111-1111-4111-8111-111111111111",
  composeProject: "marczelloo-tools",
  repoPath: "/p/tools",
  githubUrl: "https://github.com/Marczelloo/Marczelloo-Tools",
  branch: "main",
  composeFile: null,
  profiles: ["default"],
  tunnel: { hostname: "tools.marczelloo.dev", localPort: 3202, probe: true },
};
const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("resolveComposeFile", () => {
  it("uses the configured file or the first Compose candidate", () => {
    expect(resolveComposeFile({ ...target, composeFile: "deploy/compose.yml" }, () => true)).toBe("/p/tools/deploy/compose.yml");
    expect(resolveComposeFile(target, (file) => file === "/p/tools/docker-compose.yml")).toBe("/p/tools/docker-compose.yml");
    expect(() => resolveComposeFile(target, () => false)).toThrow(/Compose/);
  });
});

describe("composeArgs", () => {
  it("uses the directory of the first Compose file as the project directory", () => {
    expect(composeArgs({ ...target, profiles: [] }, ["/p/tools/deploy/compose.yml"]).slice(0, 5)).toEqual(["compose", "-p", "marczelloo-tools", "--project-directory", "/p/tools/deploy"]);
  });

  it("resolves a generated file against the repository", () => {
    expect(composeArgs({ ...target, profiles: [], generatedCompose: "services: {}" }, ["/data/overrides/marczelloo-tools.generated.yml"]).slice(3, 5)).toEqual(["--project-directory", "/p/tools"]);
  });

  it("pins the project, directory, files and profiles", () => {
    expect(composeArgs(target, ["/p/tools/docker-compose.yml", "/o/tools.yml"])).toEqual([
      "compose", "-p", "marczelloo-tools", "--project-directory", "/p/tools",
      "-f", "/p/tools/docker-compose.yml", "-f", "/o/tools.yml", "--profile", "default",
    ]);
  });
});

describe("imageRepository", () => {
  it("derives the repository without tag or digest", () => {
    expect(imageRepository("marczelloo-tools", "app")).toBe("marczelloo-tools-app");
    expect(imageRepository("p", "s", "atlashub/gateway:latest")).toBe("atlashub/gateway");
    expect(imageRepository("p", "s", "localhost:5000/app@sha256:abc")).toBe("localhost:5000/app");
  });
});

describe("loopbackPortOverride", () => {
  const config = { services: { app: { build: {}, ports: [{ published: "3202", target: 3000, protocol: "tcp", host_ip: "0.0.0.0" }] }, db: { image: "postgres" } } };

  it("binds the only published port to loopback", () => {
    expect(loopbackPortOverride(config, 3202)).toEqual({ service: "app", mapping: "127.0.0.1:3202:3000/tcp" });
  });

  it("returns null when the port is already bound to loopback", () => {
    const bound = { services: { app: { ports: [{ published: "3202", target: 3000, host_ip: "127.0.0.1" }] } } };
    expect(loopbackPortOverride(bound, 3202)).toBeNull();
  });

  it("rejects ambiguous port layouts", () => {
    const ambiguous = { services: { a: { ports: [{ published: "1", target: 1 }] }, b: { ports: [{ published: "2", target: 2 }] } } };
    expect(() => loopbackPortOverride(ambiguous, 3202)).toThrow(/port/);
  });
});

describe("renderOverride and buildOverride", () => {
  it("renders images and a replaced port list", () => {
    expect(renderOverride({ app: "marczelloo-tools-app:0123456789ab" }, { service: "app", mapping: "127.0.0.1:3202:3000/tcp" })).toBe(
      'services:\n  "app":\n    image: "marczelloo-tools-app:0123456789ab"\n    ports: !override\n      - "127.0.0.1:3202:3000/tcp"\n'
    );
    expect(renderOverride({}, null)).toBe("services: {}\n");
  });

  it("attaches edge services to the shared network and keeps their own networks", () => {
    const config = { services: { app: { build: { context: "." }, networks: { default: null, backend: null } }, db: { image: "postgres:16" } } };
    const result = buildOverride(config, { project: "p", sha: SHA, tunnelPort: null, edge: { network: "mz-edge", services: ["app"] } });
    expect(result.yaml).toBe(
      'services:\n  "app":\n    image: "p-app:0123456789ab"\n    networks:\n      "default": {}\n      "backend": {}\n      "mz-edge": {}\nnetworks:\n  "mz-edge":\n    external: true\n    name: "mz-edge"\n'
    );
  });

  it("drops host ports of edge services instead of publishing the tunnel port", () => {
    const config = { services: { app: { build: { context: "." }, ports: [{ published: "3202", target: 3000, host_ip: "127.0.0.1" }] }, db: { image: "postgres", ports: [{ published: "5432", target: 5432 }] } } };
    const result = buildOverride(config, { project: "p", sha: SHA, tunnelPort: 3202, edge: { network: "mz-edge", services: [], dropPorts: true } });
    expect(result.yaml).toBe(
      'services:\n  "app":\n    image: "p-app:0123456789ab"\n    ports: !reset []\n    networks:\n      "default": {}\n      "mz-edge": {}\nnetworks:\n  "mz-edge":\n    external: true\n    name: "mz-edge"\n'
    );
  });

  it("finds the tunnel service by container port or an explicit name", () => {
    const config = { services: { web: { ports: [{ target: 3000 }] }, api: { ports: [{ target: 4000 }] } } };
    expect(edgeAttachment(config, { network: "mz-edge", services: [] }, 4000)?.services).toEqual({ api: ["default"] });
    expect(edgeAttachment(config, { network: "mz-edge", services: [] }, null, "web")?.services).toEqual({ web: ["default"] });
  });

  it("treats services without explicit networks as using the default one", () => {
    expect(edgeAttachment({ services: { web: { image: "nginx" } } }, { network: "mz-edge", services: ["web"] })).toEqual({ network: "mz-edge", dropPorts: false, services: { web: ["default"] } });
    expect(edgeAttachment({ services: { web: { image: "nginx" } } }, null)).toBeNull();
    expect(() => edgeAttachment({ services: {} }, { network: "mz-edge", services: ["missing"] })).toThrow(/missing/);
  });

  it("always attaches the service that publishes the tunnel port", () => {
    const config = { services: { app: { ports: [{ published: "3202", target: 3000, host_ip: "127.0.0.1" }] }, db: { image: "postgres" } } };
    expect(edgeAttachment(config, { network: "mz-edge", services: [] }, 3202)).toEqual({ network: "mz-edge", dropPorts: false, services: { app: ["default"] } });
    expect(edgeAttachment(config, { network: "mz-edge", services: ["app"] }, 3202)).toEqual({ network: "mz-edge", dropPorts: false, services: { app: ["default"] } });
  });

  it("pins only services that are built from source", () => {
    const result = buildOverride(
      { services: { app: { build: { context: "." }, ports: [{ published: "3202", target: 3000, host_ip: "127.0.0.1" }] }, db: { image: "postgres:16" } } },
      { project: "marczelloo-tools", sha: SHA, tunnelPort: 3202 }
    );
    expect(result.images).toEqual({ app: "marczelloo-tools-app:0123456789ab" });
    expect(result.yaml).toBe('services:\n  "app":\n    image: "marczelloo-tools-app:0123456789ab"\n');
  });
});
