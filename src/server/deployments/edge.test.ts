import { describe, expect, it } from "vitest";
import { edgeServicesForProject, parseContainerService, pickTunnelPort, translateIngress } from "./edge";

const bindings = [
  { container: "atlashub-dashboard", hostPort: 3000, containerPort: 3001 },
  { container: "atlashub-gateway", hostPort: 4545, containerPort: 4545 },
  { container: "atlashub-minio", hostPort: 9000, containerPort: 9000 },
  { container: "atlashub-postgres", hostPort: 5432, containerPort: 5432 },
  { container: "marczelloo-tools", hostPort: 3202, containerPort: 3000 },
];

describe("parseContainerService", () => {
  it("recognises container targets only", () => {
    expect(parseContainerService("http://marczelloo-tools:3000")).toEqual({ container: "marczelloo-tools", port: 3000 });
    expect(parseContainerService("http://127.0.0.1:3202")).toBeNull();
    expect(parseContainerService("http://localhost:3202")).toBeNull();
    expect(parseContainerService("http_status:404")).toBeNull();
  });
});

describe("edgeServicesForProject", () => {
  it("finds every service a route reaches, by loopback port or container name", () => {
    const routes = [
      { service: "http://127.0.0.1:3000" },
      { service: "http://atlashub-gateway:4545" },
      { service: "http://127.0.0.1:9000" },
      { service: "http://127.0.0.1:3202" },
      { service: "http_status:404" },
    ];
    const containers = [
      { name: "atlashub-dashboard", service: "dashboard" },
      { name: "atlashub-gateway", service: "gateway" },
      { name: "atlashub-minio", service: "minio" },
      { name: "atlashub-postgres", service: "postgres" },
    ];
    expect(edgeServicesForProject(routes, bindings, containers)).toEqual(["dashboard", "gateway", "minio"]);
  });
});

describe("pickTunnelPort", () => {
  it("follows the agent's rule for the tunnel service", () => {
    expect(pickTunnelPort([{ service: "app", published: 3202, target: 3000 }], 9999)).toEqual({ service: "app", port: 3000 });
    const stack = [
      { service: "dashboard", published: 3100, target: 3100 },
      { service: "demo", published: 3101, target: 3101 },
      { service: "portainer", published: 9201, target: 9000 },
    ];
    expect(pickTunnelPort(stack, 3101)).toEqual({ service: "demo", port: 3101 });
    expect(pickTunnelPort([{ service: "web", published: null, target: 3000 }, { service: "api", published: null, target: 4000 }], 4000)).toEqual({ service: "api", port: 4000 });
    expect(pickTunnelPort(stack, 1234)).toBeNull();
  });
});

describe("translateIngress", () => {
  it("rewrites loopback services and keeps everything else", () => {
    const rules = [
      { hostname: "admin-atlashub.marczelloo.dev", service: "http://127.0.0.1:3000" },
      { hostname: "storage-atlashub.marczelloo.dev", service: "http://127.0.0.1:9000", originRequest: { httpHostHeader: "minio:9000" } },
      { hostname: "nadstrona.pl", service: "http://127.0.0.1:8080" },
      { hostname: "ghost.marczelloo.dev", service: "http://127.0.0.1:3999" },
      { service: "http_status:404" },
    ];
    const result = translateIngress(rules, bindings, { 8080: "http://mz-static:8080" });
    expect(result.rules).toEqual([
      { hostname: "admin-atlashub.marczelloo.dev", service: "http://atlashub-dashboard:3001" },
      { hostname: "storage-atlashub.marczelloo.dev", service: "http://atlashub-minio:9000", originRequest: { httpHostHeader: "minio:9000" } },
      { hostname: "nadstrona.pl", service: "http://mz-static:8080" },
      { hostname: "ghost.marczelloo.dev", service: "http://127.0.0.1:3999" },
      { service: "http_status:404" },
    ]);
    expect(result.unresolved).toEqual([{ hostname: "ghost.marczelloo.dev", from: "http://127.0.0.1:3999", to: "" }]);
    expect(result.changes).toHaveLength(3);
  });
});
