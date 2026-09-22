import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHostOperations, HostOperationError, parseComposePorts, parseMeminfo, parsePublishedPorts, validateRepoPath } from "./host";

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("host input paths", () => {
  it("rejects traversal and paths outside the allowed root", async () => {
    await expect(validateRepoPath("/projects/app/../secret", "/projects", async (value) => value)).rejects.toBeInstanceOf(HostOperationError);
    await expect(validateRepoPath("/etc", "/projects", async (value) => value)).rejects.toBeInstanceOf(HostOperationError);
  });

  it.skipIf(process.platform === "win32")("rejects a repository symlink escaping the allowed root", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "agent-host-"));
    temporary.push(base);
    const root = path.join(base, "projects");
    const outside = path.join(base, "outside");
    await mkdir(root);
    await mkdir(outside);
    await symlink(outside, path.join(root, "escape"));
    await expect(validateRepoPath(path.join(root, "escape"), root)).rejects.toMatchObject({ status: 400 });
  });
});

describe("environment files", () => {
  it.skipIf(process.platform === "win32")("lists sorted regular env files and reads their content", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-env-"));
    temporary.push(root);
    const repo = path.join(root, "repo");
    await mkdir(repo);
    await writeFile(path.join(repo, ".env.production"), "B=2");
    await writeFile(path.join(repo, ".env"), "A=1");
    await writeFile(path.join(repo, ".environment"), "ignored");
    await mkdir(path.join(repo, ".env.directory"));
    const host = createHostOperations(root);
    await expect(host.listEnvFiles({ repoPath: repo })).resolves.toEqual({ files: [".env", ".env.production"] });
    await expect(host.readEnvFile({ repoPath: repo, filename: ".env" })).resolves.toEqual({ exists: true, content: "A=1" });
    await expect(host.readEnvFile({ repoPath: repo, filename: ".env.missing" })).resolves.toEqual({ exists: false, content: "" });
  });

  it.skipIf(process.platform === "win32")("enforces the size limit without exposing content in errors", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-env-size-"));
    temporary.push(root);
    const repo = path.join(root, "repo");
    await mkdir(repo);
    await writeFile(path.join(repo, ".env"), Buffer.alloc(1024 * 1024 + 1, "s"));
    const host = createHostOperations(root);
    let caught: unknown;
    try {
      await host.readEnvFile({ repoPath: repo, filename: ".env" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      status: 413,
      message: "The environment file is too large.",
    });
    expect((caught as Error).message).not.toContain("sss");
  });
});

describe("host parsers", () => {
  it("lists TCP ports per service from compose config JSON", () => {
    const json = JSON.stringify({ services: { app: { ports: [{ published: "3202", target: 3000, protocol: "tcp" }, { target: 9229 }] }, dns: { ports: [{ published: "53", target: 53, protocol: "udp" }] }, db: {} } });
    expect(parseComposePorts(json)).toEqual([
      { service: "app", published: 3202, target: 3000 },
      { service: "app", published: null, target: 9229 },
    ]);
    expect(parseComposePorts("not json")).toEqual([]);
  });

  it("parses MemTotal and MemAvailable in KiB", () => {
    expect(parseMeminfo("MemTotal:       1024 kB\nMemFree: 1 kB\nMemAvailable:    256 kB\n")).toEqual({
      totalBytes: 1024 * 1024,
      availableBytes: 256 * 1024,
    });
    expect(parseMeminfo("MemTotal: 1 kB\n")).toBeNull();
  });

  it("parses, expands and deduplicates Docker published ports", () => {
    const output = [
      "db\t127.0.0.1:3100->3100/tcp, 5432/tcp",
      "web\t0.0.0.0:8080->80/tcp, [::]:8080->80/tcp",
      "range\t0.0.0.0:7000-7001->7000-7001/tcp, 0.0.0.0:7000-7001->7000-7001/tcp",
    ].join("\n");
    expect(parsePublishedPorts(output)).toEqual([
      { container: "db", hostIp: "127.0.0.1", hostPort: 3100, containerPort: 3100, protocol: "tcp" },
      { container: "web", hostIp: "0.0.0.0", hostPort: 8080, containerPort: 80, protocol: "tcp" },
      { container: "web", hostIp: "::", hostPort: 8080, containerPort: 80, protocol: "tcp" },
      { container: "range", hostIp: "0.0.0.0", hostPort: 7000, containerPort: 7000, protocol: "tcp" },
      { container: "range", hostIp: "0.0.0.0", hostPort: 7001, containerPort: 7001, protocol: "tcp" },
    ]);
  });
});

describe("preflight", () => {
  it.skipIf(process.platform === "win32")("uses compose discovery order and a quiet injected command runner", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-preflight-"));
    temporary.push(root);
    const repo = path.join(root, "repo");
    await mkdir(path.join(repo, ".git"), { recursive: true });
    await writeFile(path.join(repo, "compose.yml"), "services: {}");
    await writeFile(path.join(repo, "compose.yaml"), "services: {}");
    const calls: Array<{ args: string[]; quiet?: boolean; timeoutMs: number }> = [];
    const host = createHostOperations(root, {
      run: async (step) => {
        calls.push(step);
        if (step.args.at(-1) === "--services") return { code: 0, stdout: "api\nworker\n", stderr: "" };
        if (step.args.at(-1) === "--profiles") return { code: 0, stdout: "debug\n", stderr: "" };
        return { code: 0, stdout: "", stderr: "" };
      },
    });
    await expect(host.preflight({ repoPath: repo, composeFile: null })).resolves.toEqual({
      repoState: "git", composeFile: "compose.yaml", composeValid: true, services: ["api", "worker"], profiles: ["debug"], ports: [],
    });
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.quiet && call.timeoutMs === 20_000)).toBe(true);
    expect(calls[0].args).toContain(path.join(repo, "compose.yaml"));
  });
});

describe("container restart", () => {
  it("refuses the agent and containers without a Compose project label", async () => {
    const run = async () => ({ code: 0, stdout: "", stderr: "" });
    const host = createHostOperations("/projects", { run });
    await expect(host.restartContainer({ name: "marczelloo-agent" })).rejects.toMatchObject({ status: 400 });
    await expect(host.restartContainer({ name: "plain-container" })).rejects.toMatchObject({ status: 404 });
  });

  it("restarts a Compose-managed container using fixed Docker arguments", async () => {
    const calls: string[][] = [];
    const host = createHostOperations("/projects", {
      run: async (step) => {
        calls.push(step.args);
        return { code: 0, stdout: calls.length === 1 ? "project\n" : "app\n", stderr: "" };
      },
    });
    await expect(host.restartContainer({ name: "project-app-1" })).resolves.toEqual({ ok: true });
    expect(calls).toEqual([
      ["inspect", "--format", "{{index .Config.Labels \"com.docker.compose.project\"}}", "project-app-1"],
      ["restart", "--time", "30", "project-app-1"],
    ]);
  });
});
