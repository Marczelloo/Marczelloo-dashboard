import { stringify } from "yaml";
import { type BuildSpec, validateBuildSpec } from "./detect";

function validSpec(spec: BuildSpec): void {
  const errors = validateBuildSpec(spec);
  if (errors.length) throw new Error(errors.join(" "));
}

function command(command: string): string {
  return `CMD ["sh", "-c", ${JSON.stringify(command)}]`;
}

function nginxConfig(port: number): string {
  return [
    "COPY <<'EOF' /etc/nginx/conf.d/default.conf",
    "server {",
    `  listen ${port};`,
    "  root /usr/share/nginx/html;",
    "  gzip on;",
    "  location / { try_files $uri $uri/ /index.html; }",
    "}",
    "EOF",
  ].join("\n");
}

const safeCopy = "COPY --exclude=.env --exclude=.env.* --exclude=.git --exclude=node_modules . .";

export function renderDockerfile(spec: BuildSpec): string {
  validSpec(spec);
  if (spec.kind !== "node" && spec.kind !== "static" && spec.kind !== "python") {
    throw new Error("Dockerfile można wygenerować tylko dla aplikacji Node.js, statycznej lub Python.");
  }

  if (spec.kind === "node") {
    const baseImage = spec.packageManager === "bun" ? "oven/bun:1-alpine" : "node:20-alpine";
    const lines = ["# syntax=docker/dockerfile:1.7-labs", `FROM ${baseImage}`, "WORKDIR /app"];
    if (spec.packageManager === "pnpm" || spec.packageManager === "yarn") lines.push("RUN corepack enable");
    lines.push(safeCopy);
    if (spec.installCommand) lines.push(`RUN ${spec.installCommand}`);
    if (spec.buildCommand) lines.push(`RUN ${spec.buildCommand}`);
    lines.push("ENV NODE_ENV=production");
    if (spec.port !== null) lines.push(`ENV PORT=${spec.port} HOST=0.0.0.0 HOSTNAME=0.0.0.0`, `EXPOSE ${spec.port}`);
    lines.push(command(spec.startCommand!));
    return `${lines.join("\n")}\n`;
  }

  if (spec.kind === "python") {
    const lines = [
      "# syntax=docker/dockerfile:1.7-labs",
      "FROM python:3.12-slim",
      "WORKDIR /app",
      "ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1",
      safeCopy,
    ];
    if (spec.installCommand) lines.push(`RUN ${spec.installCommand}`);
    if (spec.port !== null) lines.push(`ENV PORT=${spec.port}`, `EXPOSE ${spec.port}`);
    lines.push(command(spec.startCommand!));
    return `${lines.join("\n")}\n`;
  }

  const port = spec.port ?? 8080;
  if (spec.buildCommand) {
    const lines = ["# syntax=docker/dockerfile:1.7-labs", "FROM node:20-alpine AS build", "WORKDIR /app"];
    if (spec.packageManager === "pnpm" || spec.packageManager === "yarn") lines.push("RUN corepack enable");
    lines.push(safeCopy);
    if (spec.installCommand) lines.push(`RUN ${spec.installCommand}`);
    lines.push(`RUN ${spec.buildCommand}`, "FROM nginx:1.27-alpine", `COPY --from=build /app/${spec.outputDir} /usr/share/nginx/html`, nginxConfig(port), `EXPOSE ${port}`);
    return `${lines.join("\n")}\n`;
  }

  return [
    "# syntax=docker/dockerfile:1.7-labs",
    "FROM nginx:1.27-alpine",
    `COPY --exclude=.env --exclude=.env.* --exclude=.git --exclude=node_modules ${spec.outputDir} /usr/share/nginx/html`,
    nginxConfig(port),
    `EXPOSE ${port}`,
    "",
  ].join("\n");
}

function isAbsolutePathWithoutParent(value: string): boolean {
  return (/^(?:\/[^^\\/]|[A-Za-z]:[\\/])/.test(value) || value === "/") && !value.split(/[\\/]+/).includes("..");
}

export function renderGeneratedCompose(input: {
  spec: BuildSpec;
  composeProject: string;
  repoPath: string;
  localPort: number | null;
}): string {
  validSpec(input.spec);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(input.composeProject)) throw new Error("Nazwa projektu Compose jest nieprawidłowa.");
  if (!isAbsolutePathWithoutParent(input.repoPath)) throw new Error("Ścieżka repozytorium musi być bezwzględna i nie może zawierać „..”.");
  if (input.localPort !== null && (!Number.isInteger(input.localPort) || input.localPort < 1 || input.localPort > 65535)) {
    throw new Error("Port lokalny musi być liczbą całkowitą od 1 do 65535.");
  }
  if (input.spec.kind === "compose") throw new Error("Nie można wygenerować Compose dla istniejącego pliku Compose.");

  const build = input.spec.kind === "dockerfile"
    ? { context: input.repoPath, dockerfile: input.spec.dockerfile }
    // Compose interpolates ${VAR} inside dockerfile_inline too; "$$" keeps nginx's $uri and shell variables intact.
    : { context: input.repoPath, dockerfile_inline: renderDockerfile(input.spec).replaceAll("$", "$$$$") };
  const app: Record<string, unknown> = {
    build,
    image: `${input.composeProject}-app:local`,
    restart: "unless-stopped",
    init: true,
    env_file: [{ path: `${input.repoPath}/.env`, required: false }],
    labels: {
      "dev.marczelloo.managed": "true",
      "dev.marczelloo.build-kind": input.spec.kind,
    },
    logging: { driver: "json-file", options: { "max-size": "10m", "max-file": "3" } },
  };
  if (input.localPort !== null && input.spec.port !== null) app.ports = [`127.0.0.1:${input.localPort}:${input.spec.port}`];

  return stringify({ services: { app } }, { lineWidth: 0 });
}
