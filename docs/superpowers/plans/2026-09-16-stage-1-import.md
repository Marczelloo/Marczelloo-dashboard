# Etap 1 — model aplikacji, renderer i import tylko do odczytu — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zeskanować stan Pi (kontenery, Compose, pliki env, tunel), zaproponować przypisanie do projektów z planem env i testem renderera na sucho, a po zatwierdzeniu zapisać konfigurację, wersję env, trasy i snapshoty — bez dotykania działających kontenerów.

**Architecture:** Kolektor wykonuje wyłącznie polecenia odczytu przez istniejący runner (`runHostCommand`) i zwraca `InventorySnapshot`. Czyste funkcje (parsery, dopasowania, plan env, renderer, dry-run) budują `ImportProposal`, trzymany po stronie serwera przez 30 minut. Do przeglądarki trafia widok bez wartości zmiennych. Zapis tworzy wiersze w czterech nowych tabelach AtlasHub; wartości env i snapshoty są szyfrowane istniejącym `encrypt()`.

**Tech Stack:** Next.js 16 server actions, TypeScript strict, zod 3, `yaml` 2 (nowa zależność), vitest (z etapu 0), AtlasHub REST + Schema API.

**Spec:** `docs/superpowers/specs/2026-09-15-deploy-platform-rebuild-design.md`

**Wymaga ukończonego etapu 0:** `vitest`, `src/server/deployments/routing.ts` (`parseLocalPortFromService`), `src/server/env/dotenv.ts` (`parseEnvEntries`, `EnvEntry`), `requirePinVerification` bez obejścia w produkcji.

## Global Constraints

- Kolektor i import **nie mogą** zmieniać stanu Pi: tylko `docker inspect`, `docker image inspect`, `docker compose … config`, `cat`, `ls`, `git rev-parse`, `git remote get-url`.
- Nazwy projektów Compose są niezmienne; renderer ustawia `name` na obecną nazwę i przypina nazwy wolumenów.
- Wartości env nigdy nie trafiają do komponentów klienckich ani logów; widok w UI zawiera tylko nazwy kluczy, pochodzenie i flagi konfliktów.
- Źródło prawdy env: kontener > plik env > `environment:` z compose > baza dashboardu (tylko podpowiedź, domyślnie wyłączona). Zmienne wbudowane w obraz z tą samą wartością są pomijane.
- Baza tylko przez REST AtlasHub (`/v1/db`, ≤ 1000 wierszy na żądanie); tabele przez Schema API z `ifNotExists: true`.
- Tekst UI po polsku; commity po angielsku.
- Operacje na Pi (migracja tabel, skan produkcyjny) wymagają zgody właściciela w chwili wykonania.

## Mapa plików

| Plik | Odpowiedzialność |
|---|---|
| `src/server/apps/types.ts` | typy snapshotu i konfiguracji Compose |
| `src/server/apps/inventory/sections.ts` (+test) | protokół sekcji w wyjściu powłoki |
| `src/server/apps/inventory/docker-facts.ts` (+test) | `docker inspect` → `ContainerFact` |
| `src/server/apps/inventory/ingress.ts` (+test) | `config.yml` cloudflared → `IngressRule[]` |
| `src/server/apps/inventory/compose-files.ts` (+test) | odwołania `env_file` z plików compose |
| `src/server/apps/import/match-projects.ts` (+test) | stack Compose → projekt dashboardu |
| `src/server/apps/import/match-routes.ts` (+test) | reguła ingress → kontener / host |
| `src/server/apps/import/env-plan.ts` (+test) | plan importu env z pochodzeniem i konfliktami |
| `src/server/apps/render/compose-render.ts` (+test) | renderer i test na sucho |
| `src/server/apps/import/proposal.ts` (+test) | złożenie propozycji i widok bez wartości |
| `src/server/apps/import/persist-rows.ts` (+test) | wiersze do zapisu, odcisk env |
| `src/server/apps/inventory/commands.ts` (+test) | polecenia odczytu i parsery ich wyniku |
| `src/server/apps/collector.ts` | wywołania runnera i złożenie snapshotu |
| `src/server/apps/proposal-store.ts` | pamięć propozycji (TTL 30 min) |
| `src/server/atlashub/app-import.ts` | repozytorium nowych tabel |
| `src/server/apps/import/save-import.ts` | zapis zatwierdzonego importu |
| `scripts/migrations/2026-09-16-app-import-tables.ts` | tabele `app_configs`, `app_env_versions`, `app_routes`, `app_snapshots` |
| `src/app/actions/app-import.ts` | akcje: skan i zapis |
| `src/app/(dashboard)/import/page.tsx`, `_components/import-wizard.tsx` | ekran importu |
| `src/components/layout/sidebar.tsx` | pozycja „Import” |
| `docs/runbooks/2026-09-16-stage-1-import.md` | wykonanie i weryfikacja na Pi |

---

### Task 1: Typy i protokół sekcji

**Files:**
- Create: `src/server/apps/types.ts`
- Create: `src/server/apps/inventory/sections.ts`
- Test: `src/server/apps/inventory/sections.test.ts`

**Interfaces:**
- Produces (types.ts):

```ts
export interface PortBinding { hostIp: string; hostPort: number; containerPort: number; protocol: string }
export interface MountFact { type: string; name: string | null; source: string; destination: string; readOnly: boolean }
export interface ContainerFact {
  id: string; name: string; image: string; imageId: string; status: string; createdAt: string;
  composeProject: string | null; composeService: string | null; oneOff: boolean;
  workingDir: string | null; configFiles: string[];
  env: Record<string, string>; labels: Record<string, string>;
  ports: PortBinding[]; mounts: MountFact[]; networks: string[];
}
export interface IngressRule { position: number; hostname: string | null; path: string | null; service: string; originRequest: Record<string, unknown> | null }
export interface ComposePort { target: number; published?: string; host_ip?: string; protocol?: string }
export interface ComposeVolumeMount { type: string; source?: string; target: string; read_only?: boolean }
export interface ComposeServiceConfig {
  image?: string; build?: unknown; container_name?: string;
  environment?: Record<string, string | null>; ports?: ComposePort[]; volumes?: ComposeVolumeMount[];
  labels?: Record<string, string>; logging?: unknown; restart?: string; profiles?: string[];
  [key: string]: unknown;
}
export interface ComposeConfig {
  name?: string; services: Record<string, ComposeServiceConfig>;
  volumes?: Record<string, { name?: string; external?: boolean } | null>;
  networks?: Record<string, unknown>; [key: string]: unknown;
}
export interface EnvFileSnapshot { path: string; content: string | null }
export interface GitFact { head: string; remote: string | null }
export interface StackSnapshot {
  project: string; workingDir: string | null; configFiles: string[]; containers: ContainerFact[];
  composeConfig: ComposeConfig | null; composeConfigError: string | null;
  envFiles: EnvFileSnapshot[]; otherEnvFiles: string[]; git: GitFact | null;
}
export interface InventorySnapshot {
  capturedAt: string; stacks: StackSnapshot[]; looseContainers: ContainerFact[];
  imageEnv: Record<string, Record<string, string>>;
  ingress: { rules: IngressRule[]; error: string | null };
}
```

- Produces (sections.ts): `export interface Section { kind: string; id: string; exitCode: number; body: string }`, `export function sectionCommand(kind: string, id: string, command: string): string`, `export function parseSections(stdout: string): Section[]`

- [ ] **Step 1: Utwórz `src/server/apps/types.ts`** z treścią z bloku „Produces (types.ts)” powyżej (każdy interfejs w osobnych liniach, bez zmian nazw).

- [ ] **Step 2: Test `src/server/apps/inventory/sections.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseSections, sectionCommand } from "./sections";

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

describe("sectionCommand", () => {
  it("wraps the command with markers and captures its exit code", () => {
    const command = sectionCommand("env-file", "/home/Marczelloo_pi/projects/atlas-hub/.env", "cat '/x'");
    expect(command).toContain('echo "@@MZ:BEGIN env-file /home/Marczelloo_pi/projects/atlas-hub/.env"');
    expect(command).toContain("if { cat '/x' ; } >\"$mz_tmp\" 2>/dev/null; then mz_code=0; else mz_code=$?; fi");
    expect(command).toContain('echo "@@MZ:END env-file /home/Marczelloo_pi/projects/atlas-hub/.env $mz_code"');
  });

  it("rejects ids that could break the protocol", () => {
    expect(() => sectionCommand("env-file", "/path with space", "true")).toThrow();
    expect(() => sectionCommand("Env", "x", "true")).toThrow();
  });
});

describe("parseSections", () => {
  it("decodes bodies and exit codes", () => {
    const stdout = [
      "noise",
      "@@MZ:BEGIN docker-inspect all",
      b64('[{"Id":"1"}]'),
      "@@MZ:END docker-inspect all 0",
      "@@MZ:BEGIN git neobeatbuddy",
      "",
      "@@MZ:END git neobeatbuddy 128",
    ].join("\n");
    expect(parseSections(stdout)).toEqual([
      { kind: "docker-inspect", id: "all", exitCode: 0, body: '[{"Id":"1"}]' },
      { kind: "git", id: "neobeatbuddy", exitCode: 128, body: "" },
    ]);
  });

  it("fails on a truncated section", () => {
    expect(() => parseSections("@@MZ:BEGIN git x\nYWJj\n")).toThrow(/Uszkodzona/);
  });
});
```

- [ ] **Step 3: Uruchom — FAIL**

Run: `npx vitest run src/server/apps/inventory/sections.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 4: Implementacja `src/server/apps/inventory/sections.ts`**

```ts
export interface Section {
  kind: string;
  id: string;
  exitCode: number;
  body: string;
}

const KIND = /^[a-z][a-z-]*$/;
const ID = /^[A-Za-z0-9_.:/@+-]+$/;

/**
 * Runs `command`, then prints its stdout base64-encoded between markers so
 * arbitrary file content cannot collide with the protocol.
 */
export function sectionCommand(kind: string, id: string, command: string): string {
  if (!KIND.test(kind) || !ID.test(id)) throw new Error(`Nieprawidłowa sekcja: ${kind} ${id}`);
  return [
    'mz_tmp="$(mktemp)"',
    `if { ${command} ; } >"$mz_tmp" 2>/dev/null; then mz_code=0; else mz_code=$?; fi`,
    `echo "@@MZ:BEGIN ${kind} ${id}"`,
    'base64 -w0 "$mz_tmp"; echo',
    `echo "@@MZ:END ${kind} ${id} $mz_code"`,
    'rm -f "$mz_tmp"',
  ].join("\n");
}

export function parseSections(stdout: string): Section[] {
  const lines = stdout.split("\n").map((line) => line.trim());
  const sections: Section[] = [];

  for (let index = 0; index < lines.length; index++) {
    const begin = /^@@MZ:BEGIN (\S+) (\S+)$/.exec(lines[index]);
    if (!begin) continue;
    const end = /^@@MZ:END (\S+) (\S+) (\d+)$/.exec(lines[index + 2] ?? "");
    if (!end || end[1] !== begin[1] || end[2] !== begin[2]) {
      throw new Error(`Uszkodzona sekcja wyjścia: ${begin[1]} ${begin[2]}`);
    }
    sections.push({
      kind: begin[1],
      id: begin[2],
      exitCode: Number(end[3]),
      body: Buffer.from(lines[index + 1] ?? "", "base64").toString("utf8"),
    });
    index += 2;
  }

  return sections;
}
```

- [ ] **Step 5: Uruchom — PASS**

Run: `npx vitest run src/server/apps/inventory/sections.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/apps/types.ts src/server/apps/inventory/sections.ts src/server/apps/inventory/sections.test.ts
git commit -m "feat: add inventory types and shell section protocol"
```

---

### Task 2: Parsery `docker inspect`, ingress cloudflared i `env_file`

**Files:**
- Modify: `package.json` (zależność `yaml`)
- Create: `src/server/apps/inventory/docker-facts.ts`
- Test: `src/server/apps/inventory/docker-facts.test.ts`
- Create: `src/server/apps/inventory/ingress.ts`
- Test: `src/server/apps/inventory/ingress.test.ts`
- Create: `src/server/apps/inventory/compose-files.ts`
- Test: `src/server/apps/inventory/compose-files.test.ts`

**Interfaces:**
- Consumes: typy z Task 1.
- Produces:
  - `export function parseDockerInspect(json: string): ContainerFact[]`
  - `export function groupByComposeProject(containers: ContainerFact[]): { stacks: Map<string, ContainerFact[]>; loose: ContainerFact[] }`
  - `export function parseIngressConfig(raw: string): IngressRule[]`
  - `export function countHostnames(rules: IngressRule[]): number`
  - `export function extractEnvFileRefs(rawYaml: string, composeFilePath: string): string[]`

- [ ] **Step 1: Zależność**

```bash
npm install yaml@^2.8.1
```

- [ ] **Step 2: Test `docker-facts.test.ts`** (wartości fikcyjne, kształt jak na Pi)

```ts
import { describe, expect, it } from "vitest";
import { groupByComposeProject, parseDockerInspect } from "./docker-facts";

