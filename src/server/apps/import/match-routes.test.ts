import { describe, expect, it } from "vitest";
import type { ContainerFact, IngressRule } from "../types";
import { matchIngressRoutes } from "./match-routes";

function container(name: string, project: string, service: string, ports: ContainerFact["ports"], status = "running"): ContainerFact {
  return { id: name, name, image: "", imageId: "", status, createdAt: "", composeProject: project, composeService: service, oneOff: false, workingDir: null, configFiles: [], env: {}, labels: {}, ports, mounts: [], networks: [] };
}

const rule = (position: number, hostname: string | null, service: string): IngressRule => ({ position, hostname, path: null, service, originRequest: null });

describe("matchIngressRoutes", () => {
  it("maps loopback ports to containers, host services and status rules", () => {
    const containers = [
      container("atlashub-minio", "atlas-hub", "minio", [{ hostIp: "127.0.0.1", hostPort: 9000, containerPort: 9000, protocol: "tcp" }]),
      container("portfolio-redesign-portfolio-1", "portfolio-redesign", "portfolio", [
        { hostIp: "0.0.0.0", hostPort: 3200, containerPort: 3200, protocol: "tcp" },
        { hostIp: "::", hostPort: 3200, containerPort: 3200, protocol: "tcp" },
      ]),
      container("old", "old", "web", [{ hostIp: "0.0.0.0", hostPort: 3300, containerPort: 80, protocol: "tcp" }], "exited"),
    ];
    const matches = matchIngressRoutes(
      [rule(0, "storage-atlashub.marczelloo.dev", "http://127.0.0.1:9000"), rule(1, "marczelloo.dev", "http://localhost:3200"), rule(2, "nadstrona.pl", "http://127.0.0.1:8080"), rule(3, "x.pl", "http://127.0.0.1:3300"), rule(4, null, "http_status:404"), rule(5, "y.pl", "http://minio:9000")],
      containers
    );
    expect(matches.map((match) => match.target)).toEqual([
      { kind: "container", composeProject: "atlas-hub", service: "minio", containerName: "atlashub-minio", containerPort: 9000 },
      { kind: "container", composeProject: "portfolio-redesign", service: "portfolio", containerName: "portfolio-redesign-portfolio-1", containerPort: 3200 },
      { kind: "host", port: 8080 },
      { kind: "host", port: 3300 },
      { kind: "status", status: "404" },
      { kind: "other", url: "http://minio:9000" },
    ]);
  });
});
