import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { BuildSpec } from "./detect";
import { renderDockerfile, renderGeneratedCompose } from "./templates";

const nodeSpec: BuildSpec = {
  kind: "node",
  framework: "express",
  packageManager: "npm",
  port: 3000,
  installCommand: "npm ci",
  buildCommand: "npm run build",
  startCommand: "node -e \"console.log('ready')\"",
  outputDir: null,
  dockerfile: null,
  composeFile: null,
};

describe("renderDockerfile", () => {
  it("renders a safe Node Dockerfile with an escaped command", () => {
    const dockerfile = renderDockerfile(nodeSpec);
    expect(dockerfile).toContain("COPY --exclude=.env --exclude=.env.* --exclude=.git --exclude=node_modules . .");
    expect(dockerfile.indexOf("RUN npm run build")).toBeLessThan(dockerfile.indexOf("ENV NODE_ENV=production"));
    expect(dockerfile).toContain('CMD ["sh", "-c", "node -e \\"console.log(\'ready\')\\\""]');
  });

  it("renders built static apps as nginx two-stage images", () => {
    const dockerfile = renderDockerfile({ ...nodeSpec, kind: "static", framework: "vite", outputDir: "dist", startCommand: null, port: 8080 });
    expect(dockerfile).toContain("FROM node:20-alpine AS build");
    expect(dockerfile).toContain("FROM nginx:1.27-alpine");
    expect(dockerfile).toContain("try_files $uri $uri/ /index.html;");
  });
});

describe("renderGeneratedCompose", () => {
  it("generates parseable Compose with inline Dockerfile and optional port mapping", () => {
    const compose = parse(renderGeneratedCompose({ spec: nodeSpec, composeProject: "my_app", repoPath: "/srv/repos/app", localPort: 3100 }));
    expect(compose.services.app.build.dockerfile_inline).toContain("FROM node:20-alpine");
    expect(compose.services.app.ports).toEqual(["127.0.0.1:3100:3000"]);
    expect(compose.services.app.env_file).toEqual([{ path: "/srv/repos/app/.env", required: false }]);
  });

  it("omits ports when no local port was requested", () => {
    const compose = parse(renderGeneratedCompose({ spec: nodeSpec, composeProject: "myapp", repoPath: "/srv/repos/app", localPort: null }));
    expect(compose.services.app.ports).toBeUndefined();
  });

  it("references an existing Dockerfile", () => {
    const spec: BuildSpec = { ...nodeSpec, kind: "dockerfile", dockerfile: "Dockerfile", installCommand: null, buildCommand: null, startCommand: null, packageManager: null };
    const compose = parse(renderGeneratedCompose({ spec, composeProject: "myapp", repoPath: "/srv/repos/app", localPort: 3000 }));
    expect(compose.services.app.build).toEqual({ context: "/srv/repos/app", dockerfile: "Dockerfile" });
    expect(compose.services.app.build.dockerfile_inline).toBeUndefined();
  });

  it("rejects an invalid Compose project name", () => {
    expect(() => renderGeneratedCompose({ spec: nodeSpec, composeProject: "My App", repoPath: "/srv/repos/app", localPort: null })).toThrow();
  });

  it("escapes dollar signs so Compose does not interpolate the inline Dockerfile", () => {
    const yamlText = renderGeneratedCompose({
      spec: { kind: "static", framework: null, packageManager: null, port: 8080, installCommand: null, buildCommand: null, startCommand: null, outputDir: ".", dockerfile: null, composeFile: null },
      composeProject: "site",
      repoPath: "/p/site",
      localPort: null,
    });
    const inline = (parse(yamlText) as { services: { app: { build: { dockerfile_inline: string } } } }).services.app.build.dockerfile_inline;
    expect(inline).toContain("try_files $$uri $$uri/ /index.html;");
    expect(inline).not.toMatch(/[^$]\$uri/);
  });
});
