import { describe, expect, it } from "vitest";
import { hostnameConflict } from "./hostname-guard";

const owners = [{ projectId: "portfolio", projectName: "portfolio-redesign", hostname: "marczelloo.dev" }];
const routes = [
  { hostname: "marczelloo.dev", service: "http://127.0.0.1:3200" },
  { hostname: "mewbit.marczelloo.dev", service: "http://127.0.0.1:8080" },
];

describe("hostnameConflict", () => {
  it("blocks a hostname owned by another project", () => {
    expect(hostnameConflict({ projectId: "new", hostname: "Marczelloo.dev", ownedHostnames: [], owners, routes })).toMatch(/portfolio-redesign/);
  });
  it("blocks a hand-made route such as a Caddy site", () => {
    expect(hostnameConflict({ projectId: "new", hostname: "mewbit.marczelloo.dev", ownedHostnames: [], owners, routes })).toMatch(/8080/);
  });
  it("allows the owner and a project adopting its own public URL", () => {
    expect(hostnameConflict({ projectId: "portfolio", hostname: "marczelloo.dev", ownedHostnames: ["marczelloo.dev"], owners, routes })).toBeNull();
    expect(hostnameConflict({ projectId: "neobeat", hostname: "mewbit.marczelloo.dev", ownedHostnames: ["mewbit.marczelloo.dev"], owners, routes })).toBeNull();
  });
  it("allows a free hostname", () => {
    expect(hostnameConflict({ projectId: "new", hostname: "app.nadstrona.pl", ownedHostnames: [], owners, routes })).toBeNull();
  });
});
