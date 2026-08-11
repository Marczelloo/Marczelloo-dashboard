import "server-only";

import { shellQuote, validateRepoPath } from "@/server/runner/safe-paths";
import { getRepositoryCloneToken, parseGitHubUrl } from "@/server/github/client";
import type { DeploymentConfig } from "./config";
import { getCloudflareReloadCommand, getCloudflareTunnelSettings } from "./tunnel";

const RUNNER_URL = process.env.RUNNER_URL || "http://127.0.0.1:8787";
const RUNNER_TOKEN = process.env.RUNNER_TOKEN;
export const PROJECTS_DIR = process.env.PROJECTS_DIR || "/home/Marczelloo_pi/projects";
export const DEPLOY_LOG_DIR = `${PROJECTS_DIR}/.dashboard/deploy-logs`;

export interface HostCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DeploymentPreflight {
  ok: boolean;
  repoState: "missing" | "git" | "directory" | "invalid";
  composeFile: string | null;
  services: string[];
  profiles: string[];
  portInUse: boolean;
  messages: Array<{ level: "success" | "warning" | "error"; text: string }>;
}

export interface TunnelIngressRoute {
  hostname: string;
  service: string;
}

export function isDeploymentLogPath(value: string): boolean {
  return new RegExp(`^${escapeRegExp(DEPLOY_LOG_DIR)}/[A-Za-z0-9_.-]+\\.log$`).test(value) ||
    /^\/tmp\/(?:deploy|safe-deploy|self)-[A-Za-z0-9_.-]+\.log$/.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function runHostCommand(command: string, timeout = 30_000): Promise<HostCommandResult> {
  if (!RUNNER_TOKEN) throw new Error("Runner nie jest skonfigurowany (brak RUNNER_TOKEN).");

  const response = await fetch(`${RUNNER_URL}/shell`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RUNNER_TOKEN}` },
    body: JSON.stringify({ command, timeout }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  return {
    success: response.ok && result.success === true,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || result.error || ""),
    exitCode: Number(result.exit_code ?? (response.ok ? 0 : 1)),
  };
}

function requireSafeConfig(config: DeploymentConfig) {
  validateRepoPath(config.repoPath);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(config.composeProject)) {
    throw new Error("Nieprawidłowa nazwa projektu Docker Compose.");
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(config.branch) || config.branch.startsWith("-") || config.branch.includes("..")) {
    throw new Error("Nieprawidłowa nazwa brancha.");
  }
  if (config.composeFile && (!/^[A-Za-z0-9][A-Za-z0-9_.\/-]*$/.test(config.composeFile) || config.composeFile.includes(".."))) {
    throw new Error("Nieprawidłowa ścieżka pliku Compose.");
  }
  if (config.profiles.some((profile) => !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(profile))) {
    throw new Error("Nieprawidłowy profil Docker Compose.");
  }
  if (config.tunnel && (!Number.isInteger(config.tunnel.localPort) || config.tunnel.localPort < 1 || config.tunnel.localPort > 65535)) {
    throw new Error("Port tunelu musi być liczbą od 1 do 65535.");
  }
}

function parseProbe(output: string) {
  const values = new Map<string, string>();
  for (const line of output.split("\n")) {
    const index = line.indexOf("=");
    if (index > 0) values.set(line.slice(0, index), line.slice(index + 1).trim());
  }
  return values;
}

export async function preflightDeployment(config: DeploymentConfig): Promise<DeploymentPreflight> {
  requireSafeConfig(config);
  const messages: DeploymentPreflight["messages"] = [];
  const repoPath = validateRepoPath(config.repoPath);
  const expectedCompose = config.composeFile ? `${repoPath}/${config.composeFile}` : "";
  const tunnelPort = config.tunnel?.enabled ? config.tunnel.localPort : 0;
  const tunnelSettings = config.tunnel?.enabled ? await getCloudflareTunnelSettings() : null;

  let appCloneAccess = false;
  let appCloneError: string | null = null;
  try {
    appCloneAccess = Boolean(await getRepositoryCloneToken(config.githubUrl));
  } catch (error) {
    appCloneError = error instanceof Error ? error.message : "GitHub App could not confirm repository access.";
  }

  const probe = `set +e
REPO=${shellQuote(repoPath)}
echo "REPO_STATE=missing"
if [ -e "$REPO" ]; then
  if [ -d "$REPO/.git" ]; then echo "REPO_STATE=git"; else echo "REPO_STATE=directory"; fi
fi
COMPOSE=""
if [ -n ${shellQuote(expectedCompose)} ] && [ -f ${shellQuote(expectedCompose)} ]; then COMPOSE=${shellQuote(expectedCompose)}; fi
if [ -z "$COMPOSE" ] && [ -d "$REPO" ]; then
  for file in compose.yaml compose.yml docker-compose.yaml docker-compose.yml; do
    if [ -f "$REPO/$file" ]; then COMPOSE="$REPO/$file"; break; fi
  done
fi
echo "COMPOSE=$COMPOSE"
if [ -n "$COMPOSE" ]; then
  echo "COMPOSE_VALID=$(docker compose -f "$COMPOSE" config -q >/dev/null 2>&1 && echo yes || echo no)"
  echo "SERVICES=$(docker compose -f "$COMPOSE" config --services 2>/dev/null | tr '\\n' ',' | sed 's/,$//')"
  echo "PROFILES=$(docker compose -f "$COMPOSE" config --profiles 2>/dev/null | tr '\\n' ',' | sed 's/,$//')"
fi
if [ ${tunnelPort} -gt 0 ]; then
  echo "PORT_IN_USE=$(docker ps --format '{{.Ports}}' | grep -Eq "[:.]${tunnelPort}->" && echo yes || echo no)"
fi
${appCloneAccess ? 'echo "GIT_REMOTE=0"' : `git ls-remote ${shellQuote(config.githubUrl)} HEAD >/dev/null 2>&1\necho "GIT_REMOTE=$?"`}`;
  const result = await runHostCommand(probe, 20_000);
  const values = parseProbe(`${result.stdout}\n${result.stderr}`);
  const repoState = (values.get("REPO_STATE") || "invalid") as DeploymentPreflight["repoState"];
  const composePath = values.get("COMPOSE") || null;
  const composeFile = composePath?.startsWith(`${repoPath}/`) ? composePath.slice(repoPath.length + 1) : null;
  const services = (values.get("SERVICES") || "").split(",").filter(Boolean);
  const profiles = (values.get("PROFILES") || "").split(",").filter(Boolean);
  const portInUse = values.get("PORT_IN_USE") === "yes";

  if (repoState === "missing") messages.push({ level: "success", text: "Katalog jeszcze nie istnieje — zostanie utworzony przez bezpieczny git clone." });
  if (repoState === "directory") messages.push({ level: "error", text: "Docelowy katalog istnieje, ale nie jest repozytorium Git. Wybierz inną ścieżkę albo zaimportuj go osobno." });
  if (repoState === "git") messages.push({ level: "success", text: "Znaleziono istniejące repozytorium Git." });
  if (values.get("GIT_REMOTE") !== "0") messages.push({ level: "error", text: appCloneError || "Pi nie ma dostępu Git do tego repozytorium. Skonfiguruj klucz deploy/SSH dla GitHuba." });
  else messages.push({ level: "success", text: appCloneAccess ? "GitHub App potwierdził ograniczony dostęp do repo dla tego wdrożenia." : "Dostęp Git z Raspberry Pi został potwierdzony." });
  if (composePath && values.get("COMPOSE_VALID") === "yes") messages.push({ level: "success", text: `Compose poprawny: ${composeFile}.` });
  if (composePath && values.get("COMPOSE_VALID") !== "yes") messages.push({ level: "error", text: "Plik Compose nie przechodzi `docker compose config`." });
  if (!composePath && repoState !== "missing") messages.push({ level: "error", text: "Nie znaleziono compose.yaml, compose.yml ani docker-compose.yml." });
  if (repoState === "missing") messages.push({ level: "warning", text: "Compose zostanie wykryty po pierwszym klonowaniu; można wskazać jego ścieżkę ręcznie." });
  if (config.tunnel?.enabled && !tunnelSettings?.configPath) messages.push({ level: "error", text: "Włączono Cloudflare Tunnel, ale nie skonfigurowano jego pliku ingress w Settings." });
  if (config.tunnel?.enabled && portInUse) messages.push({ level: "warning", text: `Port ${config.tunnel.localPort} jest już używany; zostanie użyty jako źródło tunelu.` });

  return {
    ok: !messages.some((message) => message.level === "error"),
    repoState,
    composeFile,
    services,
    profiles,
    portInUse,
    messages,
  };
}

async function cloudflareScript(config: DeploymentConfig): Promise<string> {
  if (!config.tunnel?.enabled) return "";
  const settings = await getCloudflareTunnelSettings();
  const configPath = settings.configPath;
  if (!configPath) throw new Error("Brak CLOUDFLARED_CONFIG_PATH dla integracji Cloudflare Tunnel.");
  const needsSudo = settings.useSudo;
  const reloadCommand = getCloudflareReloadCommand(settings);
  const tunnelName = settings.tunnelName;
  const { hostname, localPort } = config.tunnel;

return `
echo "=== Cloudflare Tunnel ==="
route_update="$(${needsSudo ? "sudo -n " : ""}python3 - ${shellQuote(configPath)} ${shellQuote(hostname)} ${shellQuote(String(localPort))} <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
hostname = sys.argv[2].lower()
port = int(sys.argv[3])
if not path.is_file(): raise SystemExit(f"cloudflared config not found: {path}")
text = path.read_text()
if "ingress:" not in text: raise SystemExit("cloudflared config has no ingress section")
lines = text.splitlines(keepends=True)
result, index = [], 0
while index < len(lines):
    line = lines[index]
    match = re.match(r"^(\\s*)-\\s+hostname:\\s*(\\S+)\\s*$", line)
    if match and match.group(2).lower() == hostname:
        index += 1
        while index < len(lines) and not re.match(r"^\\s*-\\s+hostname:", lines[index]) and not re.match(r"^\\s*-\\s+service:\\s*http_status:404", lines[index]): index += 1
        continue
    result.append(line); index += 1
insert_at = next((i for i, line in enumerate(result) if re.match(r"^\\s*-\\s+service:\\s*http_status:404", line)), None)
if insert_at is None: raise SystemExit("cloudflared config needs a final http_status:404 ingress rule")
rule = [f"  - hostname: {hostname}\\n", f"    service: http://127.0.0.1:{port}\\n"]
result[insert_at:insert_at] = rule
updated = "".join(result)
if updated == text:
    print("CONFIG_CHANGED=0")
    raise SystemExit(0)
temp = path.with_suffix(path.suffix + ".dashboard-tmp")
temp.write_text(updated); temp.replace(path)
print("CONFIG_CHANGED=1")
PY
 )"
echo "$route_update"
${needsSudo ? "sudo -n " : ""}cloudflared --config ${shellQuote(configPath)} tunnel ingress validate
${tunnelName ? `cloudflared tunnel route dns ${shellQuote(tunnelName)} ${shellQuote(hostname)} || echo "DNS route already exists or requires Cloudflare credentials"` : ""}
if [ "$route_update" = "CONFIG_CHANGED=1" ]; then
  ${reloadCommand}
else
  echo "Cloudflare ingress route unchanged; tunnel restart skipped."
fi
echo "Cloudflare route active: https://${hostname} -> 127.0.0.1:${localPort}"
`;
}

export async function listCloudflareTunnelRoutes(): Promise<{ configured: boolean; routes: TunnelIngressRoute[]; error?: string }> {
  const settings = await getCloudflareTunnelSettings();
  if (!settings.configPath) return { configured: false, routes: [] };

  const readCommand = `set -eu
${settings.useSudo ? "sudo -n " : ""}cat ${shellQuote(settings.configPath)} | awk '
  /^[[:space:]]*-[[:space:]]+hostname:[[:space:]]*/ { hostname=$3; gsub(/"/,"",hostname); next }
  hostname != "" && /^[[:space:]]+service:[[:space:]]*/ { service=$2; gsub(/"/,"",service); print hostname "|" service; hostname="" }
'`;
  const result = await runHostCommand(readCommand, 10_000);
  if (!result.success) return { configured: true, routes: [], error: result.stderr || "Nie udało się odczytać ingress Cloudflare Tunnel." };

  const parsedRoutes = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hostname, service] = line.split("|", 2);
      return hostname && service ? { hostname, service } : null;
    })
    .filter((route): route is TunnelIngressRoute => Boolean(route));
  const routes = [...new Map(parsedRoutes.map((route) => [`${route.hostname}|${route.service}`, route])).values()];
  return { configured: true, routes };
}

export async function startDeploymentJob(config: DeploymentConfig): Promise<{ logFile: string; pid: string }> {
  requireSafeConfig(config);
  const repoPath = validateRepoPath(config.repoPath);
  const parentPath = repoPath.slice(0, repoPath.lastIndexOf("/"));
  const fileName = `deploy-${config.composeProject}-${Date.now()}.log`;
  const logFile = `${DEPLOY_LOG_DIR}/${fileName}`;
  const scriptFile = `${DEPLOY_LOG_DIR}/${fileName}.sh`;
  const composeFile = config.composeFile ? `${repoPath}/${config.composeFile}` : "";
  const profileFlags = config.profiles.map((profile) => `--profile ${shellQuote(profile)}`).join(" ");
  const cloneToken = await getRepositoryCloneToken(config.githubUrl).catch(() => null);
  const parsedRepository = parseGitHubUrl(config.githubUrl);
  const repositoryUrl = cloneToken && parsedRepository
    ? `https://github.com/${parsedRepository.owner}/${parsedRepository.repo}.git`
    : config.githubUrl;
  const gitAuthentication = cloneToken
    ? `# GitHub App token: repository-scoped and valid only for this job\nexport GIT_CONFIG_GLOBAL=/dev/null\nexport GIT_CONFIG_COUNT=1\nexport GIT_CONFIG_KEY_0=http.https://github.com/.extraheader\nexport GIT_CONFIG_VALUE_0=${shellQuote(`Authorization: Basic ${Buffer.from(`x-access-token:${cloneToken}`, "utf8").toString("base64")}`)}`
    : "";
  const tunnelScript = await cloudflareScript(config);

  const script = `#!/bin/sh
set -eu
${cloneToken ? 'rm -f -- "$0"' : ""}
echo "=== DEPLOY_START ==="
echo "PROJECT: ${config.composeProject}"
echo "STARTED_AT: $(date -Iseconds)"
finish() {
  code=$?
  trap - EXIT
  echo "===[DEPLOY_COMPLETE]==="
  if [ $code -eq 0 ]; then echo "STATUS: SUCCESS"; else echo "STATUS: FAILED"; fi
  echo "FINISHED_AT: $(date -Iseconds)"
  exit $code
}
trap finish EXIT
${gitAuthentication}
mkdir -p ${shellQuote(parentPath)}
if [ -d ${shellQuote(`${repoPath}/.git`)} ]; then
  echo "=== Git pull ==="
  git -C ${shellQuote(repoPath)} fetch --prune origin
  git -C ${shellQuote(repoPath)} checkout ${shellQuote(config.branch)}
  git -C ${shellQuote(repoPath)} pull --ff-only origin ${shellQuote(config.branch)}
else
  if [ -e ${shellQuote(repoPath)} ]; then echo "Target exists but is not a Git checkout" >&2; exit 20; fi
  echo "=== Git clone ==="
  git clone --branch ${shellQuote(config.branch)} --single-branch ${shellQuote(repositoryUrl)} ${shellQuote(repoPath)}
fi
COMPOSE_FILE=${shellQuote(composeFile)}
if [ -z "$COMPOSE_FILE" ]; then
  for candidate in compose.yaml compose.yml docker-compose.yaml docker-compose.yml; do
    if [ -f ${shellQuote(repoPath)}/$candidate ]; then COMPOSE_FILE=${shellQuote(repoPath)}/$candidate; break; fi
  done
fi
if [ -z "$COMPOSE_FILE" ] || [ ! -f "$COMPOSE_FILE" ]; then echo "No Compose file found" >&2; exit 21; fi
echo "=== Compose validation ==="
docker compose -f "$COMPOSE_FILE" config -q
echo "=== Docker Compose ==="
docker compose -f "$COMPOSE_FILE" -p ${shellQuote(config.composeProject)} ${profileFlags} up -d --build
${tunnelScript}
`;
  const encodedScript = Buffer.from(script, "utf8").toString("base64");
  const launch = `mkdir -p ${shellQuote(DEPLOY_LOG_DIR)} && printf %s ${shellQuote(encodedScript)} | base64 -d > ${shellQuote(scriptFile)} && chmod 700 ${shellQuote(scriptFile)} && (nohup setsid sh ${shellQuote(scriptFile)} </dev/null > ${shellQuote(logFile)} 2>&1 & echo "PID=$!"; echo "LOG=${logFile}")`;
  const result = await runHostCommand(launch, 20_000);
  if (!result.success) throw new Error(result.stderr || result.stdout || "Nie udało się uruchomić zadania wdrożeniowego.");
  const pid = /^PID=(.+)$/m.exec(result.stdout)?.[1]?.trim();
  if (!pid) throw new Error("Runner nie potwierdził uruchomienia procesu wdrożeniowego.");
  return { logFile, pid };
}