const inspect = JSON.stringify([
  {
    Id: "c1",
    Name: "/marczelloo-drive",
    Created: "2026-08-29T13:03:00Z",
    Image: "sha256:" + "a".repeat(64),
    State: { Status: "running" },
    Config: {
      Image: "marczelloo-drive-drive",
      Env: ["PATH=/usr/bin", "ATLASHUB_API_URL=https://api.example", "EMPTY=", "WITH_EQ=a=b"],
      Labels: {
        "com.docker.compose.project": "marczelloo-drive",
        "com.docker.compose.service": "drive",
        "com.docker.compose.project.working_dir": "/home/Marczelloo_pi/projects/marczelloo-drive",
        "com.docker.compose.project.config_files": "/home/Marczelloo_pi/projects/marczelloo-drive/docker-compose.yml",
      },
    },
    NetworkSettings: {
      Ports: { "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: "3030" }], "9229/tcp": null },
      Networks: { "marczelloo-drive_default": {} },
    },
    Mounts: [],
  },
  {
    Id: "c2",
    Name: "/marczelloo-drive-compressor",
    Created: "2026-08-29T13:03:00Z",
    Image: "sha256:" + "a".repeat(64),
    State: { Status: "running" },
    Config: { Image: "marczelloo-drive-compressor", Env: null, Labels: { "com.docker.compose.project": "marczelloo-drive", "com.docker.compose.service": "compressor", "com.docker.compose.oneoff": "False" } },
    NetworkSettings: { Ports: {}, Networks: {} },
    Mounts: [{ Type: "volume", Name: "marczelloo-drive_compression-tmp", Source: "/var/lib/docker/volumes/x/_data", Destination: "/var/lib/marczelloo-drive/compression", RW: true }],
  },
  { Id: "c3", Name: "/standalone", Created: "2026-01-01T00:00:00Z", Image: "sha256:" + "b".repeat(64), State: { Status: "exited" }, Config: { Image: "busybox", Env: [], Labels: null }, NetworkSettings: null, Mounts: null },
]);

describe("parseDockerInspect", () => {
  it("normalizes names, labels, env, ports and mounts", () => {
    const [drive, compressor] = parseDockerInspect(inspect);
    expect(drive).toMatchObject({
      name: "marczelloo-drive",
      image: "marczelloo-drive-drive",
      status: "running",
      composeProject: "marczelloo-drive",
      composeService: "drive",
      oneOff: false,
      workingDir: "/home/Marczelloo_pi/projects/marczelloo-drive",
      configFiles: ["/home/Marczelloo_pi/projects/marczelloo-drive/docker-compose.yml"],
      env: { PATH: "/usr/bin", ATLASHUB_API_URL: "https://api.example", EMPTY: "", WITH_EQ: "a=b" },
      ports: [{ hostIp: "127.0.0.1", hostPort: 3030, containerPort: 3000, protocol: "tcp" }],
      networks: ["marczelloo-drive_default"],
    });
    expect(compressor.mounts).toEqual([
      { type: "volume", name: "marczelloo-drive_compression-tmp", source: "/var/lib/docker/volumes/x/_data", destination: "/var/lib/marczelloo-drive/compression", readOnly: false },
    ]);
  });

  it("groups by compose project and keeps loose containers", () => {
    const { stacks, loose } = groupByComposeProject(parseDockerInspect(inspect));
    expect([...stacks.keys()]).toEqual(["marczelloo-drive"]);
    expect(stacks.get("marczelloo-drive")).toHaveLength(2);
    expect(loose.map((container) => container.name)).toEqual(["standalone"]);
  });
});
```

- [ ] **Step 3: Test `ingress.test.ts`** (struktura jak `/etc/cloudflared/config.yml` na Pi)

```ts
import { describe, expect, it } from "vitest";
import { countHostnames, parseIngressConfig } from "./ingress";

const config = `tunnel: 00000000-0000-0000-0000-000000000000

ingress:
  - hostname: marczelloo.dev
    service: http://localhost:3200
  - hostname: dashboard.marczelloo.dev
    path: /api/github/webhook
    service: http://localhost:3100
  - hostname: dashboard.marczelloo.dev
    service: http://localhost:3100
  - hostname: storage-atlashub.marczelloo.dev
    service: http://127.0.0.1:9000
    originRequest:
      httpHostHeader: minio:9000

  - hostname: NadStrona.pl
    service: http://127.0.0.1:8080
  - service: http_status:404
`;

describe("parseIngressConfig", () => {
  it("keeps order, paths, origin requests and the catch-all rule", () => {
    const rules = parseIngressConfig(config);
    expect(rules).toHaveLength(6);
    expect(rules[1]).toEqual({ position: 1, hostname: "dashboard.marczelloo.dev", path: "/api/github/webhook", service: "http://localhost:3100", originRequest: null });
    expect(rules[3].originRequest).toEqual({ httpHostHeader: "minio:9000" });
    expect(rules[4].hostname).toBe("nadstrona.pl");
    expect(rules[5]).toEqual({ position: 5, hostname: null, path: null, service: "http_status:404", originRequest: null });
    expect(countHostnames(rules)).toBe(4);
  });

  it("rejects configs without ingress or with a rule missing service", () => {
    expect(() => parseIngressConfig("tunnel: x")).toThrow(/ingress/);
    expect(() => parseIngressConfig("ingress:\n  - hostname: a.pl\n")).toThrow(/service/);
  });
});
```

- [ ] **Step 4: Test `compose-files.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { extractEnvFileRefs } from "./compose-files";

describe("extractEnvFileRefs", () => {
  it("resolves string, list and object env_file entries relative to the compose file", () => {
    const yaml = `services:
  bot:
    env_file:
      - .env
      - path: ./config/extra.env
        required: false
  lavalink:
    env_file: ../shared/lavalink.env
  plain:
    image: busybox
  templated:
    env_file: \${ENV_FILE}
`;
    expect(extractEnvFileRefs(yaml, "/home/Marczelloo_pi/projects/neobeatbuddy/docker-compose.yml")).toEqual([
      "/home/Marczelloo_pi/projects/neobeatbuddy/.env",
      "/home/Marczelloo_pi/projects/neobeatbuddy/config/extra.env",
      "/home/Marczelloo_pi/projects/shared/lavalink.env",
    ]);
  });

  it("returns nothing for files without services", () => {
    expect(extractEnvFileRefs("x: 1", "/a/docker-compose.yml")).toEqual([]);
  });
});
```

- [ ] **Step 5: Uruchom — FAIL**

Run: `npx vitest run src/server/apps/inventory`
Expected: FAIL — brak modułów `docker-facts`, `ingress`, `compose-files`.

- [ ] **Step 6: Implementacja `docker-facts.ts`**

```ts
import type { ContainerFact, PortBinding } from "../types";

interface RawInspect {
  Id: string;
  Name: string;
  Created: string;
  Image: string;
  State?: { Status?: string } | null;
  Config?: { Image?: string; Env?: string[] | null; Labels?: Record<string, string> | null } | null;
  NetworkSettings?: {
    Ports?: Record<string, Array<{ HostIp: string; HostPort: string }> | null> | null;
    Networks?: Record<string, unknown> | null;
  } | null;
  Mounts?: Array<{ Type: string; Name?: string; Source: string; Destination: string; RW: boolean }> | null;
}

function parseEnvList(list: string[] | null | undefined): Record<string, string> {
  const env: Record<string, string> = {};
  for (const item of list ?? []) {
    const index = item.indexOf("=");
    if (index > 0) env[item.slice(0, index)] = item.slice(index + 1);
  }
  return env;
}

export function parseDockerInspect(json: string): ContainerFact[] {
  const raw = JSON.parse(json) as RawInspect[];
  return raw.map((item) => {
    const labels = item.Config?.Labels ?? {};
    const ports: PortBinding[] = [];
    for (const [key, bindings] of Object.entries(item.NetworkSettings?.Ports ?? {})) {
      const [containerPort, protocol = "tcp"] = key.split("/");
      for (const binding of bindings ?? []) {
        ports.push({ hostIp: binding.HostIp || "0.0.0.0", hostPort: Number(binding.HostPort), containerPort: Number(containerPort), protocol });
      }
    }
    ports.sort((a, b) => a.hostPort - b.hostPort || a.hostIp.localeCompare(b.hostIp));

    return {
      id: item.Id,
      name: item.Name.replace(/^\//, ""),
      image: item.Config?.Image ?? "",
      imageId: item.Image,
      status: item.State?.Status ?? "unknown",
      createdAt: item.Created,
      composeProject: labels["com.docker.compose.project"] ?? null,
      composeService: labels["com.docker.compose.service"] ?? null,
      oneOff: labels["com.docker.compose.oneoff"] === "True",
      workingDir: labels["com.docker.compose.project.working_dir"] ?? null,
      configFiles: (labels["com.docker.compose.project.config_files"] ?? "").split(",").filter(Boolean),
      env: parseEnvList(item.Config?.Env),
      labels,
      ports,
      mounts: (item.Mounts ?? []).map((mount) => ({
        type: mount.Type,
        name: mount.Name ?? null,
        source: mount.Source,
        destination: mount.Destination,
        readOnly: !mount.RW,
      })),
      networks: Object.keys(item.NetworkSettings?.Networks ?? {}).sort(),
    };
  });
}

export function groupByComposeProject(containers: ContainerFact[]): { stacks: Map<string, ContainerFact[]>; loose: ContainerFact[] } {
  const stacks = new Map<string, ContainerFact[]>();
  const loose: ContainerFact[] = [];
  for (const container of containers) {
    if (!container.composeProject) {
      loose.push(container);
      continue;
    }
    stacks.set(container.composeProject, [...(stacks.get(container.composeProject) ?? []), container]);
  }
  return { stacks, loose };
}
```

- [ ] **Step 7: Implementacja `ingress.ts`**

```ts
import { parse } from "yaml";
import type { IngressRule } from "../types";

export function parseIngressConfig(raw: string): IngressRule[] {
  const document = parse(raw) as { ingress?: unknown } | null;
  if (!document || !Array.isArray(document.ingress)) {
    throw new Error("Konfiguracja cloudflared nie ma sekcji ingress.");
  }

  return document.ingress.map((rule, position) => {
    const value = rule as { hostname?: unknown; path?: unknown; service?: unknown; originRequest?: unknown } | null;
    if (!value || typeof value.service !== "string") {
      throw new Error(`Reguła ingress #${position + 1} nie ma pola service.`);
    }
    return {
      position,
      hostname: typeof value.hostname === "string" ? value.hostname.toLowerCase() : null,
      path: typeof value.path === "string" ? value.path : null,
      service: value.service,
      originRequest: value.originRequest && typeof value.originRequest === "object" ? (value.originRequest as Record<string, unknown>) : null,
    };
  });
}

export function countHostnames(rules: IngressRule[]): number {
  return new Set(rules.map((rule) => rule.hostname).filter(Boolean)).size;
}
```

- [ ] **Step 8: Implementacja `compose-files.ts`**

```ts
import path from "node:path";
import { parse } from "yaml";

export function extractEnvFileRefs(rawYaml: string, composeFilePath: string): string[] {
  const document = parse(rawYaml) as { services?: Record<string, { env_file?: unknown } | null> } | null;
  const directory = path.posix.dirname(composeFilePath);
  const refs = new Set<string>();

  for (const service of Object.values(document?.services ?? {})) {
    const envFile = service?.env_file;
    const entries = Array.isArray(envFile) ? envFile : envFile === undefined ? [] : [envFile];
    for (const entry of entries) {
      const value =
        typeof entry === "string"
          ? entry
          : entry && typeof entry === "object" && typeof (entry as { path?: unknown }).path === "string"
            ? (entry as { path: string }).path
            : null;
      if (!value || value.includes("${")) continue;
      refs.add(path.posix.normalize(path.posix.isAbsolute(value) ? value : path.posix.join(directory, value)));
    }
  }

  return [...refs].sort();
}
```

- [ ] **Step 9: Uruchom — PASS**

Run: `npx vitest run src/server/apps/inventory`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/server/apps/inventory
git commit -m "feat: parse docker inspect, cloudflared ingress and compose env_file refs"
```

---

### Task 3: Dopasowanie stacków do projektów i tras do kontenerów

**Files:**
- Create: `src/server/apps/import/match-projects.ts`
- Test: `src/server/apps/import/match-projects.test.ts`
- Create: `src/server/apps/import/match-routes.ts`
- Test: `src/server/apps/import/match-routes.test.ts`

**Interfaces:**
- Consumes: `ContainerFact`, `IngressRule` (Task 1); `parseLocalPortFromService` (etap 0, `@/server/deployments/routing`); `Project`, `Service` z `@/types`.
- Produces:
  - `export interface ProjectMatch { projectId: string | null; confidence: "high" | "medium" | "none"; reasons: string[] }`
  - `export interface StackIdentity { project: string; workingDir: string | null; containerNames: string[]; gitRemote: string | null }`
  - `export function normalizeName(value: string): string`
  - `export function repoKey(url: string | null | undefined): string | null`
  - `export function matchStackToProject(stack: StackIdentity, projects: Array<Pick<Project, "id" | "name" | "slug" | "github_url">>, services: Array<Pick<Service, "project_id" | "compose_project" | "container_id">>, deploymentConfigs: Array<{ projectId: string; composeProject: string }>): ProjectMatch`
  - `export type RouteTarget = { kind: "container"; composeProject: string | null; service: string | null; containerName: string; containerPort: number } | { kind: "host"; port: number } | { kind: "status"; status: string } | { kind: "other"; url: string }`
  - `export interface RouteMatch { rule: IngressRule; target: RouteTarget }`
  - `export function matchIngressRoutes(rules: IngressRule[], containers: ContainerFact[]): RouteMatch[]`

- [ ] **Step 1: Test `match-projects.test.ts`** (dane jak w bazie 15.09)

```ts
import { describe, expect, it } from "vitest";
import { matchStackToProject, normalizeName, repoKey } from "./match-projects";

const projects = [
  { id: "atlas", name: "AtlasHub", slug: "atlashub", github_url: "https://github.com/Marczelloo/atlashub" },
  { id: "dash", name: "Marczelloo Dashboard", slug: "marczelloo-dashboard", github_url: "https://github.com/Marczelloo/Marczelloo-dashboard" },
  { id: "neo", name: "NeoBeat Buddy", slug: "neobeat-buddy", github_url: "https://github.com/Marczelloo/NeoBeat-Buddy" },
  { id: "book", name: "Bookhaven", slug: "bookhaven", github_url: "https://github.com/Marczelloo/BookHaven" },
];
const services = [
  { project_id: "atlas", compose_project: "atlas-hub", container_id: "atlashub-gateway" },
  { project_id: "dash", compose_project: "marczelloodashboard", container_id: "marczelloo-dashboard" },
  { project_id: "neo", compose_project: "neobeatbuddy", container_id: "neo-lavalink" },
];

describe("helpers", () => {
  it("normalizes names and GitHub URLs", () => {
    expect(normalizeName("Atlas-Hub")).toBe("atlashub");
    expect(repoKey("git@github.com:Marczelloo/atlas-hub.git")).toBe("marczelloo/atlashub");
    expect(repoKey("https://github.com/Marczelloo/atlashub")).toBe("marczelloo/atlashub");
    expect(repoKey(null)).toBeNull();
  });
});

describe("matchStackToProject", () => {
  it("matches by container name even when compose_project is wrong", () => {
    const match = matchStackToProject(
      { project: "marczelloo-dashboard", workingDir: "/home/Marczelloo_pi/projects/Marczelloo-dashboard", containerNames: ["marczelloo-dashboard", "marczelloo-runner"], gitRemote: "git@github.com:Marczelloo/Marczelloo-dashboard.git" },
      projects, services, []
    );
    expect(match).toMatchObject({ projectId: "dash", confidence: "high" });
  });

  it("matches renamed repositories and compose project names", () => {
    expect(
      matchStackToProject({ project: "atlas-hub", workingDir: "/home/Marczelloo_pi/projects/atlas-hub", containerNames: ["atlashub-gateway"], gitRemote: "git@github.com:Marczelloo/atlas-hub.git" }, projects, services, [
        { projectId: "atlas", composeProject: "atlas-hub" },
      ])
    ).toMatchObject({ projectId: "atlas", confidence: "high" });
  });

  it("uses the directory name as a medium signal", () => {
    expect(matchStackToProject({ project: "bookhaven", workingDir: "/srv/BookHaven", containerNames: [], gitRemote: null }, projects, [], [])).toMatchObject({
      projectId: "book",
      confidence: "medium",
    });
  });

  it("reports conflicting strong signals without choosing", () => {
    const match = matchStackToProject({ project: "atlas-hub", workingDir: null, containerNames: ["marczelloo-dashboard"], gitRemote: null }, projects, services, []);
    expect(match.projectId).toBeNull();
    expect(match.confidence).toBe("none");
    expect(match.reasons.join(" ")).toMatch(/sprzeczne/);
  });

  it("returns none when nothing matches", () => {
    expect(matchStackToProject({ project: "x", workingDir: "/srv/x", containerNames: [], gitRemote: null }, projects, services, [])).toEqual({
      projectId: null,
      confidence: "none",
      reasons: ["Brak dopasowania do projektu w dashboardzie."],
    });
  });
});
```

- [ ] **Step 2: Test `match-routes.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { ContainerFact, IngressRule } from "../types";
import { matchIngressRoutes } from "./match-routes";

function container(name: string, project: string, service: string, ports: ContainerFact["ports"], status = "running"): ContainerFact {
  return { id: name, name, image: "", imageId: "", status, createdAt: "", composeProject: project, composeService: service, oneOff: false, workingDir: null, configFiles: [], env: {}, labels: {}, ports, mounts: [], networks: [] };
}

const rule = (position: number, hostname: string | null, service: string): IngressRule => ({ position, hostname, path: null, service, originRequest: null });

describe("matchIngressRoutes", () => {
  it("maps loopback ports to containers, host services and status rules", () => {
    const containers = [
      container("atlashub-minio", "atlas-hub", "minio", [{ hostIp: "127.0.0.1", hostPort: 9000, containerPort: 9000, protocol: "tcp" }]),
      container("portfolio-redesign-portfolio-1", "portfolio-redesign", "portfolio", [
        { hostIp: "0.0.0.0", hostPort: 3200, containerPort: 3200, protocol: "tcp" },
        { hostIp: "::", hostPort: 3200, containerPort: 3200, protocol: "tcp" },
      ]),
      container("old", "old", "web", [{ hostIp: "0.0.0.0", hostPort: 3300, containerPort: 80, protocol: "tcp" }], "exited"),
    ];
    const matches = matchIngressRoutes(
      [rule(0, "storage-atlashub.marczelloo.dev", "http://127.0.0.1:9000"), rule(1, "marczelloo.dev", "http://localhost:3200"), rule(2, "nadstrona.pl", "http://127.0.0.1:8080"), rule(3, "x.pl", "http://127.0.0.1:3300"), rule(4, null, "http_status:404"), rule(5, "y.pl", "http://minio:9000")],
      containers
    );
    expect(matches.map((match) => match.target)).toEqual([
      { kind: "container", composeProject: "atlas-hub", service: "minio", containerName: "atlashub-minio", containerPort: 9000 },
      { kind: "container", composeProject: "portfolio-redesign", service: "portfolio", containerName: "portfolio-redesign-portfolio-1", containerPort: 3200 },
      { kind: "host", port: 8080 },
      { kind: "host", port: 3300 },
      { kind: "status", status: "404" },
      { kind: "other", url: "http://minio:9000" },
    ]);
  });
});
```

- [ ] **Step 3: Uruchom — FAIL**

Run: `npx vitest run src/server/apps/import`
Expected: FAIL — brak modułów.

- [ ] **Step 4: Implementacja `match-projects.ts`**

```ts
import type { Project, Service } from "@/types";

export interface ProjectMatch {
  projectId: string | null;
  confidence: "high" | "medium" | "none";
  reasons: string[];
}

export interface StackIdentity {
  project: string;
  workingDir: string | null;
  containerNames: string[];
  gitRemote: string | null;
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function repoKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /github\.com[/:]([^/]+)\/([^/?#]+?)(?:\.git)?\/?$/i.exec(url.trim());
  return match ? `${normalizeName(match[1])}/${normalizeName(match[2])}` : null;
}

export function matchStackToProject(
  stack: StackIdentity,
  projects: Array<Pick<Project, "id" | "name" | "slug" | "github_url">>,
  services: Array<Pick<Service, "project_id" | "compose_project" | "container_id">>,
  deploymentConfigs: Array<{ projectId: string; composeProject: string }>
): ProjectMatch {
  const known = new Map(projects.map((project) => [project.id, project]));
  const strong = new Map<string, string[]>();
  const weak = new Map<string, string[]>();
  const add = (target: Map<string, string[]>, projectId: string, reason: string) => {
    if (!known.has(projectId)) return;
    target.set(projectId, [...new Set([...(target.get(projectId) ?? []), reason])]);
  };

  for (const config of deploymentConfigs) {
    if (config.composeProject === stack.project) add(strong, config.projectId, "Konfiguracja wdrożenia wskazuje ten stack.");
  }
  for (const service of services) {
    if (service.container_id && stack.containerNames.includes(service.container_id)) {
      add(strong, service.project_id, `Serwis wskazuje kontener ${service.container_id}.`);
    } else if (service.compose_project === stack.project) {
      add(strong, service.project_id, "Serwis wskazuje ten projekt Compose.");
    }
  }

  const remote = repoKey(stack.gitRemote);
  const directory = stack.workingDir ? normalizeName(stack.workingDir.split("/").pop() ?? "") : "";
  for (const project of projects) {
    if (remote && repoKey(project.github_url) === remote) add(strong, project.id, "Repozytorium Git zgodne z GitHubem projektu.");
    if (directory && (normalizeName(project.slug) === directory || normalizeName(project.name) === directory)) {
      add(weak, project.id, "Nazwa katalogu zgodna z projektem.");
    }
  }

  if (strong.size === 1) {
    const [projectId, reasons] = [...strong][0];
    return { projectId, confidence: "high", reasons: [...reasons, ...(weak.get(projectId) ?? [])] };
  }
  if (strong.size > 1) {
    const names = [...strong.keys()].map((id) => known.get(id)!.name).join(", ");
    return { projectId: null, confidence: "none", reasons: [`Wskazania są sprzeczne: ${names}. Wybierz projekt ręcznie.`] };
  }
  if (weak.size === 1) {
    const [projectId, reasons] = [...weak][0];
    return { projectId, confidence: "medium", reasons };
  }
  return { projectId: null, confidence: "none", reasons: ["Brak dopasowania do projektu w dashboardzie."] };
}
```

- [ ] **Step 5: Implementacja `match-routes.ts`**

```ts
import { parseLocalPortFromService } from "@/server/deployments/routing";
import type { ContainerFact, IngressRule } from "../types";

export type RouteTarget =
  | { kind: "container"; composeProject: string | null; service: string | null; containerName: string; containerPort: number }
  | { kind: "host"; port: number }
  | { kind: "status"; status: string }
  | { kind: "other"; url: string };

export interface RouteMatch {
  rule: IngressRule;
  target: RouteTarget;
}

export function matchIngressRoutes(rules: IngressRule[], containers: ContainerFact[]): RouteMatch[] {
  const running = containers.filter((container) => container.status === "running" || container.status === "restarting");

  return rules.map((rule) => {
    if (rule.service.startsWith("http_status:")) {
      return { rule, target: { kind: "status", status: rule.service.slice("http_status:".length) } };
    }
    const port = parseLocalPortFromService(rule.service);
    if (port === null) return { rule, target: { kind: "other", url: rule.service } };

    for (const container of running) {
      const binding = container.ports.find((candidate) => candidate.hostPort === port && candidate.hostIp !== "::");
      if (binding) {
        return {
          rule,
          target: { kind: "container", composeProject: container.composeProject, service: container.composeService, containerName: container.name, containerPort: binding.containerPort },
        };
      }
    }
    return { rule, target: { kind: "host", port } };
  });
}
```

- [ ] **Step 6: Uruchom — PASS**

Run: `npx vitest run src/server/apps/import`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/apps/import/match-projects.ts src/server/apps/import/match-projects.test.ts src/server/apps/import/match-routes.ts src/server/apps/import/match-routes.test.ts
git commit -m "feat: match compose stacks to projects and tunnel routes to containers"
```

---

### Task 4: Plan importu env

**Files:**
- Create: `src/server/apps/import/env-plan.ts`
- Test: `src/server/apps/import/env-plan.test.ts`

**Interfaces:**
- Consumes: `ContainerFact`, `ComposeConfig` (Task 1); `EnvEntry` (etap 0, `@/server/env/dotenv`).
- Produces:
  - `export type EnvOrigin = "file" | "compose" | "container" | "legacy-db"`
  - `export type EnvConflict = "file-differs" | "services-differ" | "legacy-differs" | "not-in-container"`
  - `export interface EnvPlanEntry { key: string; value: string; perService: Record<string, string> | null; origin: EnvOrigin; sourcePath: string | null; services: string[]; secret: boolean; include: boolean; conflicts: EnvConflict[] }`
  - `export interface EnvPlanInput { containers: ContainerFact[]; imageEnv: Record<string, Record<string, string>>; composeConfig: ComposeConfig | null; envFiles: Array<{ path: string; entries: EnvEntry[]; interpolation: boolean }>; legacy: Array<{ key: string; value: string }> }`
  - `export function isSecretKey(key: string): boolean`
  - `export function buildEnvPlan(input: EnvPlanInput): EnvPlanEntry[]`

- [ ] **Step 1: Test `env-plan.test.ts`**

```ts
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
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/apps/import/env-plan.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `env-plan.ts`**

```ts
import type { EnvEntry } from "@/server/env/dotenv";
import type { ComposeConfig, ContainerFact } from "../types";

export type EnvOrigin = "file" | "compose" | "container" | "legacy-db";
export type EnvConflict = "file-differs" | "services-differ" | "legacy-differs" | "not-in-container";

export interface EnvPlanEntry {
  key: string;
  value: string;
  perService: Record<string, string> | null;
  origin: EnvOrigin;
  sourcePath: string | null;
  services: string[];
  secret: boolean;
  include: boolean;
  conflicts: EnvConflict[];
}

export interface EnvPlanInput {
  containers: ContainerFact[];
  imageEnv: Record<string, Record<string, string>>;
  composeConfig: ComposeConfig | null;
  envFiles: Array<{ path: string; entries: EnvEntry[]; interpolation: boolean }>;
  legacy: Array<{ key: string; value: string }>;
}

const SECRET = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|MASTER_?KEY|DSN|WEBHOOK|COOKIE|_PASS$)/i;

export function isSecretKey(key: string): boolean {
  return SECRET.test(key);
}

export function buildEnvPlan(input: EnvPlanInput): EnvPlanEntry[] {
  const perKey = new Map<string, Record<string, string>>();
  for (const container of input.containers) {
    const service = container.composeService ?? container.name;
    const imageDefaults = input.imageEnv[container.imageId] ?? {};
    for (const [key, value] of Object.entries(container.env)) {
      if (imageDefaults[key] === value) continue;
      perKey.set(key, { ...(perKey.get(key) ?? {}), [service]: value });
    }
  }

  const legacy = new Map<string, Set<string>>();
  for (const entry of input.legacy) legacy.set(entry.key, new Set([...(legacy.get(entry.key) ?? []), entry.value]));

  const findInFiles = (key: string) => {
    for (const file of input.envFiles) {
      const entry = file.entries.find((candidate) => candidate.key === key);
      if (entry) return { path: file.path, value: entry.value, interpolation: file.interpolation };
    }
    return null;
  };
  const composeValue = (key: string) =>
    Object.values(input.composeConfig?.services ?? {})
      .map((service) => service.environment?.[key])
      .find((value): value is string => typeof value === "string");

  const entries: EnvPlanEntry[] = [];

  for (const [key, perService] of perKey) {
    const values = [...new Set(Object.values(perService))];
    const file = findInFiles(key);
    const fromCompose = composeValue(key);
    const conflicts: EnvConflict[] = [];
    if (values.length > 1) conflicts.push("services-differ");
    if (file && !values.includes(file.value)) conflicts.push("file-differs");
    const legacyValues = legacy.get(key);
    if (legacyValues && !values.some((value) => legacyValues.has(value))) conflicts.push("legacy-differs");

    const origin: EnvOrigin = file && values.includes(file.value) ? "file" : fromCompose !== undefined && values.includes(fromCompose) ? "compose" : "container";

    entries.push({
      key,
      value: Object.values(perService)[0],
      perService: values.length > 1 ? perService : null,
      origin,
      sourcePath: origin === "file" ? file!.path : null,
      services: Object.keys(perService).sort(),
      secret: isSecretKey(key),
      include: true,
      conflicts,
    });
  }

  for (const file of input.envFiles) {
    for (const entry of file.entries) {
      if (perKey.has(entry.key) || entries.some((candidate) => candidate.key === entry.key)) continue;
      entries.push({ key: entry.key, value: entry.value, perService: null, origin: "file", sourcePath: file.path, services: [], secret: isSecretKey(entry.key), include: file.interpolation, conflicts: ["not-in-container"] });
    }
  }

  for (const [key, values] of legacy) {
    if (entries.some((candidate) => candidate.key === key)) continue;
    entries.push({ key, value: [...values][0], perService: null, origin: "legacy-db", sourcePath: null, services: [], secret: isSecretKey(key), include: false, conflicts: ["not-in-container"] });
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
}
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npx vitest run src/server/apps/import/env-plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/apps/import/env-plan.ts src/server/apps/import/env-plan.test.ts
git commit -m "feat: build env import plan with origins and conflicts"
```

---

### Task 5: Renderer Compose i test na sucho

**Files:**
- Create: `src/server/apps/render/compose-render.ts`
- Test: `src/server/apps/render/compose-render.test.ts`

**Interfaces:**
- Consumes: `ComposeConfig`, `ContainerFact` (Task 1).
- Produces:
  - `export const DEFAULT_LOGGING: { driver: "json-file"; options: { "max-size": string; "max-file": string } }`
  - `export function renderImportedCompose(config: ComposeConfig, context: { project: string; projectId: string }): ComposeConfig`
  - `export function toComposeYaml(config: ComposeConfig): string`
  - `export interface DryRunCheck { service: string; check: "service" | "image" | "volumes" | "ports" | "env"; ok: boolean; detail: string }`
  - `export interface DryRunReport { ok: boolean; checks: DryRunCheck[] }`
  - `export function dryRunAgainstContainers(rendered: ComposeConfig, containers: ContainerFact[], imageEnv: Record<string, Record<string, string>>): DryRunReport`

- [ ] **Step 1: Test `compose-render.test.ts`**

```ts
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { ComposeConfig, ContainerFact } from "../types";
import { dryRunAgainstContainers, renderImportedCompose, toComposeYaml } from "./compose-render";

const config: ComposeConfig = {
  name: "marczelloo-drive",
  services: {
    drive: {
      build: { context: "/p/drive" },
      container_name: "marczelloo-drive",
      environment: { PORT: "3000", SECRET_KEY: "s" },
      ports: [{ mode: "ingress", host_ip: "127.0.0.1", target: 3000, published: "3030", protocol: "tcp" } as never],
    },
    compressor: {
      build: { context: "/p/drive" },
      environment: { PORT: "3000" },
      volumes: [{ type: "volume", source: "compression-tmp", target: "/var/lib/c" }],
      logging: { driver: "local" },
    },
  },
  volumes: { "compression-tmp": { name: "marczelloo-drive_compression-tmp" }, cache: null },
};

function container(overrides: Partial<ContainerFact>): ContainerFact {
  return { id: "x", name: "x", image: "", imageId: "img", status: "running", createdAt: "", composeProject: "marczelloo-drive", composeService: null, oneOff: false, workingDir: null, configFiles: [], env: {}, labels: {}, ports: [], mounts: [], networks: [], ...overrides };
}

describe("renderImportedCompose", () => {
  it("pins the project and volume names, adds labels and default logging", () => {
    const rendered = renderImportedCompose(config, { project: "marczelloo-drive", projectId: "p-1" });
    expect(rendered.name).toBe("marczelloo-drive");
    expect(rendered.volumes).toEqual({ "compression-tmp": { name: "marczelloo-drive_compression-tmp" }, cache: { name: "marczelloo-drive_cache" } });
    expect(rendered.services.drive.labels).toEqual({ "dev.marczelloo.project-id": "p-1", "dev.marczelloo.managed": "imported" });
    expect(rendered.services.drive.logging).toEqual({ driver: "json-file", options: { "max-size": "10m", "max-file": "3" } });
    expect(rendered.services.compressor.logging).toEqual({ driver: "local" });
    expect(rendered.services.drive.container_name).toBe("marczelloo-drive");
    expect(parse(toComposeYaml(rendered)).services.drive.ports[0].published).toBe("3030");
  });
});

describe("dryRunAgainstContainers", () => {
  const rendered = renderImportedCompose(config, { project: "marczelloo-drive", projectId: "p-1" });

  it("passes when images, volumes, ports and env match", () => {
    const report = dryRunAgainstContainers(
      rendered,
      [
        container({ name: "marczelloo-drive", composeService: "drive", image: "marczelloo-drive-drive", env: { PORT: "3000", SECRET_KEY: "s", PATH: "/bin" }, ports: [{ hostIp: "127.0.0.1", hostPort: 3030, containerPort: 3000, protocol: "tcp" }] }),
        container({
          name: "marczelloo-drive-compressor",
          composeService: "compressor",
          image: "marczelloo-drive-compressor",
          env: { PORT: "3000" },
          mounts: [
            { type: "volume", name: "marczelloo-drive_compression-tmp", source: "/v", destination: "/var/lib/c", readOnly: false },
            { type: "volume", name: "f".repeat(64), source: "/anon", destination: "/data", readOnly: false },
          ],
        }),
      ],
      { img: { PATH: "/bin" } }
    );
    expect(report.ok).toBe(true);
    expect(report.checks).toHaveLength(8);
  });

  it("reports missing services, changed values and volume drift without exposing values", () => {
    const report = dryRunAgainstContainers(
      rendered,
      [
        container({ name: "marczelloo-drive", composeService: "drive", image: "marczelloo-drive-drive", env: { PORT: "3000", SECRET_KEY: "old" }, ports: [{ hostIp: "0.0.0.0", hostPort: 3030, containerPort: 3000, protocol: "tcp" }] }),
        container({ name: "stray", composeService: "worker", image: "w" }),
        container({ name: "marczelloo-drive-compressor", composeService: "compressor", image: "marczelloo-drive-compressor", env: { PORT: "3000" }, mounts: [{ type: "volume", name: "other", source: "/v", destination: "/var/lib/c", readOnly: false }] }),
      ],
      {}
    );
    expect(report.ok).toBe(false);
    const failed = report.checks.filter((check) => !check.ok).map((check) => `${check.service}:${check.check}`);
    expect(failed).toEqual(["marczelloo-drive:ports", "marczelloo-drive:env", "stray:service", "marczelloo-drive-compressor:volumes"]);
    expect(JSON.stringify(report)).not.toContain("old");
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/apps/render`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `compose-render.ts`**

```ts
import { stringify } from "yaml";
import type { ComposeConfig, ContainerFact } from "../types";

export const DEFAULT_LOGGING = { driver: "json-file", options: { "max-size": "10m", "max-file": "3" } } as const;

export function renderImportedCompose(config: ComposeConfig, context: { project: string; projectId: string }): ComposeConfig {
  const services = Object.fromEntries(
    Object.entries(config.services).map(([name, service]) => [
      name,
      {
        ...service,
        labels: { ...(service.labels ?? {}), "dev.marczelloo.project-id": context.projectId, "dev.marczelloo.managed": "imported" },
        logging: service.logging ?? DEFAULT_LOGGING,
      },
    ])
  );
  const volumes = config.volumes
    ? Object.fromEntries(Object.entries(config.volumes).map(([key, volume]) => [key, { ...(volume ?? {}), name: volume?.name ?? `${context.project}_${key}` }]))
    : undefined;

  return { ...config, name: context.project, services, ...(volumes ? { volumes } : {}) };
}

export function toComposeYaml(config: ComposeConfig): string {
  return stringify(config, { lineWidth: 0 });
}

export interface DryRunCheck {
  service: string;
  check: "service" | "image" | "volumes" | "ports" | "env";
  ok: boolean;
  detail: string;
}

export interface DryRunReport {
  ok: boolean;
  checks: DryRunCheck[];
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

export function dryRunAgainstContainers(rendered: ComposeConfig, containers: ContainerFact[], imageEnv: Record<string, Record<string, string>>): DryRunReport {
  const checks: DryRunCheck[] = [];
  const running = containers.filter((container) => !container.oneOff && (container.status === "running" || container.status === "restarting"));

  for (const container of running) {
    const serviceName = container.composeService ?? "";
    const service = rendered.services[serviceName];
    if (!service) {
      checks.push({ service: container.name, check: "service", ok: false, detail: `Usługa „${serviceName}” nie istnieje w konfiguracji (inny profil lub plik?).` });
      continue;
    }

    const expectedImage = service.image ?? `${rendered.name}-${serviceName}`;
    checks.push({ service: container.name, check: "image", ok: container.image === expectedImage, detail: container.image === expectedImage ? expectedImage : `Kontener: ${container.image}, konfiguracja: ${expectedImage}` });

    const expectedMounts = (service.volumes ?? [])
      .filter((volume) => volume.type === "volume" || volume.type === "bind")
      .map((volume) => (volume.type === "volume" ? `volume:${rendered.volumes?.[volume.source ?? ""]?.name ?? volume.source}->${volume.target}` : `bind:${volume.source}->${volume.target}`));
    const actualMounts = container.mounts
      .filter((mount) => (mount.type === "volume" && !/^[0-9a-f]{64}$/.test(mount.name ?? "")) || mount.type === "bind")
      .map((mount) => (mount.type === "volume" ? `volume:${mount.name}->${mount.destination}` : `bind:${mount.source}->${mount.destination}`));
    const mountsOk = sameSet(expectedMounts, actualMounts);
    checks.push({ service: container.name, check: "volumes", ok: mountsOk, detail: mountsOk ? `${actualMounts.length} montowań zgodnych` : `Kontener: ${actualMounts.join(", ") || "brak"}; konfiguracja: ${expectedMounts.join(", ") || "brak"}` });

    const expectedPorts = (service.ports ?? []).map((port) => `${port.host_ip || "0.0.0.0"}:${port.published}->${port.target}/${port.protocol || "tcp"}`);
    const actualPorts = container.ports.filter((port) => port.hostIp !== "::").map((port) => `${port.hostIp}:${port.hostPort}->${port.containerPort}/${port.protocol}`);
    const portsOk = sameSet(expectedPorts, actualPorts);
    checks.push({ service: container.name, check: "ports", ok: portsOk, detail: portsOk ? `${actualPorts.length} portów zgodnych` : `Kontener: ${actualPorts.join(", ") || "brak"}; konfiguracja: ${expectedPorts.join(", ") || "brak"}` });

    const defaults = imageEnv[container.imageId] ?? {};
    const environment = service.environment ?? {};
    const ownKeys = Object.keys(container.env).filter((key) => defaults[key] !== container.env[key]);
    const missing = ownKeys.filter((key) => !(key in environment));
    const changed = ownKeys.filter((key) => key in environment && environment[key] !== container.env[key]);
    const envOk = missing.length === 0 && changed.length === 0;
    checks.push({
      service: container.name,
      check: "env",
      ok: envOk,
      detail: envOk ? `${ownKeys.length} zmiennych zgodnych` : [missing.length ? `brak w konfiguracji: ${missing.join(", ")}` : "", changed.length ? `inna wartość: ${changed.join(", ")}` : ""].filter(Boolean).join("; "),
    });
  }

  return { ok: checks.every((check) => check.ok), checks };
}
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npx vitest run src/server/apps/render`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/apps/render
git commit -m "feat: render imported compose config and dry-run it against running containers"
```

---

### Task 6: Złożenie propozycji i widok bez wartości

**Files:**
- Create: `src/server/apps/import/proposal.ts`
- Test: `src/server/apps/import/proposal.test.ts`

**Interfaces:**
- Consumes: Task 2–5; `parseEnvEntries` (etap 0).
- Produces:

```ts
export interface ImportInputs {
  snapshot: InventorySnapshot;
  projects: Project[];
  services: Service[];
  legacyEnv: Array<{ projectId: string; key: string; value: string }>;
  deploymentConfigs: Array<{ projectId: string; composeProject: string }>;
}
export interface StackProposal {
  composeProject: string; workingDir: string | null; configFiles: string[]; git: GitFact | null;
  match: ProjectMatch;
  containers: Array<{ name: string; service: string | null; image: string; status: string; ports: PortBinding[]; mounts: MountFact[] }>;
  env: EnvPlanEntry[]; dryRun: DryRunReport | null; warnings: string[];
}
export interface ProposalRoute extends RouteMatch { projectId: string | null }
export interface ImportProposal {
  id: string; capturedAt: string; stacks: StackProposal[]; routes: ProposalRoute[];
  hostnameCount: number; ingressError: string | null;
  projectsWithoutStack: Array<{ id: string; name: string }>; looseContainers: string[];
}
export type EnvPlanEntryView = Omit<EnvPlanEntry, "value" | "perService">;
export type StackProposalView = Omit<StackProposal, "env"> & { env: EnvPlanEntryView[] };
export type ImportProposalView = Omit<ImportProposal, "stacks"> & { stacks: StackProposalView[]; projects: Array<{ id: string; name: string }> };
export function buildImportProposal(inputs: ImportInputs, id?: string): ImportProposal
export function toProposalView(proposal: ImportProposal, projects: Array<Pick<Project, "id" | "name">>): ImportProposalView
```

- [ ] **Step 1: Test `proposal.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { Project, Service } from "@/types";
import type { ContainerFact, InventorySnapshot } from "../types";
import { buildImportProposal, toProposalView } from "./proposal";

function fact(overrides: Partial<ContainerFact>): ContainerFact {
  return { id: "id", name: "n", image: "marczelloo-tools-app", imageId: "img", status: "running", createdAt: "", composeProject: "marczelloo-tools", composeService: "app", oneOff: false, workingDir: "/home/Marczelloo_pi/projects/marczelloo-tools", configFiles: ["/home/Marczelloo_pi/projects/marczelloo-tools/docker-compose.yml", "/home/Marczelloo_pi/projects/.dashboard/deploy-logs/compose-overrides/marczelloo-tools.yaml"], env: {}, labels: {}, ports: [], mounts: [], networks: [], ...overrides };
}

const snapshot: InventorySnapshot = {
  capturedAt: "2026-09-16T10:00:00.000Z",
  imageEnv: { img: { PORT: "3000" } },
  looseContainers: [],
  ingress: { error: null, rules: [{ position: 0, hostname: "tools.marczelloo.dev", path: null, service: "http://127.0.0.1:3202", originRequest: null }, { position: 1, hostname: null, path: null, service: "http_status:404", originRequest: null }] },
  stacks: [
    {
      project: "marczelloo-tools",
      workingDir: "/home/Marczelloo_pi/projects/marczelloo-tools",
      configFiles: ["/home/Marczelloo_pi/projects/marczelloo-tools/docker-compose.yml", "/home/Marczelloo_pi/projects/.dashboard/deploy-logs/compose-overrides/marczelloo-tools.yaml"],
      containers: [fact({ name: "marczelloo-tools", env: { PORT: "3000", TOKEN: "t0p" }, ports: [{ hostIp: "127.0.0.1", hostPort: 3202, containerPort: 3000, protocol: "tcp" }] })],
      composeConfig: { name: "marczelloo-tools", services: { app: { build: {}, environment: { PORT: "3000", TOKEN: "t0p" }, ports: [{ host_ip: "127.0.0.1", published: "3202", target: 3000, protocol: "tcp" }] } } },
      composeConfigError: null,
      envFiles: [{ path: "/home/Marczelloo_pi/projects/marczelloo-tools/.env", content: null }],
      otherEnvFiles: [".env.docker.example"],
      git: { head: "ae8235d", remote: "git@github.com:Marczelloo/Marczelloo-Tools.git" },
    },
  ],
};

const projects = [
  { id: "tools", name: "Marczelloo-Tools", slug: "marczelloo-tools", github_url: "https://github.com/Marczelloo/Marczelloo-Tools" },
  { id: "arcade", name: "Arcade Portfolio", slug: "arcade-portfolio", github_url: null },
] as Project[];

describe("buildImportProposal", () => {
  it("matches the stack, plans env, dry-runs and maps routes", () => {
    const proposal = buildImportProposal({ snapshot, projects, services: [] as Service[], legacyEnv: [], deploymentConfigs: [{ projectId: "tools", composeProject: "marczelloo-tools" }] }, "proposal-1");
    const [stack] = proposal.stacks;
    expect(stack.match).toMatchObject({ projectId: "tools", confidence: "high" });
    expect(stack.env.map((entry) => entry.key)).toEqual(["TOKEN"]);
    expect(stack.dryRun?.ok).toBe(true);
    expect(stack.warnings).toEqual([
      "Pominięte pliki env w katalogu: .env.docker.example.",
      "Stack używa pliku override z katalogu logów dashboardu — przy przełączeniu trafi do konfiguracji.",
    ]);
    expect(proposal.routes[0]).toMatchObject({ projectId: "tools", target: { kind: "container", containerName: "marczelloo-tools" } });
    expect(proposal.routes[1]).toMatchObject({ projectId: null, target: { kind: "status" } });
    expect(proposal.hostnameCount).toBe(1);
    expect(proposal.projectsWithoutStack).toEqual([{ id: "arcade", name: "Arcade Portfolio" }]);
  });

  it("produces a client view without env values", () => {
    const proposal = buildImportProposal({ snapshot, projects, services: [] as Service[], legacyEnv: [], deploymentConfigs: [] }, "proposal-1");
    const view = toProposalView(proposal, projects);
    expect(JSON.stringify(view)).not.toContain("t0p");
    expect(view.stacks[0].env[0]).toEqual({ key: "TOKEN", origin: "compose", sourcePath: null, services: ["app"], secret: true, include: true, conflicts: [] });
    expect(view.projects).toEqual([{ id: "tools", name: "Marczelloo-Tools" }, { id: "arcade", name: "Arcade Portfolio" }]);
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/apps/import/proposal.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `proposal.ts`**

```ts
import { randomUUID } from "node:crypto";
import { parseEnvEntries } from "@/server/env/dotenv";
import type { Project, Service } from "@/types";
import { countHostnames } from "../inventory/ingress";
import { dryRunAgainstContainers, renderImportedCompose, type DryRunReport } from "../render/compose-render";
import type { GitFact, InventorySnapshot, MountFact, PortBinding } from "../types";
import { buildEnvPlan, type EnvPlanEntry } from "./env-plan";
import { matchStackToProject, type ProjectMatch } from "./match-projects";
import { matchIngressRoutes, type RouteMatch } from "./match-routes";

export interface ImportInputs {
  snapshot: InventorySnapshot;
  projects: Project[];
  services: Service[];
  legacyEnv: Array<{ projectId: string; key: string; value: string }>;
  deploymentConfigs: Array<{ projectId: string; composeProject: string }>;
}

export interface StackProposal {
  composeProject: string;
  workingDir: string | null;
  configFiles: string[];
  git: GitFact | null;
  match: ProjectMatch;
  containers: Array<{ name: string; service: string | null; image: string; status: string; ports: PortBinding[]; mounts: MountFact[] }>;
  env: EnvPlanEntry[];
  dryRun: DryRunReport | null;
  warnings: string[];
}

export interface ProposalRoute extends RouteMatch {
  projectId: string | null;
}

export interface ImportProposal {
  id: string;
  capturedAt: string;
  stacks: StackProposal[];
  routes: ProposalRoute[];
  hostnameCount: number;
  ingressError: string | null;
  projectsWithoutStack: Array<{ id: string; name: string }>;
  looseContainers: string[];
}

export type EnvPlanEntryView = Omit<EnvPlanEntry, "value" | "perService">;
export type StackProposalView = Omit<StackProposal, "env"> & { env: EnvPlanEntryView[] };
export type ImportProposalView = Omit<ImportProposal, "stacks"> & { stacks: StackProposalView[]; projects: Array<{ id: string; name: string }> };

export function buildImportProposal(inputs: ImportInputs, id: string = randomUUID()): ImportProposal {
  const { snapshot } = inputs;

  const stacks: StackProposal[] = snapshot.stacks.map((stack) => {
    const running = stack.containers.filter((container) => !container.oneOff && (container.status === "running" || container.status === "restarting"));
    const match = matchStackToProject(
      { project: stack.project, workingDir: stack.workingDir, containerNames: stack.containers.map((container) => container.name), gitRemote: stack.git?.remote ?? null },
      inputs.projects,
      inputs.services,
      inputs.deploymentConfigs
    );
    const defaultEnvPath = stack.workingDir ? `${stack.workingDir}/.env` : null;
    const env = buildEnvPlan({
      containers: running,
      imageEnv: snapshot.imageEnv,
      composeConfig: stack.composeConfig,
      envFiles: stack.envFiles
        .filter((file) => file.content !== null)
        .map((file) => ({ path: file.path, entries: parseEnvEntries(file.content!), interpolation: file.path === defaultEnvPath })),
      legacy: match.projectId ? inputs.legacyEnv.filter((entry) => entry.projectId === match.projectId).map(({ key, value }) => ({ key, value })) : [],
    });
    const dryRun = stack.composeConfig
      ? dryRunAgainstContainers(renderImportedCompose(stack.composeConfig, { project: stack.project, projectId: match.projectId ?? "unassigned" }), stack.containers, snapshot.imageEnv)
      : null;

    const warnings: string[] = [];
    if (stack.composeConfigError) warnings.push(`Nie udało się odczytać konfiguracji Compose: ${stack.composeConfigError}`);
    if (!stack.git) warnings.push("Katalog nie jest repozytorium Git — wdrożenie z GitHuba wymaga podpięcia repo.");
    if (stack.otherEnvFiles.length) warnings.push(`Pominięte pliki env w katalogu: ${stack.otherEnvFiles.join(", ")}.`);
    if (stack.configFiles.some((file) => file.includes("/.dashboard/"))) {
      warnings.push("Stack używa pliku override z katalogu logów dashboardu — przy przełączeniu trafi do konfiguracji.");
    }
    const conflicted = env.filter((entry) => entry.conflicts.length && entry.include).length;
    if (conflicted) warnings.push(`${conflicted} zmiennych ma konflikty — sprawdź je przed zapisem.`);
    if (dryRun && !dryRun.ok) warnings.push("Test na sucho wykrył różnice między konfiguracją a działającymi kontenerami.");

    return {
      composeProject: stack.project,
      workingDir: stack.workingDir,
      configFiles: stack.configFiles,
      git: stack.git,
      match,
      containers: stack.containers.map((container) => ({ name: container.name, service: container.composeService, image: container.image, status: container.status, ports: container.ports, mounts: container.mounts })),
      env,
      dryRun,
      warnings,
    };
  });

  const projectByStack = new Map(stacks.map((stack) => [stack.composeProject, stack.match.projectId]));
  const allContainers = [...snapshot.stacks.flatMap((stack) => stack.containers), ...snapshot.looseContainers];
  const routes = matchIngressRoutes(snapshot.ingress.rules, allContainers).map((route) => ({
    ...route,
    projectId: route.target.kind === "container" && route.target.composeProject ? projectByStack.get(route.target.composeProject) ?? null : null,
  }));
  const matchedProjects = new Set(stacks.map((stack) => stack.match.projectId).filter(Boolean));

  return {
    id,
    capturedAt: snapshot.capturedAt,
    stacks,
    routes,
    hostnameCount: countHostnames(snapshot.ingress.rules),
    ingressError: snapshot.ingress.error,
    projectsWithoutStack: inputs.projects.filter((project) => !matchedProjects.has(project.id)).map((project) => ({ id: project.id, name: project.name })),
    looseContainers: snapshot.looseContainers.map((container) => container.name),
  };
}

export function toProposalView(proposal: ImportProposal, projects: Array<Pick<Project, "id" | "name">>): ImportProposalView {
  return {
    ...proposal,
    stacks: proposal.stacks.map((stack) => ({
      ...stack,
      env: stack.env.map(({ key, origin, sourcePath, services, secret, include, conflicts }) => ({ key, origin, sourcePath, services, secret, include, conflicts })),
    })),
    projects: projects.map((project) => ({ id: project.id, name: project.name })),
  };
}
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npx vitest run src/server/apps/import/proposal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/apps/import/proposal.ts src/server/apps/import/proposal.test.ts
git commit -m "feat: assemble import proposal with value-free client view"
```

---

### Task 7: Kolektor stanu Pi

**Files:**
- Create: `src/server/apps/inventory/commands.ts` (czyste: polecenia i parsery)
- Test: `src/server/apps/inventory/commands.test.ts`
- Create: `src/server/apps/collector.ts` (serwerowe: wywołania runnera)

**Interfaces:**
- Consumes: `sectionCommand`, `parseSections` (Task 1); parsery (Task 2); `runHostCommand`, `getCloudflareTunnelSettings` (`@/server/deployments`); `shellQuote`.
- Produces (`inventory/commands.ts`: wszystko poza `collectInventory`; `collector.ts`: `collectInventory`):
  - `export const IMAGE_ID: RegExp`
  - `export interface StackLocation { project: string; workingDir: string; configFiles: string[] }`
  - `export function buildInspectCommand(): string`
  - `export function buildStackProbeCommand(stacks: StackLocation[], imageIds: string[], ingress: { path: string | null; useSudo: boolean }): string`
  - `export function buildEnvFilesCommand(paths: string[]): string`
  - `export function parseImageEnv(body: string): Record<string, Record<string, string>>`
  - `export function parseGit(body: string, exitCode: number): GitFact | null`
  - `export async function collectInventory(): Promise<InventorySnapshot>`

- [ ] **Step 1: Test `src/server/apps/inventory/commands.test.ts`**

```ts
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
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/apps/inventory/commands.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `src/server/apps/inventory/commands.ts`**

```ts
import { shellQuote } from "@/server/runner/safe-paths";
import type { GitFact } from "../types";
import { sectionCommand } from "./sections";

export const IMAGE_ID = /^sha256:[0-9a-f]{64}$/;

export interface StackLocation {
  project: string;
  workingDir: string;
  configFiles: string[];
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const PATH = /^\/[A-Za-z0-9._/@+-]+$/;

function assertPath(value: string) {
  if (!PATH.test(value) || value.split("/").includes("..")) throw new Error(`Nieprawidłowa ścieżka: ${value}`);
}

export function buildInspectCommand(): string {
  return ["set +e", sectionCommand("docker-inspect", "all", 'ids="$(docker ps -aq)"; if [ -z "$ids" ]; then echo "[]"; else docker inspect $ids; fi')].join("\n");
}

export function buildStackProbeCommand(stacks: StackLocation[], imageIds: string[], ingress: { path: string | null; useSudo: boolean }): string {
  const parts = ["set +e"];

  for (const stack of stacks) {
    if (!IDENTIFIER.test(stack.project)) throw new Error(`Nieprawidłowa nazwa projektu Compose: ${stack.project}`);
    assertPath(stack.workingDir);
    stack.configFiles.forEach(assertPath);
    const directory = shellQuote(stack.workingDir);
    const files = stack.configFiles.map((file) => `-f ${shellQuote(file)}`).join(" ");

    parts.push(sectionCommand("compose-config", stack.project, `docker compose -p ${shellQuote(stack.project)} --project-directory ${directory} ${files} --profile '*' config --format json`));
    for (const file of stack.configFiles) parts.push(sectionCommand("compose-file", file, `cat ${shellQuote(file)}`));
    parts.push(sectionCommand("env-file", `${stack.workingDir}/.env`, `cat ${shellQuote(`${stack.workingDir}/.env`)}`));
    parts.push(sectionCommand("env-list", stack.project, `ls -1a ${directory} | grep -E '^\\.env'`));
    parts.push(sectionCommand("git", stack.project, `git -C ${directory} rev-parse HEAD && git -C ${directory} remote get-url origin`));
  }

  if (imageIds.some((imageId) => !IMAGE_ID.test(imageId))) throw new Error("Nieprawidłowy identyfikator obrazu.");
  if (imageIds.length) {
    parts.push(sectionCommand("image-env", "all", `docker image inspect ${imageIds.join(" ")} --format '{{json .Id}} {{json .Config.Env}}'`));
  }

  if (ingress.path) {
    assertPath(ingress.path);
    parts.push(sectionCommand("ingress", "config", `${ingress.useSudo ? "sudo -n " : ""}cat ${shellQuote(ingress.path)}`));
  }

  return parts.join("\n");
}

export function buildEnvFilesCommand(paths: string[]): string {
  paths.forEach(assertPath);
  return ["set +e", ...paths.map((path) => sectionCommand("env-file", path, `cat ${shellQuote(path)}`))].join("\n");
}

export function parseImageEnv(body: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const line of body.split("\n").filter(Boolean)) {
    const space = line.indexOf(" ");
    const imageId = JSON.parse(line.slice(0, space)) as string;
    const list = (JSON.parse(line.slice(space + 1)) as string[] | null) ?? [];
    result[imageId] = Object.fromEntries(list.map((item) => [item.slice(0, item.indexOf("=")), item.slice(item.indexOf("=") + 1)]));
  }
  return result;
}

export function parseGit(body: string, exitCode: number): GitFact | null {
  const [head, remote] = body.split("\n").map((line) => line.trim());
  if (!head || !/^[0-9a-f]{7,64}$/.test(head)) return null;
  return { head, remote: exitCode === 0 && remote ? remote : null };
}
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npx vitest run src/server/apps/inventory/commands.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementacja `src/server/apps/collector.ts`**

```ts
import "server-only";

import { getCloudflareTunnelSettings, runHostCommand } from "@/server/deployments";
import { buildEnvFilesCommand, buildInspectCommand, buildStackProbeCommand, IMAGE_ID, parseGit, parseImageEnv, type StackLocation } from "./inventory/commands";
import { extractEnvFileRefs } from "./inventory/compose-files";
import { groupByComposeProject, parseDockerInspect } from "./inventory/docker-facts";
import { parseIngressConfig } from "./inventory/ingress";
import { parseSections, type Section } from "./inventory/sections";
import type { ComposeConfig, EnvFileSnapshot, InventorySnapshot, StackSnapshot } from "./types";

function find(sections: Section[], kind: string, id: string) {
  return sections.find((section) => section.kind === kind && section.id === id);
}

export async function collectInventory(): Promise<InventorySnapshot> {
  const capturedAt = new Date().toISOString();
  const inspectResult = await runHostCommand(buildInspectCommand(), 30_000);
  const inspect = find(parseSections(inspectResult.stdout), "docker-inspect", "all");
  if (!inspect || inspect.exitCode !== 0) throw new Error("Nie udało się odczytać kontenerów Dockera przez runner.");

  const containers = parseDockerInspect(inspect.body);
  const { stacks, loose } = groupByComposeProject(containers);
  const locations: StackLocation[] = [...stacks].flatMap(([project, list]) => {
    const reference = list.find((container) => !container.oneOff && container.workingDir) ?? list.find((container) => container.workingDir);
    return reference?.workingDir ? [{ project, workingDir: reference.workingDir, configFiles: reference.configFiles }] : [];
  });

  const tunnel = await getCloudflareTunnelSettings();
  const imageIds = [...new Set(containers.map((container) => container.imageId).filter((imageId) => IMAGE_ID.test(imageId)))];
  const probe = parseSections((await runHostCommand(buildStackProbeCommand(locations, imageIds, { path: tunnel.configPath, useSudo: tunnel.useSudo }), 120_000)).stdout);

  const referencedEnv = new Map<string, string[]>();
  for (const location of locations) {
    const refs = location.configFiles.flatMap((file) => {
      const section = find(probe, "compose-file", file);
      return section && section.exitCode === 0 ? extractEnvFileRefs(section.body, file) : [];
    });
    referencedEnv.set(location.project, refs.filter((ref) => ref !== `${location.workingDir}/.env`));
  }
  const extraPaths = [...new Set([...referencedEnv.values()].flat())];
  const extra = extraPaths.length ? parseSections((await runHostCommand(buildEnvFilesCommand(extraPaths), 30_000)).stdout) : [];

  const envSnapshot = (path: string, sections: Section[]): EnvFileSnapshot => {
    const section = find(sections, "env-file", path);
    return { path, content: section && section.exitCode === 0 ? section.body : null };
  };

  const stackSnapshots: StackSnapshot[] = [...stacks].map(([project, list]) => {
    const location = locations.find((candidate) => candidate.project === project);
    if (!location) {
      return { project, workingDir: null, configFiles: [], containers: list, composeConfig: null, composeConfigError: "Kontenery nie mają etykiety katalogu Compose.", envFiles: [], otherEnvFiles: [], git: null };
    }
    const config = find(probe, "compose-config", project);
    let composeConfig: ComposeConfig | null = null;
    let composeConfigError: string | null = null;
    if (config && config.exitCode === 0) {
      try {
        composeConfig = JSON.parse(config.body) as ComposeConfig;
      } catch {
        composeConfigError = "Niepoprawny JSON z docker compose config.";
      }
    } else {
      composeConfigError = `docker compose config zakończył się kodem ${config?.exitCode ?? "brak"}.`;
    }

    const envFiles = [envSnapshot(`${location.workingDir}/.env`, probe), ...(referencedEnv.get(project) ?? []).map((path) => envSnapshot(path, extra))];
    const readNames = new Set(envFiles.map((file) => file.path.split("/").pop()));
    const listed = find(probe, "env-list", project);
    const otherEnvFiles = (listed?.body ?? "").split("\n").map((name) => name.trim()).filter((name) => name && !readNames.has(name));
    const git = find(probe, "git", project);

    return { project, workingDir: location.workingDir, configFiles: location.configFiles, containers: list, composeConfig, composeConfigError, envFiles, otherEnvFiles, git: git ? parseGit(git.body, git.exitCode) : null };
  });

  const imageSection = find(probe, "image-env", "all");
  const ingressSection = find(probe, "ingress", "config");
  let ingress: InventorySnapshot["ingress"] = { rules: [], error: tunnel.configPath ? "Nie odczytano konfiguracji cloudflared." : "Ścieżka konfiguracji tunelu nie jest ustawiona." };
  if (ingressSection && ingressSection.exitCode === 0) {
    try {
      ingress = { rules: parseIngressConfig(ingressSection.body), error: null };
    } catch (error) {
      ingress = { rules: [], error: error instanceof Error ? error.message : "Błąd parsowania konfiguracji cloudflared." };
    }
  }

  return {
    capturedAt,
    stacks: stackSnapshots.sort((a, b) => a.project.localeCompare(b.project)),
    looseContainers: loose,
    imageEnv: imageSection && imageSection.exitCode === 0 ? parseImageEnv(imageSection.body) : {},
    ingress,
  };
}
```

- [ ] **Step 6: Typy i testy**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/apps/inventory/commands.ts src/server/apps/inventory/commands.test.ts src/server/apps/collector.ts
git commit -m "feat: collect read-only Pi inventory through the runner"
```

---

### Task 8: Tabele, repozytorium i wiersze do zapisu

**Files:**
- Create: `scripts/migrations/2026-09-16-app-import-tables.ts`
- Create: `src/server/apps/import/persist-rows.ts`
- Test: `src/server/apps/import/persist-rows.test.ts`
- Create: `src/server/atlashub/app-import.ts`
- Modify: `src/server/atlashub/index.ts`

**Interfaces:**
- Consumes: `StackProposal`, `ProposalRoute` (Task 6); `EnvPlanEntry` (Task 4); `encrypt` (`@/server/lib/encryption`).
- Produces (persist-rows.ts):
  - `export interface EnvVersionPayload { version: 1; entries: Array<Pick<EnvPlanEntry, "key" | "value" | "perService" | "origin" | "sourcePath" | "services" | "secret">> }`
  - `export function selectEnvEntries(plan: EnvPlanEntry[], includeKeys: string[]): EnvPlanEntry[]`
  - `export function envPayload(entries: EnvPlanEntry[]): EnvVersionPayload`
  - `export function envKeysMetadata(entries: EnvPlanEntry[]): Array<Pick<EnvPlanEntry, "key" | "origin" | "sourcePath" | "services" | "secret" | "conflicts">>`
  - `export function envFingerprint(payload: EnvVersionPayload): string`
  - `export function buildAppConfigRow(stack: StackProposal, projectId: string, now: string): AppConfigRowInput`
  - `export function buildRouteRows(routes: ProposalRoute[], projectOverrides: Map<string, string | null>, now: string): AppRouteRowInput[]`
  - `export interface AppConfigRowInput { project_id: string; compose_project: string; working_dir: string | null; config_files: string[]; state: "imported"; source: { git: GitFact | null }; processes: Array<{ service: string | null; container: string; image: string; ports: PortBinding[] }>; auto_deploy: false; updated_at: string }`
  - `export interface AppRouteRowInput { project_id: string | null; position: number; hostname: string | null; path: string | null; service: string; origin_request: Record<string, unknown> | null; target: RouteTarget; source: "imported"; created_at: string; updated_at: string }`
- Produces (app-import.ts):
  - `export async function upsertAppConfig(row: AppConfigRowInput): Promise<{ id: string; created: boolean }>`
  - `export async function getLatestEnvVersion(projectId: string): Promise<{ version: number; fingerprint: string } | null>`
  - `export async function insertEnvVersion(input: { projectId: string; version: number; keys: unknown; payload: EnvVersionPayload; fingerprint: string; note: string; createdBy: string }): Promise<void>`
  - `export async function replaceImportedRoutes(rows: AppRouteRowInput[]): Promise<number>`
  - `export async function insertSnapshot(input: { projectId: string | null; kind: string; payload: unknown }): Promise<void>`
  - `export async function listAppConfigs(): Promise<Array<{ project_id: string; compose_project: string; state: string; updated_at: string }>>`

- [ ] **Step 1: Test `persist-rows.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { EnvPlanEntry } from "./env-plan";
import { buildRouteRows, envFingerprint, envKeysMetadata, envPayload, selectEnvEntries } from "./persist-rows";
import type { ProposalRoute } from "./proposal";

const entry = (key: string, value: string, include = true): EnvPlanEntry => ({ key, value, perService: null, origin: "file", sourcePath: "/p/.env", services: ["app"], secret: key.includes("SECRET"), include, conflicts: [] });

describe("env rows", () => {
  it("selects explicitly included keys only", () => {
    expect(selectEnvEntries([entry("A", "1"), entry("B", "2", false), entry("C", "3")], ["A", "B"]).map((item) => item.key)).toEqual(["A", "B"]);
  });

  it("keeps values in the payload and strips them from metadata", () => {
    const entries = [entry("JWT_SECRET", "v")];
    expect(envPayload(entries)).toEqual({ version: 1, entries: [{ key: "JWT_SECRET", value: "v", perService: null, origin: "file", sourcePath: "/p/.env", services: ["app"], secret: true }] });
    expect(JSON.stringify(envKeysMetadata(entries))).not.toContain('"v"');
  });

  it("fingerprints independent of entry order and changes with values", () => {
    const a = envFingerprint(envPayload([entry("A", "1"), entry("B", "2")]));
    expect(envFingerprint(envPayload([entry("B", "2"), entry("A", "1")]))).toBe(a);
    expect(envFingerprint(envPayload([entry("A", "1"), entry("B", "3")]))).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("buildRouteRows", () => {
  it("applies the user's project choice for container routes", () => {
    const routes: ProposalRoute[] = [
      { rule: { position: 0, hostname: "tools.marczelloo.dev", path: null, service: "http://127.0.0.1:3202", originRequest: null }, target: { kind: "container", composeProject: "marczelloo-tools", service: "app", containerName: "marczelloo-tools", containerPort: 3000 }, projectId: "auto" },
      { rule: { position: 1, hostname: "nadstrona.pl", path: null, service: "http://127.0.0.1:8080", originRequest: null }, target: { kind: "host", port: 8080 }, projectId: null },
    ];
    const rows = buildRouteRows(routes, new Map([["marczelloo-tools", "chosen"]]), "2026-09-16T00:00:00.000Z");
    expect(rows.map((row) => [row.position, row.project_id, row.source])).toEqual([
      [0, "chosen", "imported"],
      [1, null, "imported"],
    ]);
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/apps/import/persist-rows.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `persist-rows.ts`**

```ts
import { createHash } from "node:crypto";
import type { GitFact, PortBinding } from "../types";
import type { EnvPlanEntry } from "./env-plan";
import type { RouteTarget } from "./match-routes";
import type { ProposalRoute, StackProposal } from "./proposal";

export interface EnvVersionPayload {
  version: 1;
  entries: Array<Pick<EnvPlanEntry, "key" | "value" | "perService" | "origin" | "sourcePath" | "services" | "secret">>;
}

export interface AppConfigRowInput {
  project_id: string;
  compose_project: string;
  working_dir: string | null;
  config_files: string[];
  state: "imported";
  source: { git: GitFact | null };
  processes: Array<{ service: string | null; container: string; image: string; ports: PortBinding[] }>;
  auto_deploy: false;
  updated_at: string;
}

export interface AppRouteRowInput {
  project_id: string | null;
  position: number;
  hostname: string | null;
  path: string | null;
  service: string;
  origin_request: Record<string, unknown> | null;
  target: RouteTarget;
  source: "imported";
  created_at: string;
  updated_at: string;
}

export function selectEnvEntries(plan: EnvPlanEntry[], includeKeys: string[]): EnvPlanEntry[] {
  const wanted = new Set(includeKeys);
  return plan.filter((entry) => wanted.has(entry.key));
}

export function envPayload(entries: EnvPlanEntry[]): EnvVersionPayload {
  return {
    version: 1,
    entries: entries.map(({ key, value, perService, origin, sourcePath, services, secret }) => ({ key, value, perService, origin, sourcePath, services, secret })),
  };
}

export function envKeysMetadata(entries: EnvPlanEntry[]) {
  return entries.map(({ key, origin, sourcePath, services, secret, conflicts }) => ({ key, origin, sourcePath, services, secret, conflicts }));
}

export function envFingerprint(payload: EnvVersionPayload): string {
  const canonical = [...payload.entries]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => [entry.key, entry.value, entry.perService ? Object.entries(entry.perService).sort() : null]);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function buildAppConfigRow(stack: StackProposal, projectId: string, now: string): AppConfigRowInput {
  return {
    project_id: projectId,
    compose_project: stack.composeProject,
    working_dir: stack.workingDir,
    config_files: stack.configFiles,
    state: "imported",
    source: { git: stack.git },
    processes: stack.containers.map((container) => ({ service: container.service, container: container.name, image: container.image, ports: container.ports })),
    auto_deploy: false,
    updated_at: now,
  };
}

export function buildRouteRows(routes: ProposalRoute[], projectOverrides: Map<string, string | null>, now: string): AppRouteRowInput[] {
  return routes.map((route) => {
    const composeProject = route.target.kind === "container" ? route.target.composeProject : null;
    const projectId = composeProject && projectOverrides.has(composeProject) ? projectOverrides.get(composeProject)! : route.projectId;
    return {
      project_id: route.target.kind === "container" ? projectId : null,
      position: route.rule.position,
      hostname: route.rule.hostname,
      path: route.rule.path,
      service: route.rule.service,
      origin_request: route.rule.originRequest,
      target: route.target,
      source: "imported",
      created_at: now,
      updated_at: now,
    };
  });
}
```

- [ ] **Step 4: Uruchom — PASS**

Run: `npx vitest run src/server/apps/import/persist-rows.test.ts`
Expected: PASS.

- [ ] **Step 5: Migracja `scripts/migrations/2026-09-16-app-import-tables.ts`**

```ts
/**
 * Creates tables for stage 1 import. Idempotent.
 * Run with the dashboard env: npx tsx scripts/migrations/2026-09-16-app-import-tables.ts
 */
const apiUrl = process.env.ATLASHUB_API_URL;
const secretKey = process.env.ATLASHUB_SECRET_KEY;

const id = { name: "id", type: "uuid", primaryKey: true, defaultValue: "gen_random_uuid()" };
const createdAt = { name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()" };
const updatedAt = { name: "updated_at", type: "timestamptz", nullable: false, defaultValue: "now()" };

const tables = [
  {
    name: "app_configs",
    columns: [
      id,
      { name: "project_id", type: "uuid", nullable: false, unique: true },
      { name: "compose_project", type: "varchar(100)", nullable: false, unique: true },
      { name: "working_dir", type: "text", nullable: true },
      { name: "config_files", type: "jsonb", nullable: false, defaultValue: "'[]'::jsonb" },
      { name: "state", type: "varchar(20)", nullable: false, defaultValue: "'imported'" },
      { name: "source", type: "jsonb", nullable: false, defaultValue: "'{}'::jsonb" },
      { name: "processes", type: "jsonb", nullable: false, defaultValue: "'[]'::jsonb" },
      { name: "auto_deploy", type: "boolean", nullable: false, defaultValue: "false" },
      createdAt,
      updatedAt,
    ],
  },
  {
    name: "app_env_versions",
    columns: [
      id,
      { name: "project_id", type: "uuid", nullable: false },
      { name: "version", type: "integer", nullable: false },
      { name: "keys", type: "jsonb", nullable: false },
      { name: "payload_encrypted", type: "text", nullable: false },
      { name: "fingerprint", type: "varchar(64)", nullable: false },
      { name: "note", type: "text", nullable: true },
      { name: "created_by", type: "varchar(100)", nullable: false },
      createdAt,
    ],
  },
  {
    name: "app_routes",
    columns: [
      id,
      { name: "project_id", type: "uuid", nullable: true },
      { name: "position", type: "integer", nullable: false },
      { name: "hostname", type: "varchar(253)", nullable: true },
      { name: "path", type: "text", nullable: true },
      { name: "service", type: "text", nullable: false },
      { name: "origin_request", type: "jsonb", nullable: true },
      { name: "target", type: "jsonb", nullable: false },
      { name: "source", type: "varchar(20)", nullable: false, defaultValue: "'imported'" },
      createdAt,
      updatedAt,
    ],
  },
  {
    name: "app_snapshots",
    columns: [
      id,
      { name: "project_id", type: "uuid", nullable: true },
      { name: "kind", type: "varchar(30)", nullable: false },
      { name: "payload_encrypted", type: "text", nullable: false },
      createdAt,
    ],
  },
];

const indexes = [
  { name: "idx_app_env_versions_project_version", table: "app_env_versions", columns: ["project_id", "version"], unique: true },
  { name: "idx_app_routes_source", table: "app_routes", columns: ["source"] },
  { name: "idx_app_snapshots_project", table: "app_snapshots", columns: ["project_id", "created_at"] },
];

async function post(path: string, body: unknown) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": secretKey! },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
}

async function main() {
  if (!apiUrl || !secretKey) throw new Error("ATLASHUB_API_URL and ATLASHUB_SECRET_KEY are required");
  for (const table of tables) {
    await post("/v1/db/schema/tables", { ...table, ifNotExists: true });
    console.log(`${table.name}: ready`);
  }
  for (const index of indexes) {
    await post("/v1/db/schema/indexes", { ...index, ifNotExists: true });
    console.log(`${index.name}: ready`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

- [ ] **Step 6: Repozytorium `src/server/atlashub/app-import.ts`**

```ts
import "server-only";

import type { EnvVersionPayload, AppConfigRowInput, AppRouteRowInput } from "@/server/apps/import/persist-rows";
import { encrypt } from "@/server/lib/encryption";
import * as db from "./client";

interface AppConfigRow extends AppConfigRowInput {
  id: string;
  created_at: string;
}

export async function upsertAppConfig(row: AppConfigRowInput): Promise<{ id: string; created: boolean }> {
  const existing = await db.select<AppConfigRow>("app_configs", { filters: [{ operator: "eq", column: "project_id", value: row.project_id }], limit: 1 });
  if (existing.data[0]) {
    await db.updateById<AppConfigRow>("app_configs", existing.data[0].id, row);
    return { id: existing.data[0].id, created: false };
  }
  const inserted = await db.insert<AppConfigRow>("app_configs", row);
  return { id: inserted.data[0].id, created: true };
}

export async function getLatestEnvVersion(projectId: string): Promise<{ version: number; fingerprint: string } | null> {
  const response = await db.select<{ version: number; fingerprint: string }>("app_env_versions", {
    select: ["version", "fingerprint"],
    filters: [{ operator: "eq", column: "project_id", value: projectId }],
    order: { column: "version", direction: "desc" },
    limit: 1,
  });
  return response.data[0] ?? null;
}

export async function insertEnvVersion(input: { projectId: string; version: number; keys: unknown; payload: EnvVersionPayload; fingerprint: string; note: string; createdBy: string }): Promise<void> {
  await db.insert("app_env_versions", {
    project_id: input.projectId,
    version: input.version,
    keys: input.keys,
    payload_encrypted: await encrypt(JSON.stringify(input.payload)),
    fingerprint: input.fingerprint,
    note: input.note,
    created_by: input.createdBy,
  });
}

export async function replaceImportedRoutes(rows: AppRouteRowInput[]): Promise<number> {
  await db.deleteRows("app_routes", [{ operator: "eq", column: "source", value: "imported" }]);
  if (!rows.length) return 0;
  const inserted = await db.insert("app_routes", rows);
  return inserted.data.length;
}

export async function insertSnapshot(input: { projectId: string | null; kind: string; payload: unknown }): Promise<void> {
  await db.insert("app_snapshots", {
    project_id: input.projectId,
    kind: input.kind,
    payload_encrypted: await encrypt(JSON.stringify(input.payload)),
  });
}

export async function listAppConfigs(): Promise<Array<{ project_id: string; compose_project: string; state: string; updated_at: string }>> {
  const response = await db.select<{ project_id: string; compose_project: string; state: string; updated_at: string }>("app_configs", {
    select: ["project_id", "compose_project", "state", "updated_at"],
    order: { column: "compose_project", direction: "asc" },
    limit: 200,
  });
  return response.data;
}
```

Dopisz w `src/server/atlashub/index.ts`:

```ts
export * as appImport from "./app-import";
```

- [ ] **Step 7: Testy i typy**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add scripts/migrations/2026-09-16-app-import-tables.ts src/server/apps/import/persist-rows.ts src/server/apps/import/persist-rows.test.ts src/server/atlashub/app-import.ts src/server/atlashub/index.ts
git commit -m "feat: add import tables, row builders and repository"
```

---

### Task 9: Pamięć propozycji, zapis importu i akcje serwera

**Files:**
- Create: `src/server/apps/proposal-store.ts`
- Create: `src/server/apps/import/save-import.ts`
- Create: `src/app/actions/app-import.ts`

**Interfaces:**
- Consumes: `collectInventory` (Task 7), `buildImportProposal`, `toProposalView` (Task 6), repozytorium i `persist-rows` (Task 8), `decrypt`, `requirePinVerification`, `ActionResult` z `@/app/actions/projects`.
- Produces:
  - `export function storeProposal(proposal: ImportProposal, snapshot: InventorySnapshot): void`
  - `export function takeProposal(id: string): { proposal: ImportProposal; snapshot: InventorySnapshot } | null`
  - `export interface ImportDecision { composeProject: string; projectId: string | null; includeKeys: string[] }`
  - `export interface SaveImportResult { stacks: Array<{ composeProject: string; projectId: string | null; configCreated: boolean | null; envVersion: number | null; envKeys: number; envUnchanged: boolean }>; routes: number }`
  - `export async function saveImport(proposal: ImportProposal, snapshot: InventorySnapshot, decisions: ImportDecision[], actorEmail: string): Promise<SaveImportResult>`
  - `export async function scanInventoryAction(): Promise<ActionResult<ImportProposalView> & { code?: string }>`
  - `export async function saveImportAction(input: { proposalId: string; decisions: ImportDecision[] }): Promise<ActionResult<SaveImportResult> & { code?: string }>`

- [ ] **Step 1: `src/server/apps/proposal-store.ts`**

```ts
import "server-only";

import type { ImportProposal } from "./import/proposal";
import type { InventorySnapshot } from "./types";

const TTL_MS = 30 * 60 * 1000;
const store = new Map<string, { proposal: ImportProposal; snapshot: InventorySnapshot; expiresAt: number }>();

function sweep(now = Date.now()) {
  for (const [id, entry] of store) if (entry.expiresAt <= now) store.delete(id);
}

export function storeProposal(proposal: ImportProposal, snapshot: InventorySnapshot): void {
  sweep();
  store.set(proposal.id, { proposal, snapshot, expiresAt: Date.now() + TTL_MS });
}

export function takeProposal(id: string): { proposal: ImportProposal; snapshot: InventorySnapshot } | null {
  sweep();
  const entry = store.get(id);
  return entry ? { proposal: entry.proposal, snapshot: entry.snapshot } : null;
}
```

- [ ] **Step 2: `src/server/apps/import/save-import.ts`**

```ts
import "server-only";

import { appImport, auditLogs } from "@/server/atlashub";
import type { InventorySnapshot } from "../types";
import { buildAppConfigRow, buildRouteRows, envFingerprint, envKeysMetadata, envPayload, selectEnvEntries } from "./persist-rows";
import type { ImportProposal } from "./proposal";

export interface ImportDecision {
  composeProject: string;
  projectId: string | null;
  includeKeys: string[];
}

export interface SaveImportResult {
  stacks: Array<{ composeProject: string; projectId: string | null; configCreated: boolean | null; envVersion: number | null; envKeys: number; envUnchanged: boolean }>;
  routes: number;
}

export async function saveImport(proposal: ImportProposal, snapshot: InventorySnapshot, decisions: ImportDecision[], actorEmail: string): Promise<SaveImportResult> {
  const now = new Date().toISOString();
  const result: SaveImportResult = { stacks: [], routes: 0 };

  for (const decision of decisions) {
    const stack = proposal.stacks.find((candidate) => candidate.composeProject === decision.composeProject);
    if (!stack) throw new Error(`Stack ${decision.composeProject} nie należy do tego skanu.`);
    if (!decision.projectId) {
      result.stacks.push({ composeProject: stack.composeProject, projectId: null, configCreated: null, envVersion: null, envKeys: 0, envUnchanged: false });
      continue;
    }

    const config = await appImport.upsertAppConfig(buildAppConfigRow(stack, decision.projectId, now));
    const entries = selectEnvEntries(stack.env, decision.includeKeys);
    const payload = envPayload(entries);
    const fingerprint = envFingerprint(payload);
    const latest = await appImport.getLatestEnvVersion(decision.projectId);
    const envUnchanged = latest?.fingerprint === fingerprint;
    const envVersion = envUnchanged ? latest!.version : (latest?.version ?? 0) + 1;

    if (!envUnchanged) {
      await appImport.insertEnvVersion({
        projectId: decision.projectId,
        version: envVersion,
        keys: envKeysMetadata(entries),
        payload,
        fingerprint,
        note: `Import ze skanu ${proposal.capturedAt}`,
        createdBy: actorEmail,
      });
    }

    const stackSnapshot = snapshot.stacks.find((candidate) => candidate.project === stack.composeProject);
    await appImport.insertSnapshot({ projectId: decision.projectId, kind: "stack-inspect", payload: { capturedAt: snapshot.capturedAt, containers: stackSnapshot?.containers ?? [], imageEnv: snapshot.imageEnv } });

    result.stacks.push({ composeProject: stack.composeProject, projectId: decision.projectId, configCreated: config.created, envVersion, envKeys: entries.length, envUnchanged });
  }

  const overrides = new Map(decisions.map((decision) => [decision.composeProject, decision.projectId]));
  if (!proposal.ingressError) {
    result.routes = await appImport.replaceImportedRoutes(buildRouteRows(proposal.routes, overrides, now));
    await appImport.insertSnapshot({ projectId: null, kind: "ingress", payload: { capturedAt: snapshot.capturedAt, rules: snapshot.ingress.rules } });
  }

  await auditLogs.logAction(actorEmail, "import", "project", undefined, {
    stage: 1,
    proposal_id: proposal.id,
    stacks: result.stacks.map(({ composeProject, projectId, envVersion, envKeys, envUnchanged }) => ({ composeProject, projectId, envVersion, envKeys, envUnchanged })),
    routes: result.routes,
  });

  return result;
}
```
- [ ] **Step 3: `src/app/actions/app-import.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/actions/projects";
import { collectInventory } from "@/server/apps/collector";
import { buildImportProposal, toProposalView, type ImportProposalView } from "@/server/apps/import/proposal";
import { saveImport, type SaveImportResult } from "@/server/apps/import/save-import";
import { storeProposal, takeProposal } from "@/server/apps/proposal-store";
import { envVars, projects, services } from "@/server/atlashub";
import { select } from "@/server/atlashub/client";
import { AuthError, requirePinVerification } from "@/server/lib/auth";
import { decrypt } from "@/server/lib/encryption";
import { checkDemoModeBlocked } from "@/lib/demo-mode";

type Result<T> = ActionResult<T> & { code?: string };

function failure(error: unknown): Result<never> {
  if (error instanceof AuthError) return { success: false, error: error.message, code: error.code };
  return { success: false, error: error instanceof Error ? error.message : "Nieoczekiwany błąd importu." };
}

async function loadLegacyEnv(serviceRows: Awaited<ReturnType<typeof services.getServices>>) {
  const projectByService = new Map(serviceRows.map((service) => [service.id, service.project_id]));
  const rows = await envVars.getEnvVars({ limit: 1000 });
  const legacy: Array<{ projectId: string; key: string; value: string }> = [];
  for (const row of rows) {
    const projectId = projectByService.get(row.service_id);
    if (!projectId) continue;
    try {
      legacy.push({ projectId, key: row.key, value: await decrypt(row.value_encrypted) });
    } catch {
      // A value encrypted with a rotated key is not a usable hint.
    }
  }
  return legacy;
}

async function loadDeploymentConfigs() {
  const response = await select<{ key: string; value: string }>("settings", { filters: [{ operator: "like", column: "key", value: "deployment-config:%" }], limit: 200 });
  return response.data.flatMap((row) => {
    try {
      const value = JSON.parse(row.value) as { projectId?: string; composeProject?: string };
      return value.projectId && value.composeProject ? [{ projectId: value.projectId, composeProject: value.composeProject }] : [];
    } catch {
      return [];
    }
  });
}

export async function scanInventoryAction(): Promise<Result<ImportProposalView>> {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return demo.result;
    await requirePinVerification();

    // AtlasHub returns 100 rows by default; ask for the maximum explicitly.
    const [snapshot, projectRows, serviceRows, deploymentConfigs] = await Promise.all([
      collectInventory(),
      projects.getProjects({ limit: 1000 }),
      services.getServices({ limit: 1000 }),
      loadDeploymentConfigs(),
    ]);
    const legacyEnv = await loadLegacyEnv(serviceRows);
    const proposal = buildImportProposal({ snapshot, projects: projectRows, services: serviceRows, legacyEnv, deploymentConfigs });
    storeProposal(proposal, snapshot);
    return { success: true, data: toProposalView(proposal, projectRows) };
  } catch (error) {
    return failure(error);
  }
}

const saveSchema = z.object({
  proposalId: z.string().uuid(),
  decisions: z
    .array(
      z.object({
        composeProject: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/),
        projectId: z.string().uuid().nullable(),
        includeKeys: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)).max(500),
      })
    )
    .min(1)
    .max(50),
});

export async function saveImportAction(input: z.input<typeof saveSchema>): Promise<Result<SaveImportResult>> {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return demo.result;
    const user = await requirePinVerification();
    const parsed = saveSchema.parse(input);

    const stored = takeProposal(parsed.proposalId);
    if (!stored) return { success: false, error: "Skan wygasł albo serwer został zrestartowany — uruchom skanowanie ponownie." };

    const knownProjects = new Set((await projects.getProjects({ limit: 1000 })).map((project) => project.id));
    const unknown = parsed.decisions.find((decision) => decision.projectId && !knownProjects.has(decision.projectId));
    if (unknown) return { success: false, error: `Wybrany projekt dla ${unknown.composeProject} nie istnieje.` };
    const duplicated = parsed.decisions.map((decision) => decision.projectId).filter((id, index, all) => id && all.indexOf(id) !== index);
    if (duplicated.length) return { success: false, error: "Ten sam projekt przypisano do więcej niż jednego stacka." };

    const data = await saveImport(stored.proposal, stored.snapshot, parsed.decisions, user.email);
    revalidatePath("/import");
    return { success: true, data };
  } catch (error) {
    return failure(error);
  }
}
```

`getProjects`, `getServices` i `getEnvVars` przyjmują `QueryOptions` z polem `limit` (domyślnie AtlasHub zwraca 100 wierszy).

- [ ] **Step 4: Typy, lint, testy**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/apps/proposal-store.ts src/server/apps/import/save-import.ts src/app/actions/app-import.ts
git commit -m "feat: add import scan and save server actions"
```

---

### Task 10: Ekran importu

**Files:**
- Create: `src/app/(dashboard)/import/page.tsx`
- Create: `src/app/(dashboard)/import/_components/import-wizard.tsx`
- Modify: `src/components/layout/sidebar.tsx:70-71`

**Interfaces:**
- Consumes: `scanInventoryAction`, `saveImportAction` (Task 9); `ImportProposalView` (Task 6); `PinDialog`; `appImport.listAppConfigs` (Task 8).

- [ ] **Step 1: `page.tsx`**

```tsx
import { DatabaseZap } from "lucide-react";
import { appImport, projects } from "@/server/atlashub";
import { requireAuth } from "@/server/lib/auth";
import { ImportWizard } from "./_components/import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireAuth();
  const [configs, projectRows] = await Promise.all([appImport.listAppConfigs().catch(() => []), projects.getProjects()]);
  const projectNames = new Map(projectRows.map((project) => [project.id, project.name]));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-border/50 bg-card/30 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <DatabaseZap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Import projektów</h1>
            <p className="text-sm text-muted-foreground">Skan serwera tylko do odczytu. Nic nie zmienia działających kontenerów.</p>
          </div>
        </div>
      </header>
      <div className="flex-1 space-y-6 p-6">
        <ImportWizard imported={configs.map((config) => ({ composeProject: config.compose_project, projectName: projectNames.get(config.project_id) ?? config.project_id, updatedAt: config.updated_at }))} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `_components/import-wizard.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, ScanSearch, Save } from "lucide-react";
import { toast } from "sonner";
import { saveImportAction, scanInventoryAction } from "@/app/actions/app-import";
import { PinDialog } from "@/components/pin-dialog";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import type { ImportProposalView } from "@/server/apps/import/proposal";
import type { SaveImportResult } from "@/server/apps/import/save-import";

const ORIGIN_LABEL = { file: "plik", compose: "compose", container: "kontener", "legacy-db": "stara baza" } as const;
const CONFLICT_LABEL = {
  "file-differs": "plik ≠ kontener",
  "services-differ": "różne w usługach",
  "legacy-differs": "stara baza ≠ kontener",
  "not-in-container": "nieużywana w kontenerach",
} as const;
const SKIP = "__skip__";

interface Decision {
  projectId: string | null;
  includeKeys: Set<string>;
}

export function ImportWizard({ imported }: { imported: Array<{ composeProject: string; projectName: string; updatedAt: string }> }) {
  const [proposal, setProposal] = useState<ImportProposalView | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState<"scan" | "save" | null>(null);
  const [pinFor, setPinFor] = useState<"scan" | "save" | null>(null);
  const [saved, setSaved] = useState<SaveImportResult | null>(null);

  const projectNames = useMemo(() => new Map((proposal?.projects ?? []).map((project) => [project.id, project.name])), [proposal]);

  async function scan() {
    setBusy("scan");
    setSaved(null);
    const result = await scanInventoryAction();
    setBusy(null);
    if (result.code === "PIN_REQUIRED") return setPinFor("scan");
    if (!result.success || !result.data) return toast.error("Skan nie powiódł się", { description: result.error });

    setProposal(result.data);
    setDecisions(
      Object.fromEntries(
        result.data.stacks.map((stack) => [
          stack.composeProject,
          { projectId: stack.match.confidence === "high" ? stack.match.projectId : null, includeKeys: new Set(stack.env.filter((entry) => entry.include).map((entry) => entry.key)) },
        ])
      )
    );
    toast.success(`Zeskanowano ${result.data.stacks.length} stacków i ${result.data.routes.length} reguł tunelu`);
  }

  async function save() {
    if (!proposal) return;
    setBusy("save");
    const result = await saveImportAction({
      proposalId: proposal.id,
      decisions: proposal.stacks.map((stack) => ({ composeProject: stack.composeProject, projectId: decisions[stack.composeProject]?.projectId ?? null, includeKeys: [...(decisions[stack.composeProject]?.includeKeys ?? [])] })),
    });
    setBusy(null);
    if (result.code === "PIN_REQUIRED") return setPinFor("save");
    if (!result.success || !result.data) return toast.error("Nie zapisano importu", { description: result.error });
    setSaved(result.data);
    toast.success("Import zapisany. Kontenery nie zostały zmienione.");
  }

  function update(composeProject: string, change: (decision: Decision) => Decision) {
    setDecisions((current) => ({ ...current, [composeProject]: change(current[composeProject]) }));
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Skan serwera</CardTitle>
            <CardDescription>Odczytuje kontenery, pliki Compose i env oraz konfigurację tunelu. Wymaga PIN.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={scan} disabled={busy !== null}>
              {busy === "scan" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              {proposal ? "Skanuj ponownie" : "Skanuj serwer"}
            </Button>
            {proposal && (
              <Button onClick={save} disabled={busy !== null}>
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Zapisz import
              </Button>
            )}
          </div>
        </CardHeader>
        {imported.length > 0 && (
          <CardContent className="text-sm text-muted-foreground">
            Zaimportowane wcześniej: {imported.map((item) => `${item.composeProject} → ${item.projectName}`).join(", ")}
          </CardContent>
        )}
      </Card>

      {saved && (
        <Card className="border-success/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4 text-success" />
              Zapisano import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {saved.stacks.map((stack) => (
              <p key={stack.composeProject}>
                <span className="font-mono">{stack.composeProject}</span>:{" "}
                {stack.projectId ? `env w wersji ${stack.envVersion} (${stack.envKeys} kluczy${stack.envUnchanged ? ", bez zmian" : ""})` : "pominięty"}
              </p>
            ))}
            <p>Trasy tunelu: {saved.routes}</p>
          </CardContent>
        </Card>
      )}

      {proposal?.stacks.map((stack) => {
        const decision = decisions[stack.composeProject];
        return (
          <Card key={stack.composeProject}>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-mono text-base">{stack.composeProject}</CardTitle>
                  <CardDescription className="font-mono text-xs">{stack.workingDir ?? "brak katalogu"}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={stack.match.confidence === "high" ? "success" : stack.match.confidence === "medium" ? "warning" : "secondary"}>
                    {stack.match.confidence === "high" ? "pewne dopasowanie" : stack.match.confidence === "medium" ? "do potwierdzenia" : "brak dopasowania"}
                  </Badge>
                  <Select value={decision?.projectId ?? SKIP} onValueChange={(value) => update(stack.composeProject, (current) => ({ ...current, projectId: value === SKIP ? null : value }))}>
                    <SelectTrigger className="w-64" aria-label={`Projekt dla ${stack.composeProject}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP}>Pomiń ten stack</SelectItem>
                      {proposal.projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{stack.match.reasons.join(" ")}</p>
              {stack.warnings.length > 0 && (
                <ul className="space-y-1 text-sm text-warning">
                  {stack.warnings.map((warning) => (
                    <li key={warning} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              <section>
                <h3 className="mb-2 text-sm font-medium">Kontenery</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr><th className="py-1 pr-4">Kontener</th><th className="pr-4">Usługa</th><th className="pr-4">Stan</th><th className="pr-4">Porty</th><th>Wolumeny</th></tr>
                    </thead>
                    <tbody>
                      {stack.containers.map((container) => (
                        <tr key={container.name} className="border-t border-border/50 align-top">
                          <td className="py-1.5 pr-4 font-mono">{container.name}</td>
                          <td className="pr-4">{container.service ?? "—"}</td>
                          <td className="pr-4">{container.status}</td>
                          <td className="pr-4 font-mono text-xs">{container.ports.filter((port) => port.hostIp !== "::").map((port) => `${port.hostIp}:${port.hostPort}→${port.containerPort}`).join(", ") || "—"}</td>
                          <td className="font-mono text-xs">{container.mounts.map((mount) => mount.name ?? mount.source).join(", ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-medium">Zmienne ({decision?.includeKeys.size ?? 0} z {stack.env.length} do importu)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr><th className="py-1 pr-2">Import</th><th className="pr-4">Klucz</th><th className="pr-4">Źródło</th><th className="pr-4">Usługi</th><th>Uwagi</th></tr>
                    </thead>
                    <tbody>
                      {stack.env.map((entry) => {
                        const id = `env-${stack.composeProject}-${entry.key}`;
                        return (
                          <tr key={entry.key} className="border-t border-border/50">
                            <td className="py-1.5 pr-2">
                              <input
                                id={id}
                                type="checkbox"
                                checked={decision?.includeKeys.has(entry.key) ?? false}
                                onChange={(event) =>
                                  update(stack.composeProject, (current) => {
                                    const includeKeys = new Set(current.includeKeys);
                                    if (event.target.checked) includeKeys.add(entry.key);
                                    else includeKeys.delete(entry.key);
                                    return { ...current, includeKeys };
                                  })
                                }
                              />
                            </td>
                            <td className="pr-4 font-mono"><label htmlFor={id}>{entry.key}</label>{entry.secret && <Badge variant="outline" className="ml-2">sekret</Badge>}</td>
                            <td className="pr-4"><Badge variant="secondary">{ORIGIN_LABEL[entry.origin]}</Badge></td>
                            <td className="pr-4 text-xs text-muted-foreground">{entry.services.join(", ") || "—"}</td>
                            <td className="space-x-1">{entry.conflicts.map((conflict) => <Badge key={conflict} variant="warning">{CONFLICT_LABEL[conflict]}</Badge>)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {stack.dryRun && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                    Test na sucho
                    <Badge variant={stack.dryRun.ok ? "success" : "danger"}>{stack.dryRun.ok ? "zgodny" : "różnice"}</Badge>
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {stack.dryRun.checks.filter((check) => !check.ok).map((check) => (
                      <li key={`${check.service}-${check.check}`} className="text-danger">
                        <span className="font-mono">{check.service}</span> · {check.check}: {check.detail}
                      </li>
                    ))}
                    {stack.dryRun.ok && <li className="text-muted-foreground">{stack.dryRun.checks.length} sprawdzeń zgodnych.</li>}
                  </ul>
                </section>
              )}
            </CardContent>
          </Card>
        );
      })}

      {proposal && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trasy tunelu ({proposal.routes.length} reguł, {proposal.hostnameCount} domen)</CardTitle>
            {proposal.ingressError && <CardDescription className="text-danger">{proposal.ingressError}</CardDescription>}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="py-1 pr-4">#</th><th className="pr-4">Domena</th><th className="pr-4">Ścieżka</th><th className="pr-4">Cel</th><th>Projekt</th></tr>
              </thead>
              <tbody>
                {proposal.routes.map((route) => {
                  const composeProject = route.target.kind === "container" ? route.target.composeProject : null;
                  const projectId = composeProject ? decisions[composeProject]?.projectId ?? null : null;
                  return (
                    <tr key={route.rule.position} className="border-t border-border/50">
                      <td className="py-1.5 pr-4 tabular-nums">{route.rule.position + 1}</td>
                      <td className="pr-4 font-mono">{route.rule.hostname ?? "(pozostałe)"}</td>
                      <td className="pr-4 font-mono text-xs">{route.rule.path ?? "—"}</td>
                      <td className="pr-4 text-xs">
                        {route.target.kind === "container" && <span className="font-mono">{route.target.containerName}:{route.target.containerPort}</span>}
                        {route.target.kind === "host" && <span>usługa hosta :{route.target.port}</span>}
                        {route.target.kind === "status" && <span>odpowiedź {route.target.status}</span>}
                        {route.target.kind === "other" && <span className="font-mono">{route.target.url}</span>}
                        {route.rule.originRequest && <Badge variant="outline" className="ml-2">originRequest</Badge>}
                      </td>
                      <td className="text-xs">{projectId ? projectNames.get(projectId) : route.target.kind === "container" ? "—" : "zewnętrzna"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {proposal.projectsWithoutStack.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">Projekty bez stacka na serwerze: {proposal.projectsWithoutStack.map((project) => project.name).join(", ")}.</p>
            )}
          </CardContent>
        </Card>
      )}

      <PinDialog
        open={pinFor !== null}
        onCancel={() => setPinFor(null)}
        onSuccess={() => {
          const retry = pinFor;
          setPinFor(null);
          if (retry === "scan") void scan();
          if (retry === "save") void save();
        }}
      />
    </>
  );
}
```

- [ ] **Step 3: Pozycja w nawigacji**

W `src/components/layout/sidebar.tsx` dodaj `DatabaseZap` do importu z `lucide-react` i w kategorii zawierającej `Services` i `Containers` dopisz po `Containers`:

```ts
      { href: "/import", label: "Import", icon: DatabaseZap },
```

- [ ] **Step 4: Build i lint**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS; w wyjściu build widnieje trasa `/import`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/import" src/components/layout/sidebar.tsx
git commit -m "feat: add read-only project import screen"
```

---

### Task 11: Runbook etapu 1 i odbiór na Pi

**Files:**
- Create: `docs/runbooks/2026-09-16-stage-1-import.md`

- [ ] **Step 1: Utwórz runbook**

````markdown
# Etap 1 — import na Raspberry Pi

SSH: `ssh -i ~/.ssh/nadstrona_pi_ed25519 Marczelloo_pi@192.168.100.12`
Warunek: etap 0 wdrożony, logowanie przez Access i PIN działają.

## 1. Stan „przed” (tylko odczyt)

```bash
docker ps -a --format '{{.Names}} {{.ID}} {{.CreatedAt}}' | sort > /tmp/stage1-before.txt
wc -l /tmp/stage1-before.txt
```

## 2. Migracja tabel (zgoda)

Po wdrożeniu kodu etapu 1 (push do `main`):

```bash
cd ~/projects/Marczelloo-dashboard
docker run --rm --env-file .env -v "$PWD/scripts/migrations:/m:ro" node:20-alpine sh -c 'npx --yes tsx /m/2026-09-16-app-import-tables.ts'
```

Expected: 4 × `…: ready` i 3 indeksy `…: ready`.

## 3. Skan i zapis (zgoda na zapis)

1. `https://dashboard.marczelloo.dev/import` → „Skanuj serwer” → PIN.
2. Oczekiwane dopasowania „pewne”: `atlas-hub` → AtlasHub, `marczelloo-dashboard` → Marczelloo Dashboard, `marczelloo-drive` → marczelloo-drive, `marczelloo-tools` → Marczelloo-Tools, `neobeatbuddy` → NeoBeat Buddy, `portfolio-redesign` → portfolio-redesign.
3. Oczekiwane ostrzeżenia: neobeatbuddy „nie jest repozytorium Git” i „Pominięte pliki env … .env.live …”; marczelloo-tools „override z katalogu logów”.
4. Trasy: 21 reguł, 19 domen; reguła `/api/github/webhook` i badge `originRequest` przy storage-atlashub; 9 domen „usługa hosta :8080”.
5. Przejrzyj konflikty env (szczególnie `ACTIVITY_ALLOWED_ORIGINS` w neobeatbuddy) i zapisz import.

## 4. Weryfikacja „po”

```bash
docker ps -a --format '{{.Names}} {{.ID}} {{.CreatedAt}}' | sort > /tmp/stage1-after.txt
diff /tmp/stage1-before.txt /tmp/stage1-after.txt && echo NO_CONTAINER_CHANGES
```

Expected: `NO_CONTAINER_CHANGES`.

```bash
docker exec -i marczelloo-dashboard node - <<'JS'
const base = process.env.ATLASHUB_API_URL, key = process.env.ATLASHUB_SECRET_KEY;
const count = async (table, query = "") => (await (await fetch(`${base}/v1/db/${table}?limit=1000${query}`, { headers: { "x-api-key": key } })).json()).data;
(async () => {
  const configs = await count("app_configs");
  const versions = await count("app_env_versions", "&select=project_id,version,keys");
  const routes = await count("app_routes");
  const items = await count("work_items", "&select=id");
  console.log("app_configs", configs.map((c) => c.compose_project).sort().join(","));
  for (const v of versions) console.log("env", v.project_id, "v" + v.version, v.keys.length, "keys");
  console.log("routes", routes.length, "hostnames", new Set(routes.map((r) => r.hostname).filter(Boolean)).size);
  console.log("work_items", items.length);
})();
JS
```

Expected: 6 konfiguracji; wersja 1 env dla każdego zaimportowanego projektu; `routes 21 hostnames 19`; `work_items 64`.

Powtórny zapis tego samego skanu nie tworzy wersji 2 (wynik „bez zmian”).
````

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/2026-09-16-stage-1-import.md
git commit -m "docs: add stage 1 import runbook"
```

---

## Kryteria ukończenia etapu 1

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` przechodzą.
- Skan na Pi nie zmienia żadnego kontenera (`NO_CONTAINER_CHANGES`).
- Zapisane: 6 × `app_configs` z obecnymi nazwami Compose, wersja env na projekt, 21 reguł w `app_routes` (19 domen), snapshoty `stack-inspect` i `ingress`.
- Widok w przeglądarce nie zawiera wartości zmiennych (sprawdzenie: DevTools → Network → odpowiedź akcji skanu nie zawiera wartości żadnego sekretu z `.env`).
- `work_items` = 64, rekordy `projects` bez zmian.
- Test na sucho dla każdego stacka jest „zgodny” albo każda różnica ma wyjaśnienie w runbooku przed etapem 4.
