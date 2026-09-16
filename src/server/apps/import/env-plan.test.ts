import { describe, expect, it } from "vitest";
import type { ContainerFact } from "../types";
import { buildEnvPlan, isSecretKey } from "./env-plan";

function container(service: string, env: Record<string, string>, imageId = "img"): ContainerFact {
  return { id: service, name: `stack-${service}`, image: "", imageId, status: "running", createdAt: "", composeProject: "stack", composeService: service, oneOff: false, workingDir: "/p/stack", configFiles: [], env, labels: {}, ports: [], mounts: [], networks: [] };
}

describe("isSecretKey", () => {
  it("flags credentials", () => {
    for (const key of ["JWT_SECRET", "POSTGRES_PASSWORD", "ATLASHUB_SECRET_KEY", "DISCORD_WEBHOOK_URL", "PLATFORM_MASTER_KEY", "RESEND_API_KEY"]) expect(isSecretKey(key)).toBe(true);
    for (const key of ["PORT", "NODE_ENV", "LOG_LEVEL"]) expect(isSecretKey(key)).toBe(false);
  });
});

describe("buildEnvPlan", () => {
  it("prefers running container values over a stale database (AtlasHub case)", () => {
    const plan = buildEnvPlan({
      containers: [container("gateway", { POSTGRES_PASSWORD: "live", PATH: "/usr/bin", PORT: "4545" })],
      imageEnv: { img: { PATH: "/usr/bin" } },
      composeConfig: { services: { gateway: { environment: { POSTGRES_PASSWORD: "live", PORT: "4545" } } } },
      envFiles: [{ path: "/p/stack/.env", entries: [{ key: "POSTGRES_PASSWORD", value: "live" }, { key: "MINIO_PUBLIC_URL", value: "https://s" }], interpolation: true }],
      legacy: [{ key: "POSTGRES_PASSWORD", value: "old" }, { key: "REMOVED", value: "x" }],
    });

    expect(plan.map((entry) => entry.key)).toEqual(["MINIO_PUBLIC_URL", "PORT", "POSTGRES_PASSWORD", "REMOVED"]);
    expect(plan.find((entry) => entry.key === "POSTGRES_PASSWORD")).toMatchObject({ value: "live", origin: "file", sourcePath: "/p/stack/.env", secret: true, include: true, conflicts: ["legacy-differs"] });
    expect(plan.find((entry) => entry.key === "PORT")).toMatchObject({ origin: "compose", include: true, conflicts: [] });
    expect(plan.find((entry) => entry.key === "MINIO_PUBLIC_URL")).toMatchObject({ origin: "file", include: true, conflicts: ["not-in-container"], services: [] });
    expect(plan.find((entry) => entry.key === "REMOVED")).toMatchObject({ origin: "legacy-db", include: false, conflicts: ["not-in-container"] });
    expect(plan.some((entry) => entry.key === "PATH")).toBe(false);
  });

  it("flags a file changed without recreating the container (lavalink case)", () => {
    const [entry] = buildEnvPlan({
      containers: [container("lavalink", { ACTIVITY_ALLOWED_ORIGINS: "old" })],
      imageEnv: {},
      composeConfig: null,
      envFiles: [{ path: "/p/stack/.env", entries: [{ key: "ACTIVITY_ALLOWED_ORIGINS", value: "new" }], interpolation: true }],
      legacy: [],
    });
    expect(entry).toMatchObject({ value: "old", origin: "container", conflicts: ["file-differs"], include: true });
  });

  it("keeps per-service values when services disagree", () => {
    const [entry] = buildEnvPlan({
      containers: [container("dashboard", { PORT: "3100" }), container("demo", { PORT: "3101" })],
      imageEnv: {},
      composeConfig: null,
      envFiles: [],
      legacy: [],
    });
    expect(entry).toMatchObject({ key: "PORT", perService: { dashboard: "3100", demo: "3101" }, conflicts: ["services-differ"], services: ["dashboard", "demo"] });
  });

  it("does not flag interpolation-only file values when compose explains the container value (dashboard case)", () => {
    const [entry] = buildEnvPlan({
      containers: [container("dashboard", { RUNNER_URL: "http://runner:8787" })],
      imageEnv: {},
      composeConfig: { services: { dashboard: { environment: { RUNNER_URL: "http://runner:8787" } } } },
      envFiles: [{ path: "/p/stack/.env", entries: [{ key: "RUNNER_URL", value: "http://127.0.0.1:8787" }], interpolation: true }],
      legacy: [],
    });
    expect(entry).toMatchObject({ key: "RUNNER_URL", origin: "compose", conflicts: [] });
  });

  it("recognises file keys whose container value equals the image default (Drive case)", () => {
    const plan = buildEnvPlan({
      containers: [container("drive", { NODE_ENV: "production", PORT: "3000" })],
      imageEnv: { img: { NODE_ENV: "production", PORT: "3000" } },
      composeConfig: null,
      envFiles: [{ path: "/p/stack/.env", entries: [{ key: "NODE_ENV", value: "production" }, { key: "PORT", value: "4000" }], interpolation: true }],
      legacy: [],
    });
    expect(plan.find((entry) => entry.key === "NODE_ENV")).toMatchObject({ origin: "file", services: ["drive"], include: true, conflicts: [] });
    expect(plan.find((entry) => entry.key === "PORT")).toMatchObject({ origin: "file", services: ["drive"], include: true, conflicts: ["file-differs"] });
  });

  it("does not include keys that exist only in a non-interpolation env file", () => {
    const [entry] = buildEnvPlan({
      containers: [],
      imageEnv: {},
      composeConfig: null,
      envFiles: [{ path: "/p/stack/extra.env", entries: [{ key: "UNUSED", value: "1" }], interpolation: false }],
      legacy: [],
    });
    expect(entry).toMatchObject({ key: "UNUSED", include: false });
  });
});
