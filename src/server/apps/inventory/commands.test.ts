import { describe, expect, it } from "vitest";
import { buildEnvFilesCommand, buildInspectCommand, buildStackProbeCommand, parseGit, parseImageEnv } from "./commands";

const stack = {
  project: "atlas-hub",
  workingDir: "/home/Marczelloo_pi/projects/atlas-hub",
  configFiles: ["/home/Marczelloo_pi/projects/atlas-hub/docker-compose.yml"],
};

describe("commands", () => {
  it("uses only read-only docker commands", () => {
    const all = [
      buildInspectCommand(),
      buildStackProbeCommand([stack], ["sha256:" + "a".repeat(64)], { path: "/etc/cloudflared/config.yml", useSudo: true }),
      buildEnvFilesCommand(["/home/Marczelloo_pi/projects/neobeatbuddy/.env"]),
    ].join("\n");
    const dockerCalls = all.match(/docker [^;&|\n)]*/g) ?? [];
    expect(dockerCalls.length).toBeGreaterThan(0);
    for (const call of dockerCalls) {
      expect(call).toMatch(/^docker (ps -aq|inspect |compose .+ config --format json|image inspect )/);
    }
    expect(all).not.toMatch(/\bsudo -n (?!cat )/);
    expect(all).toContain("docker compose -p 'atlas-hub' --project-directory '/home/Marczelloo_pi/projects/atlas-hub' -f '/home/Marczelloo_pi/projects/atlas-hub/docker-compose.yml' --profile '*' config --format json");
    expect(all).toContain("sudo -n cat '/etc/cloudflared/config.yml'");
    expect(all).toContain("@@MZ:BEGIN env-file /home/Marczelloo_pi/projects/atlas-hub/.env");
  });

  it("rejects unsafe inputs", () => {
    expect(() => buildStackProbeCommand([{ ...stack, project: "a;b" }], [], { path: null, useSudo: false })).toThrow();
    expect(() => buildStackProbeCommand([{ ...stack, workingDir: "/x/../etc" }], [], { path: null, useSudo: false })).toThrow();
    expect(() => buildStackProbeCommand([stack], ["latest"], { path: null, useSudo: false })).toThrow();
    expect(() => buildEnvFilesCommand(["relative/.env"])).toThrow();
  });
});

describe("parsers", () => {
  it("parses image env lines", () => {
    expect(parseImageEnv('"sha256:aa" ["PATH=/bin","PORT=3000"]\n"sha256:bb" null\n')).toEqual({ "sha256:aa": { PATH: "/bin", PORT: "3000" }, "sha256:bb": {} });
  });

  it("parses git sections", () => {
    expect(parseGit("ae8235d9\ngit@github.com:Marczelloo/Marczelloo-Tools.git\n", 0)).toEqual({ head: "ae8235d9", remote: "git@github.com:Marczelloo/Marczelloo-Tools.git" });
    expect(parseGit("ae8235d9\n", 2)).toEqual({ head: "ae8235d9", remote: null });
    expect(parseGit("", 128)).toBeNull();
  });

  it("strips credentials from git remotes", () => {
    expect(parseGit("ae8235d9\nhttps://x-access-token:ghs_secret@github.com/Marczelloo/atlashub.git\n", 0)).toEqual({ head: "ae8235d9", remote: "https://github.com/Marczelloo/atlashub.git" });
  });
});
