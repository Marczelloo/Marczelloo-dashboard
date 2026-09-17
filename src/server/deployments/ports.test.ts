import { describe, expect, it } from "vitest";
import { pickDeploymentPort, portUsedByOthers } from "./ports";

const published = [
  { container: "atlashub-dashboard", hostPort: 3000 },
  { container: "marczelloo-tools", hostPort: 3202 },
  { container: "other", hostPort: 3001 },
];

describe("pickDeploymentPort", () => {
  it("keeps the preferred port when it is free or owned by the same project", () => {
    expect(pickDeploymentPort(3300, published, [])).toBe(3300);
    expect(pickDeploymentPort(3202, published, ["marczelloo-tools"])).toBe(3202);
  });

  it("falls back to the first free port from 3000", () => {
    expect(pickDeploymentPort(3202, published, [])).toBe(3002);
  });
});

describe("portUsedByOthers", () => {
  it("ignores the project's own containers", () => {
    expect(portUsedByOthers(3202, published, ["marczelloo-tools"])).toBe(false);
    expect(portUsedByOthers(3000, published, ["marczelloo-tools"])).toBe(true);
  });
});
