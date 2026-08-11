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

export interface CloudflareRouteUpdate {
  hostname: string | null;
  localPort: number | null;
  removeHostnames?: string[];
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

/**
 * Reserve a predictable port for a managed Compose project. A port already
 * published by the same Compose project is reusable during a redeploy; every
 * other listener is treated as a collision and the next available port is
 * selected.
 */
export async function allocateDeploymentPort(preferredPort: number, composeProject: string): Promise<number> {
  if (!Number.isInteger(preferredPort) || preferredPort < 1 || preferredPort > 65535) {
    throw new Error("Port wdrożenia musi być liczbą od 1 do 65535.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(composeProject)) {
    throw new Error("Nieprawidłowa nazwa projektu Docker Compose.");
  }

  const candidates = [preferredPort, ...Array.from({ length: 1000 }, (_, index) => 3000 + index)]
    .filter((port, index, ports) => ports.indexOf(port) === index);
  const command = `set -eu
LISTENING_PORTS="$(ss -ltnH 2>/dev/null | awk '{ split($4, parts, ":"); print parts[length(parts)] }' | sort -u)"
for candidate in ${candidates.join(" ")}; do
  if docker ps --filter ${shellQuote(`label=com.docker.compose.project=${composeProject}`)} --format '{{.Ports}}' | grep -Eq "(^|[, ]).+:\${candidate}->"; then
    echo "PORT=$candidate"
    exit 0
  fi
  if ! printf '%s\\n' "$LISTENING_PORTS" | grep -qx "$candidate"; then
    echo "PORT=$candidate"
    exit 0
  fi
done
echo "Nie znaleziono wolnego portu w zakresie 3000-3999." >&2
exit 1`;
  const result = await runHostCommand(command, 15_000);
  const match = /^PORT=(\d+)$/m.exec(result.stdout);
  if (!result.success || !match) {
    throw new Error(result.stderr || result.stdout || "Nie udało się przydzielić wolnego portu.");
  }
  return Number(match[1]);
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
  return buildCloudflareRouteScript({
    hostname: config.tunnel.hostname,
    localPort: config.tunnel.localPort,
  });
}

function isSafeHostname(value: string): boolean {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
}

async function buildCloudflareRouteScript(update: CloudflareRouteUpdate): Promise<string> {
  const hostname = update.hostname?.trim().toLowerCase() || "";
  const localPort = update.localPort || 0;
  const removeHostnames = [...new Set((update.removeHostnames || []).map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (hostname && !isSafeHostname(hostname)) throw new Error("Nieprawidłowa domena Cloudflare Tunnel.");
  if (hostname && (!Number.isInteger(localPort) || localPort < 1 || localPort > 65535)) {
    throw new Error("Port tunelu musi być liczbą od 1 do 65535.");
  }
  if (removeHostnames.some((value) => !isSafeHostname(value))) throw new Error("Nieprawidłowa domena do usunięcia z Cloudflare Tunnel.");

  const settings = await getCloudflareTunnelSettings();
  if (!settings.configPath) throw new Error("Brak pliku ingress Cloudflare Tunnel w Settings.");
  const removeArguments = removeHostnames.map(shellQuote).join(" ");

  return `
echo "=== Cloudflare Tunnel ==="
route_update="$(${settings.useSudo ? "sudo -n " : ""}python3 - ${shellQuote(settings.configPath)} ${shellQuote(hostname)} ${shellQuote(String(localPort))} ${removeArguments} <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
hostname = sys.argv[2].lower() or None
port = int(sys.argv[3])
remove = {value.lower() for value in sys.argv[4:]}
if hostname: remove.add(hostname)
if not path.is_file(): raise SystemExit(f"cloudflared config not found: {path}")
text = path.read_text()
if "ingress:" not in text: raise SystemExit("cloudflared config has no ingress section")
lines = text.splitlines(keepends=True)
result, index = [], 0
while index < len(lines):
    line = lines[index]
    match = re.match(r"^(\\s*)-\\s+hostname:\\s*(\\S+)\\s*$", line)
    if match and match.group(2).lower() in remove:
        index += 1
        while index < len(lines) and not re.match(r"^\\s*-\\s+hostname:", lines[index]) and not re.match(r"^\\s*-\\s+service:\\s*http_status:404", lines[index]): index += 1
        continue
    result.append(line); index += 1
insert_at = next((i for i, line in enumerate(result) if re.match(r"^\\s*-\\s+service:\\s*http_status:404", line)), None)
if insert_at is None: raise SystemExit("cloudflared config needs a final http_status:404 ingress rule")
if hostname:
    result[insert_at:insert_at] = [f"  - hostname: {hostname}\\n", f"    service: http://127.0.0.1:{port}\\n"]
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
${settings.useSudo ? "sudo -n " : ""}cloudflared --config ${shellQuote(settings.configPath)} tunnel ingress validate
${settings.tunnelName && hostname ? `cloudflared tunnel route dns ${shellQuote(settings.tunnelName)} ${shellQuote(hostname)} || echo "DNS route already exists or requires Cloudflare credentials"` : ""}
if [ "$route_update" = "CONFIG_CHANGED=1" ]; then
  ${getCloudflareReloadCommand(settings)}
else
  echo "Cloudflare ingress route unchanged; tunnel restart skipped."
fi
${hostname ? `echo "Cloudflare route active: https://${hostname} -> 127.0.0.1:${localPort}"` : 'echo "Cloudflare route removed."'}
`;
}

export async function updateCloudflareTunnelRoute(update: CloudflareRouteUpdate): Promise<{ changed: boolean }> {
  const result = await runHostCommand(await buildCloudflareRouteScript(update), 30_000);
  if (!result.success) throw new Error(result.stderr || result.stdout || "Nie udało się zaktualizować Cloudflare Tunnel.");
  return { changed: /CONFIG_CHANGED=1/.test(result.stdout) };
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
  const assignedTunnelPort = config.tunnel?.enabled ? config.tunnel.localPort : 0;
  const composeOverrideFile = `${DEPLOY_LOG_DIR}/compose-overrides/${config.composeProject}.yaml`;
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
COMPOSE_OVERRIDE=""
if [ ${assignedTunnelPort} -gt 0 ]; then
  echo "=== Port assignment ==="
  python3 - "$COMPOSE_FILE" ${shellQuote(composeOverrideFile)} ${shellQuote(String(assignedTunnelPort))} <<'PY'
import json, pathlib, subprocess, sys
compose_file, override_file, assigned_port = sys.argv[1], pathlib.Path(sys.argv[2]), int(sys.argv[3])
resolved = subprocess.run(
    ["docker", "compose", "-f", compose_file, "config", "--format", "json"],
    text=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)
if resolved.returncode:
    raise SystemExit(resolved.stderr.strip() or "docker compose config failed")
# Compose writes compatibility warnings (for example an obsolete version
# field) to stderr. Do not merge those diagnostics into JSON output: doing so
# made a harmless warning abort automatic port assignment.
raw = resolved.stdout.strip()
if not raw:
    raise SystemExit("docker compose config returned no JSON")
services = json.loads(raw).get("services", {})
candidates = []
for service_name, service in services.items():
    for port in service.get("ports") or []:
        if not isinstance(port, dict) or not port.get("published") or not port.get("target"): continue
        if str(port.get("protocol") or "tcp") != "tcp": continue
        candidates.append((service_name, str(port["published"]), int(port["target"])))
matching = [candidate for candidate in candidates if candidate[1] == str(assigned_port)]
if len(candidates) == 1:
    service_name, published_port, target_port = candidates[0]
elif len(matching) == 1:
    service_name, published_port, target_port = matching[0]
else:
    raise SystemExit("Automatic port assignment needs one published TCP port (or one already mapped to the selected port).")
if published_port == str(assigned_port):
    override_file.unlink(missing_ok=True)
    print("PORT_OVERRIDE=unchanged")
    raise SystemExit(0)
override_file.parent.mkdir(parents=True, exist_ok=True)
override_file.write_text(
    "services:\\n"
    f"  {json.dumps(service_name)}:\\n"
    "    ports: !override\\n"
    f"      - {json.dumps(f'{assigned_port}:{target_port}/tcp')}\\n"
)
print(f"PORT_OVERRIDE={override_file}")
PY
  if [ -f ${shellQuote(composeOverrideFile)} ]; then COMPOSE_OVERRIDE=${shellQuote(composeOverrideFile)}; fi
fi
echo "=== Compose validation ==="
if [ -n "$COMPOSE_OVERRIDE" ]; then docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_OVERRIDE" config -q; else docker compose -f "$COMPOSE_FILE" config -q; fi
echo "=== Docker Compose ==="
if [ -n "$COMPOSE_OVERRIDE" ]; then docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_OVERRIDE" -p ${shellQuote(config.composeProject)} ${profileFlags} up -d --build; else docker compose -f "$COMPOSE_FILE" -p ${shellQuote(config.composeProject)} ${profileFlags} up -d --build; fi
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
