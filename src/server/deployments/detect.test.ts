import { describe, expect, it } from "vitest";
import { detectBuild, validateBuildSpec, type BuildSpec } from "./detect";

const baseSpec: BuildSpec = {
  kind: "node",
  framework: null,
  packageManager: "npm",
  port: 3000,
  installCommand: "npm ci",
  buildCommand: null,
  startCommand: "node index.js",
  outputDir: null,
  dockerfile: null,
  composeFile: null,
};

describe("detectBuild", () => {
  it("detects Next.js with pnpm", () => {
    const result = detectBuild({
      files: ["package.json", "pnpm-lock.yaml"],
      packageJson: { dependencies: { next: "15.0.0" }, scripts: { build: "next build", start: "next start" } },
      dockerfileContent: null,
      requirementsTxt: null,
      pyprojectToml: null,
    }, "web");

    expect(result.spec).toMatchObject({ kind: "node", framework: "next", packageManager: "pnpm", installCommand: "pnpm install --frozen-lockfile", buildCommand: "pnpm build", startCommand: "pnpm start", port: 3000 });
  });

  it("treats a Vite SPA as static output", () => {
    const result = detectBuild({
      files: ["package.json"],
      packageJson: { devDependencies: { vite: "6.0.0" }, scripts: { build: "vite build" } },
      dockerfileContent: null,
      requirementsTxt: null,
      pyprojectToml: null,
    }, "web");

    expect(result.spec).toMatchObject({ kind: "static", framework: "vite", outputDir: "dist", port: 8080 });
  });

  it("uses the main field for an Express app without a build", () => {
    const result = detectBuild({
      files: ["package.json", "package-lock.json"],
      packageJson: { dependencies: { express: "5.0.0" }, main: "server.js", scripts: {} },
      dockerfileContent: null,
      requirementsTxt: null,
      pyprojectToml: null,
    }, "web");

    expect(result.spec).toMatchObject({ kind: "node", framework: "express", buildCommand: null, startCommand: "node server.js", installCommand: "npm ci" });
  });

  it("does not assign an HTTP port to a Discord bot", () => {
    const result = detectBuild({
      files: ["package.json"],
      packageJson: { dependencies: { "discord.js": "14.0.0" }, scripts: { start: "node bot.js" } },
      dockerfileContent: null,
      requirementsTxt: null,
      pyprojectToml: null,
    }, "bot");

    expect(result.spec).toMatchObject({ kind: "node", port: null, startCommand: "npm run start" });
  });

  it("reads the exposed port from a Dockerfile", () => {
    const result = detectBuild({ files: ["Dockerfile"], packageJson: null, dockerfileContent: "FROM node\nEXPOSE 8080", requirementsTxt: null, pyprojectToml: null }, "web");
    expect(result.spec).toMatchObject({ kind: "dockerfile", dockerfile: "Dockerfile", port: 8080 });
  });

  it("prefers Compose over a Dockerfile", () => {
    const result = detectBuild({ files: ["docker-compose.yml", "Dockerfile"], packageJson: null, dockerfileContent: "EXPOSE 3000", requirementsTxt: null, pyprojectToml: null }, "web");
    expect(result.spec).toMatchObject({ kind: "compose", composeFile: "docker-compose.yml", dockerfile: null });
  });

  it("uses app.main for FastAPI projects with an app directory", () => {
    const result = detectBuild({ files: ["requirements.txt", "app/"], packageJson: null, dockerfileContent: null, requirementsTxt: "fastapi\nuvicorn", pyprojectToml: null }, "web");
    expect(result.spec).toMatchObject({ kind: "python", framework: "fastapi", port: 8000, startCommand: "uvicorn app.main:app --host 0.0.0.0 --port 8000" });
  });

  it("detects plain HTML", () => {
    const result = detectBuild({ files: ["index.html"], packageJson: null, dockerfileContent: null, requirementsTxt: null, pyprojectToml: null }, "web");
    expect(result.spec).toMatchObject({ kind: "static", outputDir: ".", buildCommand: null, port: 8080 });
  });

  it("returns a useful reason for an unknown repository", () => {
    const result = detectBuild({ files: ["README.md"], packageJson: null, dockerfileContent: null, requirementsTxt: null, pyprojectToml: null }, "web");
    expect(result).toEqual({ spec: null, reasons: ["Could not tell what kind of project this is. Add a Dockerfile or docker-compose.yml."] });
  });
});

describe("validateBuildSpec", () => {
  it("rejects parent paths, multi-line commands and invalid ports", () => {
    const errors = validateBuildSpec({ ...baseSpec, port: 70000, outputDir: "../dist", startCommand: "node index.js\nrm -rf /" });
    expect(errors).toHaveLength(3);
  });

  it("keeps a Vite frontend served by Express as a Node app", () => {
    const { spec } = detectBuild(
      { files: ["package.json", "package-lock.json"], packageJson: { scripts: { build: "vite build", start: "node server.js" }, dependencies: { express: "^4" }, devDependencies: { vite: "^5" } }, dockerfileContent: null, requirementsTxt: null, pyprojectToml: null },
      "web"
    );
    expect(spec?.kind).toBe("node");
    expect(spec?.startCommand).toBe("npm run start");
  });
});
