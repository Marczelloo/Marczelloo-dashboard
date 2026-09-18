import { describe, expect, it } from "vitest";
import { checkCommand, ConsoleError, parseCommand, runConsoleCommand } from "./console";

const ROOT = "/home/pi/projects";
const check = (line: string) => checkCommand(parseCommand(line), ROOT);

describe("parseCommand", () => {
  it("splits on whitespace and honours quotes", () => {
    expect(parseCommand('docker logs --tail 20 "my container"')).toEqual(["docker", "logs", "--tail", "20", "my container"]);
  });

  it("refuses anything a shell would interpret", () => {
    for (const line of ["docker ps; rm -rf /", "cat /etc/passwd | head", "echo `id`", "docker ps && docker rm x", "cat $HOME/.env"]) {
      expect(() => parseCommand(line)).toThrow(ConsoleError);
    }
  });

  it("refuses an unclosed quote and an empty line", () => {
    expect(() => parseCommand('docker logs "web')).toThrow(ConsoleError);
    expect(() => parseCommand("   ")).toThrow(ConsoleError);
  });
});

describe("checkCommand", () => {
  it("allows reading docker state", () => {
    expect(check("docker ps -a")).toEqual(["docker", "ps", "-a"]);
    expect(check("docker compose -p dashboard ps")).toEqual(["docker", "compose", "-p", "dashboard", "ps"]);
    expect(check("docker system df")).toEqual(["docker", "system", "df"]);
  });

  it("allows the lifecycle actions the UI already offers", () => {
    expect(check("docker restart dashboard-app")).toContain("restart");
  });

  it("refuses docker commands that escape the allowlist", () => {
    for (const line of ["docker exec -it dashboard-app sh", "docker run alpine", "docker rm -f web", "docker compose up -d", "docker system prune -af", "docker cp web:/etc/passwd ."]) {
      expect(() => check(line)).toThrow(ConsoleError);
    }
  });

  it("confines file reads to the projects root", () => {
    expect(() => check("cat /etc/shadow")).toThrow(ConsoleError);
    expect(() => check(`cat ${ROOT}/dashboard/package.json`)).not.toThrow();
  });

  it("refuses paths that climb out of the root", () => {
    expect(() => check(`cat ${ROOT}/../../etc/shadow`)).toThrow(ConsoleError);
  });

  it("refuses commands that are not on the list", () => {
    for (const line of ["rm -rf /", "curl http://example.com", "env", "printenv", "bash", "sh", "systemctl restart docker"]) {
      expect(() => check(line)).toThrow(ConsoleError);
    }
  });

  it("allows git to read a repository but not to change one", () => {
    expect(() => check(`git -C ${ROOT}/dashboard status`)).not.toThrow();
    expect(() => check(`git -C ${ROOT}/dashboard push`)).toThrow(ConsoleError);
  });
});

describe("runConsoleCommand", () => {
  it("runs the checked argv and reports the exit code", async () => {
    const result = await runConsoleCommand({ command: "docker ps -a" }, ROOT, async (step) => {
      expect(step.command).toBe("docker");
      expect(step.args).toEqual(["ps", "-a"]);
      return { code: 0, stdout: "CONTAINER ID\n", stderr: "" };
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("CONTAINER ID");
    expect(result.command).toBe("docker ps -a");
  });

  it("refuses to run anything that fails the check", async () => {
    await expect(runConsoleCommand({ command: "rm -rf /" }, ROOT, async () => ({ code: 0, stdout: "", stderr: "" }))).rejects.toThrow(ConsoleError);
  });
});
