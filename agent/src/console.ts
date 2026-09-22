/**
 * A read-mostly console for the dashboard's host page.
 *
 * The agent runs as a container with the docker socket and the projects
 * directory mounted, so this is not a shell on the Pi: it is the agent's own
 * environment, plus docker. Only the commands listed here run, arguments are
 * never passed through a shell, and anything that reads file contents is
 * confined to the projects root.
 */

import type { CommandResult } from "./pipeline";

/** The console runs binaries the deploy pipeline never touches, so it has its own step shape. */
export interface ConsoleStep {
  command: string;
  args: string[];
  timeoutMs: number;
  quiet: boolean;
}

export type ConsoleRun = (step: ConsoleStep, onOutput: (chunk: string) => void) => Promise<CommandResult>;

export interface ConsoleCommandResult {
  command: string;
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export class ConsoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsoleError";
  }
}

const TIMEOUT_MS = 30_000;
const MAX_INPUT = 500;

/** Docker subcommands that only read, plus the lifecycle actions the UI already offers. */
const DOCKER_ALLOWED = new Set(["ps", "images", "inspect", "logs", "stats", "top", "port", "version", "info", "start", "stop", "restart", "network", "volume", "system", "compose"]);
const DOCKER_SUB_ALLOWED: Record<string, Set<string>> = {
  network: new Set(["ls", "inspect"]),
  volume: new Set(["ls", "inspect"]),
  system: new Set(["df"]),
  compose: new Set(["ps", "logs", "config", "top", "version"]),
};

/** Commands whose arguments may name a path, which must then sit under the projects root. */
const PATH_CONFINED = new Set(["cat", "head", "tail", "grep", "wc"]);

const SIMPLE_ALLOWED = new Set(["df", "free", "uptime", "uname", "ls", "du", "cat", "head", "tail", "wc", "grep", "git", "node", "date", "whoami", "id", "hostname"]);

const FORBIDDEN = /[;&|<>`$(){}\\!*?~\n\r]/;

/** Splits on whitespace, honouring quotes, and refuses anything a shell would interpret. */
export function parseCommand(input: string): string[] {
  const line = input.trim();
  if (!line) throw new ConsoleError("Type a command first.");
  if (line.length > MAX_INPUT) throw new ConsoleError("Command is too long.");

  const argv: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let started = false;

  for (const character of line) {
    if (quote) {
      if (character === quote) {
        quote = null;
        continue;
      }
      current += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      started = true;
      continue;
    }
    if (/\s/.test(character)) {
      if (started) {
        argv.push(current);
        current = "";
        started = false;
      }
      continue;
    }
    if (FORBIDDEN.test(character)) throw new ConsoleError(`Character ${character} is not allowed. The console does not run a shell.`);
    current += character;
    started = true;
  }
  if (quote) throw new ConsoleError("Unclosed quote.");
  if (started) argv.push(current);
  return argv;
}

/** Flags that swallow the next argument, so it is never mistaken for the verb. */
const VALUE_FLAGS = new Set(["-p", "-f", "-n", "--project-name", "--file", "--project-directory", "--profile", "--env-file", "--format", "--filter", "--tail", "--since", "--until"]);

/** The first bare word of a docker subcommand group, ignoring flags and their values. */
function firstVerb(args: string[]): string | null {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument.startsWith("-")) {
      if (VALUE_FLAGS.has(argument) && !argument.includes("=")) index += 1;
      continue;
    }
    return argument;
  }
  return null;
}

const looksLikePath = (value: string) => value.startsWith("/") || value.startsWith("./") || value.startsWith("../") || value.includes("/");

/** Rejects anything outside the allowlist; returns the argv that may run. */
export function checkCommand(argv: string[], allowedRoot: string): string[] {
  const [command, ...args] = argv;
  if (!command) throw new ConsoleError("Type a command first.");
  if (args.some((argument) => argument.includes(".."))) throw new ConsoleError("Parent relative paths are not allowed.");

  if (command === "docker") {
    const [subcommand] = args;
    if (!subcommand || !DOCKER_ALLOWED.has(subcommand)) {
      throw new ConsoleError(`docker ${subcommand ?? ""} is not allowed. Allowed: ${[...DOCKER_ALLOWED].sort().join(", ")}.`);
    }
    const nested = DOCKER_SUB_ALLOWED[subcommand];
    if (nested) {
      const verb = firstVerb(args.slice(1));
      if (!verb || !nested.has(verb)) {
        throw new ConsoleError(`docker ${subcommand} ${verb ?? ""} is not allowed. Allowed: ${[...nested].sort().join(", ")}.`);
      }
    }
    return argv;
  }

  if (!SIMPLE_ALLOWED.has(command)) {
    throw new ConsoleError(`${command} is not allowed. Allowed: docker, ${[...SIMPLE_ALLOWED].sort().join(", ")}.`);
  }

  if (command === "git") {
    const allowed = new Set(["status", "log", "remote", "branch", "rev-parse", "show", "diff", "config"]);
    const subcommand = args.find((argument) => !argument.startsWith("-") && argument !== "-C" && !looksLikePath(argument));
    if (!subcommand || !allowed.has(subcommand)) throw new ConsoleError(`git ${subcommand ?? ""} is not allowed (read only).`);
  }

  if (PATH_CONFINED.has(command)) {
    for (const argument of args) {
      if (argument.startsWith("-")) continue;
      if (!looksLikePath(argument)) continue;
      if (!argument.startsWith(`${allowedRoot}/`)) throw new ConsoleError(`${command} can only read files in ${allowedRoot}.`);
    }
  }

  for (const argument of args) {
    if (argument.startsWith("/") && !argument.startsWith(`${allowedRoot}/`) && PATH_CONFINED.has(command)) {
      throw new ConsoleError(`Path outside ${allowedRoot} is not allowed.`);
    }
  }

  return argv;
}

/** Runs one allowlisted command and captures its output. */
export async function runConsoleCommand(input: unknown, allowedRoot: string, run: ConsoleRun): Promise<ConsoleCommandResult> {
  const command = (input as { command?: unknown } | null)?.command;
  if (typeof command !== "string") throw new ConsoleError("Type a command first.");
  const argv = checkCommand(parseCommand(command), allowedRoot);
  const startedAt = Date.now();
  const result = await run({ command: argv[0], args: argv.slice(1), timeoutMs: TIMEOUT_MS, quiet: true }, () => {});
  return {
    command: argv.join(" "),
    code: result.code,
    stdout: result.stdout.slice(-200_000),
    stderr: result.stderr.slice(-50_000),
    durationMs: Date.now() - startedAt,
  };
}
