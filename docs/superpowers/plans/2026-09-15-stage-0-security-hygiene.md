# Etap 0 — bezpieczeństwo i higiena — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zamknąć krytyczne luki uwierzytelniania i naprawić błędy, które dziś psują deploy i edycję env, bez przebudowy silnika wdrożeń.

**Architecture:** Tożsamość pochodzi wyłącznie z podpisanego JWT Cloudflare Access, weryfikowanego w globalnym `src/proxy.ts` i w `src/server/lib/auth.ts`. Martwe i niedziałające ścieżki deployu znikają. Zapis env staje się bezpieczny składniowo i jest stosowany przez odtworzenie kontenerów Compose (zamiast `docker restart`). Porty usług wiążą się do `127.0.0.1`. Część zadań to operacje na Pi — każda wymaga zgody właściciela w chwili wykonania.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, zod 3, `jose` 6 (nowa zależność), `vitest` 3 (nowa zależność deweloperska), Docker Compose 5 na Raspberry Pi, AtlasHub REST.

**Spec:** `docs/superpowers/specs/2026-09-15-deploy-platform-rebuild-design.md`

## Global Constraints

- Node.js 20 (obraz `node:20-alpine`); nie używać API dostępnych dopiero w Node 22.
- Next.js 16: interceptor żądań to `src/proxy.ts` z eksportem `proxy` (nie `middleware.ts`).
- Baza tylko przez REST AtlasHub (`/v1/db`), nowe tabele przez `POST /v1/db/schema/tables` z `ifNotExists: true`.
- Nazwy projektów Compose na Pi są niezmienne: `atlas-hub`, `marczelloo-dashboard`, `marczelloo-drive`, `marczelloo-tools`, `neobeatbuddy`, `portfolio-redesign`.
- Wartości sekretów nigdy w logach ani odpowiedziach API.
- Tekst UI po polsku; commity po angielsku (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`).
- Zadania oznaczone **[Pi — wymaga zgody]** wykonuje się dopiero po wyraźnym „tak” właściciela dla tego konkretnego kroku.
- Dostęp SSH do Pi: `ssh -i ~/.ssh/nadstrona_pi_ed25519 Marczelloo_pi@192.168.100.12`.

## Mapa plików

| Plik | Odpowiedzialność |
|---|---|
| `vitest.config.ts`, `tests/stubs/server-only.ts` | infrastruktura testów |
| `src/server/lib/cloudflare-access.ts` (+ test) | weryfikacja JWT Access, rozwiązywanie tożsamości |
| `src/server/lib/auth-policy.ts` (+ test) | allowlista właścicieli, zasada obejścia PIN |
| `src/server/lib/public-paths.ts` (+ test) | ścieżki bez uwierzytelniania |
| `src/proxy.ts` | globalna bramka uwierzytelniania |
| `src/server/lib/auth.ts` | przepięcie na nową tożsamość |
| `src/server/deployments/routing.ts` (+ test) | port z usługi ingress, decyzja auto-deploy |
| `src/server/env/dotenv.ts` (+ test) | parser i serializer plików env zgodny z Compose |
| `src/server/deployments/compose-stack.ts` (+ test) | stack Compose z etykiet, komenda odtworzenia |
| `src/app/api/services/[id]/apply-env/route.ts` | stosowanie env przez odtworzenie kontenerów |
| `src/server/monitoring/retention.ts` (+ test) | retencja `uptime_checks` |
| `scripts/migrations/2026-09-15-general-todos.ts` | utworzenie tabeli `general_todos` |
| `runner/trusted-remote.ts` (+ test) | filtr adresów runnera |
| `docs/runbooks/2026-09-15-stage-0-pi.md` | procedury na Pi z weryfikacją |

---

### Task 0: [Pi — wymaga zgody] Unieważnienie wyciekłego klucza Resend

Klucz `RESEND_API_KEY` kontenera `portfolio-redesign-portfolio-1` został wypisany w sesji audytu 15.09.2026. Plik `.env` portfolio zawiera też błędną linię z kluczem `process.env.NEXT_URL`.

**Files:** brak zmian w repo dashboardu.

- [ ] **Step 1: Właściciel tworzy nowy klucz w panelu Resend i usuwa stary**

Resend → API Keys → utwórz nowy klucz z tymi samymi uprawnieniami → usuń stary (prefiks `re_Re96qSGd`).

- [ ] **Step 2: Właściciel poprawia `.env` portfolio na Pi**

Edytuje `~/projects/portfolio-redesign/.env`: wpisuje nowy `RESEND_API_KEY=...` w osobnej linii i usuwa linię zaczynającą się od `process.env.NEXT_URL`. Jeśli aplikacja potrzebuje adresu, dopisuje `NEXT_URL=https://marczelloo.dev`.

- [ ] **Step 3: Odtworzenie kontenera i weryfikacja bez ujawniania wartości**

```bash
ssh -i ~/.ssh/nadstrona_pi_ed25519 Marczelloo_pi@192.168.100.12 'cd ~/projects/portfolio-redesign && docker compose up -d --no-build && docker exec portfolio-redesign-portfolio-1 sh -c '"'"'printenv | cut -d= -f1 | sort'"'"''
```

Expected: lista kluczy zawiera `RESEND_API_KEY`, nie zawiera `process.env.NEXT_URL`; `curl -sI https://marczelloo.dev | head -1` zwraca `HTTP/2 200`.

---

### Task 1: Infrastruktura testów (vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/stubs/server-only.ts`
- Test: `src/server/runner/safe-paths.test.ts`

**Interfaces:**
- Produces: polecenie `npm test` (vitest run) z aliasem `@/` → `src/` i atrapą modułu `server-only`.

- [ ] **Step 1: Dodaj zależności i skrypty**

```bash
npm install --save-dev vitest@^3.2.4
npm install jose@^6.1.0
```

W `package.json` w `scripts` dodaj:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 2: Utwórz `tests/stubs/server-only.ts`**

```ts
// Test stub: the real "server-only" package throws outside React Server Components.
export {};
```

- [ ] **Step 3: Utwórz `vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "runner/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Napisz test dymny dla istniejącego kodu**

`src/server/runner/safe-paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getEnvFilePath, shellQuote, validateRepoPath } from "./safe-paths";

describe("safe-paths", () => {
  it("quotes single quotes for POSIX shells", () => {
    expect(shellQuote("a'b")).toBe(`'a'"'"'b'`);
  });

  it("accepts paths below the projects directory", () => {
    expect(validateRepoPath("/home/Marczelloo_pi/projects/atlas-hub/")).toBe("/home/Marczelloo_pi/projects/atlas-hub");
  });

  it("rejects traversal and foreign roots", () => {
    expect(() => validateRepoPath("/home/Marczelloo_pi/projects/../.ssh")).toThrow();
    expect(() => validateRepoPath("/etc")).toThrow();
  });

  it("accepts only .env style file names", () => {
    expect(getEnvFilePath("/home/Marczelloo_pi/projects/x", ".env.live").filePath).toBe("/home/Marczelloo_pi/projects/x/.env.live");
    expect(() => getEnvFilePath("/home/Marczelloo_pi/projects/x", "../.env")).toThrow();
  });
});
```

- [ ] **Step 5: Uruchom testy**

Run: `npm test`
Expected: PASS, 4 testy.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/stubs/server-only.ts src/server/runner/safe-paths.test.ts
git commit -m "test: add vitest with server-only stub"
```

---

### Task 2: Weryfikacja JWT Cloudflare Access

**Files:**
- Create: `src/server/lib/cloudflare-access.ts`
- Test: `src/server/lib/cloudflare-access.test.ts`

**Interfaces:**
- Consumes: `jose` z Task 1.
- Produces:
  - `export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion"`
  - `export interface AccessIdentity { email: string; subject: string }`
  - `export type AccessVerify = (token: string | null | undefined) => Promise<AccessIdentity | null>`
  - `export function normalizeTeamDomain(value: string): string`
  - `export function createAccessVerifier(options: { teamDomain: string; audience: string; keySet?: JWTVerifyGetKey }): AccessVerify`
  - `export function getAccessVerifierFromEnv(env?: NodeJS.ProcessEnv): AccessVerify | null`
  - `export async function resolveIdentity(headers: { get(name: string): string | null }, env?: NodeJS.ProcessEnv, verify?: AccessVerify | null): Promise<AccessIdentity | null>`

- [ ] **Step 1: Napisz testy**

```ts
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { createAccessVerifier, normalizeTeamDomain, resolveIdentity, type AccessVerify } from "./cloudflare-access";

const TEAM = "https://marczelloo.cloudflareaccess.com";
const AUD = "aud-tag-123";
let privateKey: CryptoKey;
let verify: AccessVerify;

async function token(claims: Record<string, unknown>, options: { issuer?: string; audience?: string; expires?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(options.issuer ?? TEAM)
    .setAudience(options.audience ?? AUD)
    .setIssuedAt()
    .setExpirationTime(options.expires ?? "5m")
    .sign(privateKey);
}

function headers(values: Record<string, string>) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  verify = createAccessVerifier({ teamDomain: TEAM, audience: AUD, keySet: createLocalJWKSet({ keys: [jwk] }) });
});

describe("normalizeTeamDomain", () => {
  it("accepts bare and https team domains", () => {
    expect(normalizeTeamDomain("marczelloo.cloudflareaccess.com")).toBe(TEAM);
    expect(normalizeTeamDomain(`${TEAM}/`)).toBe(TEAM);
  });

  it("rejects foreign hosts", () => {
    expect(() => normalizeTeamDomain("https://evil.example.com")).toThrow();
  });
});

describe("createAccessVerifier", () => {
  it("returns the lower-cased email for a valid token", async () => {
    await expect(verify(await token({ email: "Owner@Example.com", sub: "u1" }))).resolves.toEqual({ email: "owner@example.com", subject: "u1" });
  });

  it("rejects a wrong audience, issuer or an expired token", async () => {
    await expect(verify(await token({ email: "a@b.c" }, { audience: "other" }))).resolves.toBeNull();
    await expect(verify(await token({ email: "a@b.c" }, { issuer: "https://other.cloudflareaccess.com" }))).resolves.toBeNull();
    await expect(verify(await token({ email: "a@b.c" }, { expires: "-1m" }))).resolves.toBeNull();
  });

  it("rejects tokens without email and missing tokens", async () => {
    await expect(verify(await token({ sub: "service" }))).resolves.toBeNull();
    await expect(verify(null)).resolves.toBeNull();
  });
});

describe("resolveIdentity", () => {
  it("ignores the unsigned email header", async () => {
    const result = await resolveIdentity(headers({ "cf-access-authenticated-user-email": "owner@example.com" }), { NODE_ENV: "production" }, verify);
    expect(result).toBeNull();
  });

  it("uses the verified JWT", async () => {
    const jwt = await token({ email: "owner@example.com" });
    await expect(resolveIdentity(headers({ "cf-access-jwt-assertion": jwt }), { NODE_ENV: "production" }, verify)).resolves.toMatchObject({ email: "owner@example.com" });
  });

  it("allows DEV_USER_EMAIL only outside production", async () => {
    await expect(resolveIdentity(headers({}), { NODE_ENV: "production", DEV_USER_EMAIL: "dev@x.y" }, null)).resolves.toBeNull();
    await expect(resolveIdentity(headers({}), { NODE_ENV: "development", DEV_USER_EMAIL: "Dev@x.y" }, null)).resolves.toEqual({ email: "dev@x.y", subject: "dev" });
  });
});
```

- [ ] **Step 2: Uruchom — ma nie przejść**

Run: `npx vitest run src/server/lib/cloudflare-access.test.ts`
Expected: FAIL — `Cannot find module './cloudflare-access'`.

- [ ] **Step 3: Implementacja `src/server/lib/cloudflare-access.ts`**

```ts
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

export interface AccessIdentity {
  email: string;
  subject: string;
}

export type AccessVerify = (token: string | null | undefined) => Promise<AccessIdentity | null>;

export function normalizeTeamDomain(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com")) {
    throw new Error("CF_ACCESS_TEAM_DOMAIN must look like https://<team>.cloudflareaccess.com");
  }
  return `https://${url.hostname}`;
}

export function createAccessVerifier(options: { teamDomain: string; audience: string; keySet?: JWTVerifyGetKey }): AccessVerify {
  const issuer = normalizeTeamDomain(options.teamDomain);
  const keySet = options.keySet ?? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));

  return async (token) => {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, keySet, {
        issuer,
        audience: options.audience,
        algorithms: ["RS256"],
      });
      const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      return email ? { email, subject: String(payload.sub ?? "") } : null;
    } catch {
      return null;
    }
  };
}

let cachedVerifier: { key: string; verify: AccessVerify } | null = null;

export function getAccessVerifierFromEnv(env: NodeJS.ProcessEnv = process.env): AccessVerify | null {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.CF_ACCESS_AUD?.trim();
  if (!teamDomain || !audience) return null;

  const key = `${teamDomain}|${audience}`;
  if (!cachedVerifier || cachedVerifier.key !== key) {
    cachedVerifier = { key, verify: createAccessVerifier({ teamDomain, audience }) };
  }
  return cachedVerifier.verify;
}

export async function resolveIdentity(
  headers: { get(name: string): string | null },
  env: NodeJS.ProcessEnv = process.env,
  verify: AccessVerify | null = getAccessVerifierFromEnv(env)
): Promise<AccessIdentity | null> {
  if (verify) {
    const identity = await verify(headers.get(ACCESS_JWT_HEADER));
    if (identity) return identity;
  }

  // Local development only. Production never trusts a configured identity.
  if (env.NODE_ENV !== "production" && env.DEV_USER_EMAIL) {
    return { email: env.DEV_USER_EMAIL.trim().toLowerCase(), subject: "dev" };
  }

  return null;
}
```

- [ ] **Step 4: Uruchom testy**

Run: `npx vitest run src/server/lib/cloudflare-access.test.ts`
Expected: PASS, 8 testów.

- [ ] **Step 5: Commit**

```bash
git add src/server/lib/cloudflare-access.ts src/server/lib/cloudflare-access.test.ts
git commit -m "feat: verify Cloudflare Access JWT assertions"
```

---

### Task 3: Polityka uwierzytelniania i przepięcie `auth.ts`

**Files:**
- Create: `src/server/lib/auth-policy.ts`
- Test: `src/server/lib/auth-policy.test.ts`
- Modify: `src/server/lib/auth.ts` (funkcje `isAllowedUser`, `requirePinVerification`, `getAuthenticatedIdentity`)
- Modify: `src/app/api/auth/status/route.ts`

**Interfaces:**
- Consumes: `resolveIdentity` z Task 2.
- Produces:
  - `export function parseOwnerEmails(env?: NodeJS.ProcessEnv): string[]`
  - `export function isOwnerEmail(email: string, env?: NodeJS.ProcessEnv): boolean`
  - `export function isPinBypassAllowed(env?: NodeJS.ProcessEnv): boolean`

- [ ] **Step 1: Testy `src/server/lib/auth-policy.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { isOwnerEmail, isPinBypassAllowed, parseOwnerEmails } from "./auth-policy";

describe("auth-policy", () => {
  it("parses comma separated owner emails case-insensitively", () => {
    expect(parseOwnerEmails({ OWNER_EMAILS: " A@x.pl, b@y.pl ,," })).toEqual(["a@x.pl", "b@y.pl"]);
    expect(isOwnerEmail("B@Y.pl", { OWNER_EMAILS: "a@x.pl,b@y.pl" })).toBe(true);
    expect(isOwnerEmail("c@z.pl", { OWNER_EMAILS: "" })).toBe(false);
  });

  it("never bypasses the PIN in production", () => {
    expect(isPinBypassAllowed({ NODE_ENV: "production", DEV_SKIP_PIN: "true" })).toBe(false);
    expect(isPinBypassAllowed({ NODE_ENV: "development", DEV_SKIP_PIN: "true" })).toBe(true);
    expect(isPinBypassAllowed({ NODE_ENV: "development" })).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/lib/auth-policy.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `src/server/lib/auth-policy.ts`**

```ts
export function parseOwnerEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.OWNER_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return parseOwnerEmails(env).includes(email.trim().toLowerCase());
}

export function isPinBypassAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && env.DEV_SKIP_PIN === "true";
}
```

- [ ] **Step 4: Przepnij `src/server/lib/auth.ts`**

Dodaj importy na górze pliku:

```ts
import { isOwnerEmail, isPinBypassAllowed } from "./auth-policy";
import { resolveIdentity } from "./cloudflare-access";
```

Zastąp ciało `isAllowedUser`:

```ts
export async function isAllowedUser(): Promise<boolean> {
  const user = await getCurrentUser();
  return Boolean(user && isOwnerEmail(user.email));
}
```

W `requirePinVerification` zastąp blok `if (process.env.DEV_SKIP_PIN === "true") {` na:

```ts
  if (isPinBypassAllowed()) {
    return { ...user, isPinVerified: true };
  }
```

Zastąp całą funkcję `getAuthenticatedIdentity`:

```ts
async function getAuthenticatedIdentity(): Promise<{ email: string; country?: string } | null> {
  const headersList = await headers();
  const identity = await resolveIdentity(headersList);
  if (!identity) return null;

  return {
    email: identity.email,
    country: headersList.get(CF_ACCESS_COUNTRY_HEADER) || undefined,
  };
}
```

Usuń nieużywaną stałą `CF_ACCESS_EMAIL_HEADER`.

- [ ] **Step 5: Popraw `src/app/api/auth/status/route.ts`**

```ts
import { NextResponse } from "next/server";
import { isPinBypassAllowed } from "@/server/lib/auth-policy";

export async function GET() {
  return NextResponse.json({ devSkipPin: isPinBypassAllowed() });
}
```

- [ ] **Step 6: Testy i typy**

Run: `npm test && npm run typecheck`
Expected: PASS, brak błędów TypeScript.

- [ ] **Step 7: Commit**

```bash
git add src/server/lib/auth-policy.ts src/server/lib/auth-policy.test.ts src/server/lib/auth.ts src/app/api/auth/status/route.ts
git commit -m "fix: trust only verified Access identities and keep PIN in production"
```

---

### Task 4: Globalna bramka `src/proxy.ts`

Dziś `(dashboard)/layout.tsx` nie sprawdza tożsamości, więc strony renderują dane każdemu, kto dotrze do portu 3100.

**Files:**
- Create: `src/server/lib/public-paths.ts`
- Test: `src/server/lib/public-paths.test.ts`
- Create: `src/proxy.ts`

**Interfaces:**
- Consumes: `resolveIdentity` (Task 2), `isOwnerEmail` (Task 3).
- Produces: `export function isPublicPath(pathname: string): boolean`

- [ ] **Step 1: Test `src/server/lib/public-paths.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it("allows health, GitHub webhook and cron endpoints", () => {
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/github/webhook")).toBe(true);
    expect(isPublicPath("/api/github/webhook/")).toBe(true);
    expect(isPublicPath("/api/cron/monitoring")).toBe(true);
  });

  it("does not allow look-alike or nested paths", () => {
    expect(isPublicPath("/api/healthz")).toBe(false);
    expect(isPublicPath("/api/github/webhooks")).toBe(false);
    expect(isPublicPath("/api/github/webhook/extra")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/api/terminal")).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/lib/public-paths.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `src/server/lib/public-paths.ts`**

```ts
// Endpoints reachable without a Cloudflare Access identity. Each one performs
// its own authentication: HMAC signature (webhook), CRON_SECRET (cron) or
// exposes nothing sensitive (health).
const PUBLIC_PATHS = new Set(["/api/health", "/api/github/webhook", "/api/cron/monitoring"]);

export function isPublicPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_PATHS.has(normalized);
}
```

- [ ] **Step 4: Uruchom test — PASS**

Run: `npx vitest run src/server/lib/public-paths.test.ts`
Expected: PASS.

- [ ] **Step 5: Utwórz `src/proxy.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { isOwnerEmail } from "@/server/lib/auth-policy";
import { resolveIdentity } from "@/server/lib/cloudflare-access";
import { isPublicPath } from "@/server/lib/public-paths";

export async function proxy(request: NextRequest) {
  if (process.env.DEMO_MODE === "true" || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const identity = await resolveIdentity(request.headers);
  if (identity && isOwnerEmail(identity.email)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "Wymagane logowanie przez Cloudflare Access." }, { status: 401 });
  }

  return new NextResponse("Brak dostępu. Otwórz dashboard przez https://dashboard.marczelloo.dev i zaloguj się przez Cloudflare Access.", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};
```

- [ ] **Step 6: Weryfikacja lokalna**

Run: `npm run build`
Expected: build przechodzi; w wyjściu widnieje `ƒ Proxy`.

Run (dev, bez CF, z `NODE_ENV=development` i `DEV_USER_EMAIL` będącym w `OWNER_EMAILS` w `.env.local`): `npm run dev`, potem `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health` → `200`.
Run z usuniętym `DEV_USER_EMAIL`: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard` → `403`.

- [ ] **Step 7: Commit**

```bash
git add src/server/lib/public-paths.ts src/server/lib/public-paths.test.ts src/proxy.ts
git commit -m "feat: gate every request behind Cloudflare Access identity"
```

---

### Task 5: Allowlista w endpointach sprawdzających tylko zalogowanie

**Files:**
- Modify: `src/app/api/work-items/[itemId]/route.ts`
- Modify: `src/app/api/notifications/route.ts`
- Modify: `src/app/api/notifications/read-all/route.ts`
- Modify: `src/app/api/pi/metrics/route.ts`
- Modify: `src/app/api/services/[id]/route.ts`
- Modify: `src/app/api/services/[id]/restart/route.ts`

**Interfaces:**
- Consumes: `isAllowedUser`, `requirePinVerification`, `AuthError` z `src/server/lib/auth.ts`.

- [ ] **Step 1: W pięciu plikach (bez `restart`) zamień warunek**

W każdym pliku import `getCurrentUser` zamień na:

```ts
import { getCurrentUser, isAllowedUser } from "@/server/lib/auth";
```

a warunek `if (!user) {` bezpośrednio po `const user = await getCurrentUser();` na:

```ts
    if (!user || !(await isAllowedUser())) {
```

Treść odpowiedzi 401 w bloku zostaje bez zmian.

- [ ] **Step 2: `services/[id]/restart/route.ts` wymaga PIN**

Zamień import `getCurrentUser` na:

```ts
import { AuthError, requirePinVerification } from "@/server/lib/auth";
```

Zamień początek bloku `try`:

```ts
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
```

na:

```ts
    await requirePinVerification();
```

W bloku `catch` na początku dodaj:

```ts
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message, requirePin: error.code === "PIN_REQUIRED" },
        { status: error.code === "NOT_AUTHENTICATED" ? 401 : 403 }
      );
    }
```

- [ ] **Step 3: Sprawdź, że nie został żaden sam `getCurrentUser` bez allowlisty w API**

Run: `git grep -n "getCurrentUser()" -- src/app/api`
Expected: każde trafienie ma w następnej linii `isAllowedUser`.

- [ ] **Step 4: Typy i lint**

Run: `npm run typecheck && npm run lint`
Expected: brak błędów.

- [ ] **Step 5: Commit**

```bash
git add src/app/api
git commit -m "fix: require owner allowlist on session-only API routes"
```

---

### Task 6: Webhook — gałąź z konfiguracji, podpis obowiązkowy, port trasy

**Files:**
- Create: `src/server/deployments/routing.ts`
- Test: `src/server/deployments/routing.test.ts`
- Modify: `src/server/deployments/index.ts`
- Modify: `src/app/api/github/webhook/route.ts:142-155, 236-237`
- Modify: `src/server/github/client.ts:833-836`
- Modify: `src/app/actions/projects.ts:153-154, 487`

**Interfaces:**
- Produces:
  - `export function parseLocalPortFromService(service: string): number | null`
  - `export function resolveAutoDeployBranch(pushBranch: string, configuredBranch: string | null): { deploy: true; branch: string } | { deploy: false; reason: string }`

- [ ] **Step 1: Testy `src/server/deployments/routing.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseLocalPortFromService, resolveAutoDeployBranch } from "./routing";

describe("parseLocalPortFromService", () => {
  it("reads loopback ports", () => {
    expect(parseLocalPortFromService("http://127.0.0.1:3030")).toBe(3030);
    expect(parseLocalPortFromService("http://localhost:3200/")).toBe(3200);
    expect(parseLocalPortFromService("https://[::1]:9000")).toBe(9000);
  });

  it("ignores non-loopback and invalid services", () => {
    expect(parseLocalPortFromService("http://minio:9000")).toBeNull();
    expect(parseLocalPortFromService("http_status:404")).toBeNull();
    expect(parseLocalPortFromService("http://127.0.0.1:70000")).toBeNull();
  });
});

describe("resolveAutoDeployBranch", () => {
  it("deploys only the configured branch", () => {
    expect(resolveAutoDeployBranch("main", "main")).toEqual({ deploy: true, branch: "main" });
    expect(resolveAutoDeployBranch("perf/gateway", "main")).toEqual({ deploy: false, reason: "Push do perf/gateway; auto-deploy obejmuje tylko main." });
    expect(resolveAutoDeployBranch("main", "develop")).toMatchObject({ deploy: false });
  });

  it("falls back to main/master for legacy projects", () => {
    expect(resolveAutoDeployBranch("master", null)).toEqual({ deploy: true, branch: "master" });
    expect(resolveAutoDeployBranch("feature/x", null)).toMatchObject({ deploy: false });
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/deployments/routing.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `src/server/deployments/routing.ts`**

```ts
export function parseLocalPortFromService(service: string): number | null {
  const match = /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d{1,5})\/?$/i.exec(service.trim());
  if (!match) return null;
  const port = Number(match[1]);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

export function resolveAutoDeployBranch(
  pushBranch: string,
  configuredBranch: string | null
): { deploy: true; branch: string } | { deploy: false; reason: string } {
  if (configuredBranch) {
    return pushBranch === configuredBranch
      ? { deploy: true, branch: configuredBranch }
      : { deploy: false, reason: `Push do ${pushBranch}; auto-deploy obejmuje tylko ${configuredBranch}.` };
  }

  return pushBranch === "main" || pushBranch === "master"
    ? { deploy: true, branch: pushBranch }
    : { deploy: false, reason: `Push do ${pushBranch}; projekt bez konfiguracji wdraża tylko main/master.` };
}
```

Dopisz w `src/server/deployments/index.ts`:

```ts
export * from "./routing";
```

- [ ] **Step 4: Uruchom test — PASS**

Run: `npx vitest run src/server/deployments/routing.test.ts`
Expected: PASS.

- [ ] **Step 5: Webhook używa gałęzi z konfiguracji**

W `src/app/api/github/webhook/route.ts` dodaj import:

```ts
import { getDeploymentConfig, resolveAutoDeployBranch } from "@/server/deployments";
```

Zastąp blok:

```ts
    // Check if this branch should trigger deploy
    // For now, deploy on push to default branch (main/master)
    const shouldDeploy = branch === "main" || branch === "master";

    if (!shouldDeploy) {
      results.push({
        projectId: project.id,
        projectName: project.name,
        deployed: false,
        reason: `Branch ${branch} not configured for auto-deploy`,
      });
      continue;
    }
```

na:

```ts
    const deploymentConfig = await getDeploymentConfig(project.id);
    const decision = resolveAutoDeployBranch(branch, deploymentConfig?.branch ?? null);

    if (!decision.deploy) {
      results.push({ projectId: project.id, projectName: project.name, deployed: false, reason: decision.reason });
      continue;
    }
```

Zastąp wywołanie:

```ts
      const deployResult = await internalDeployProject(project.id, "github-webhook", { branch });
```

na:

```ts
      // Managed projects deploy their configured branch; legacy ones the pushed branch.
      const deployResult = await internalDeployProject(project.id, "github-webhook", deploymentConfig ? {} : { branch: decision.branch });
```

- [ ] **Step 6: Podpis webhooka obowiązkowy**

W `src/server/github/client.ts` zamień:

```ts
  if (!config.webhookSecret) {
    console.warn("[GitHub] No webhook secret configured, skipping signature verification");
    return true;
  }
```

na:

```ts
  if (!config.webhookSecret) {
    console.error("[GitHub] GITHUB_WEBHOOK_SECRET is not configured; rejecting webhook");
    return false;
  }
```

- [ ] **Step 7: Napraw adopcję trasy (D8)**

W `src/app/actions/projects.ts` dodaj `parseLocalPortFromService` do importu z `@/server/deployments`. Zamień linie 153–154:

```ts
      const portMatch = route && /(?:127\\.0\\.0\\.1|localhost):(\\d+)$/.exec(route.service);
      const localPort = portMatch ? Number(portMatch[1]) : 0;
```

na:

```ts
      const localPort = route ? parseLocalPortFromService(route.service) ?? 0 : 0;
```

Zamień linię 487–488:

```ts
    const portMatch = route && /(?:127\.0\.0\.1|localhost):(\d+)$/.exec(route.service);
    const actualRoute = route ? { hostname: route.hostname, service: route.service, localPort: portMatch ? Number(portMatch[1]) : null } : null;
```

na:

```ts
    const actualRoute = route ? { hostname: route.hostname, service: route.service, localPort: parseLocalPortFromService(route.service) } : null;
```

- [ ] **Step 8: Testy, typy, lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/server/deployments src/app/api/github/webhook/route.ts src/server/github/client.ts src/app/actions/projects.ts
git commit -m "fix: auto-deploy configured branch only and require webhook secret"
```

---

### Task 7: Usunięcie martwych i niedziałających ścieżek deployu (D1, D2)

**Files:**
- Delete: `src/components/features/deploy-all-button.tsx`
- Delete: `src/app/api/deploy/route.ts`
- Delete: `src/app/api/deploy/all/route.ts`
- Modify: `src/app/(dashboard)/projects/[id]/_components/project-detail-tabs.tsx:9, 332-339`
- Modify: `src/app/(dashboard)/dashboard/_components/quick-actions.tsx`
- Modify: `src/app/actions/services.ts:137-209`
- Modify: `src/app/(dashboard)/services/[id]/page.tsx`
- Modify: `src/app/(dashboard)/projects/[id]/services/[serviceId]/page.tsx`
- Modify: `src/server/runner/client.ts` (funkcja `deploy`)
- Modify: `src/app/actions/projects.ts:642-1102` (`safeSelfDeploy`)

- [ ] **Step 1: Usuń pliki**

```bash
git rm src/components/features/deploy-all-button.tsx src/app/api/deploy/route.ts src/app/api/deploy/all/route.ts
```

- [ ] **Step 2: `project-detail-tabs.tsx`**

Usuń linię `import { DeployAllButton } from "@/components/features/deploy-all-button";` oraz cały element:

```tsx
              <DeployAllButton
                services={services.map((s) => ({
                  id: s.id,
                  name: s.name,
                  type: s.type,
                  deploy_strategy: s.deploy_strategy,
                }))}
                projectId={project.id}
              />
```

- [ ] **Step 3: `quick-actions.tsx`**

Usuń: stan `deploying` i `deployResult` (linie z `useState` dla obu), funkcję `handleDeployAll`, przycisk z tekstem `Deploy All` oraz ostatni `<Dialog open={deployResult.open} …>…</Dialog>`. Z importu `lucide-react` usuń `Rocket`.

- [ ] **Step 4: `services.ts` — usuń `deployServiceAction`**

Usuń całą funkcję `deployServiceAction` (od komentarza nad `export async function deployServiceAction` do jej zamykającego `}`). Następnie:

Run: `git grep -n "runner\.\|notifications\.\|deploys\." -- src/app/actions/services.ts`
Expected: jeśli brak trafień dla danego modułu, usuń jego import z góry pliku.

- [ ] **Step 5: Strony serwisu — usuń przycisk Deploy**

W `src/app/(dashboard)/services/[id]/page.tsx` i `src/app/(dashboard)/projects/[id]/services/[serviceId]/page.tsx`:
- w imporcie z `@/app/actions/services` usuń `deployServiceAction`;
- usuń `const [isDeploying, setIsDeploying] = useState(false);`;
- usuń całą funkcję `const handleDeploy = async () => { … };`;
- usuń element `<Button variant="default" size="sm" onClick={handleDeploy} …>…</Button>`;
- zamień każde `|| isDeploying` na nic (warunki `disabled`).

Pole formularza „Deploy Strategy” zostaje — to dane serwisu.

- [ ] **Step 6: Runner client i `safeSelfDeploy`**

Run: `git grep -n "\.deploy(\|safeSelfDeploy\|dockerRebuild\|composeUp" -- src`
Expected: trafienia wyłącznie w definicjach w `src/server/runner/client.ts` i `src/app/actions/projects.ts`.

Usuń z `src/server/runner/client.ts` funkcje `deploy`, `dockerRebuild` i `composeUp` (sekcja „Deployment Workflows” oraz dwie funkcje nad nią). Usuń z `src/app/actions/projects.ts` blok od komentarza `/**\n * Safe self-deployment with health checks and automatic rollback.` do końca funkcji `safeSelfDeploy`.

- [ ] **Step 7: Build, lint, testy**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: PASS; `git grep -n "api/deploy\"\|api/deploy/all" -- src` bez trafień.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "refactor: remove broken service-level deploy paths and dead self-deploy"
```

---

### Task 8: Parser i serializer plików env (E3)

**Files:**
- Create: `src/server/env/dotenv.ts`
- Test: `src/server/env/dotenv.test.ts`

**Interfaces:**
- Produces:
  - `export interface EnvEntry { key: string; value: string }`
  - `export type EnvLine = { kind: "entry"; key: string; value: string; raw: string } | { kind: "other"; raw: string }`
  - `export function parseEnvLines(content: string): EnvLine[]`
  - `export function parseEnvEntries(content: string): EnvEntry[]` (ostatnie wystąpienie klucza wygrywa, tak jak w Compose)
  - `export function formatEnvValue(value: string): string`
  - `export function updateEnvContent(original: string, vars: EnvEntry[]): string`

- [ ] **Step 1: Testy `src/server/env/dotenv.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { formatEnvValue, parseEnvEntries, parseEnvLines, updateEnvContent } from "./dotenv";

describe("parseEnvLines", () => {
  it("parses unquoted, single and double quoted values", () => {
    const entries = parseEnvEntries([
      "# comment",
      "A=plain value # trailing comment",
      "B='$2a$10$literal # not comment'",
      'C="line1\\nline2 \\"q\\""',
      "export D=exported",
      "E=",
    ].join("\n"));
    expect(entries).toEqual([
      { key: "A", value: "plain value" },
      { key: "B", value: "$2a$10$literal # not comment" },
      { key: "C", value: 'line1\nline2 "q"' },
      { key: "D", value: "exported" },
      { key: "E", value: "" },
    ]);
  });

  it("supports double-quoted values spanning lines", () => {
    expect(parseEnvEntries('KEY="-----BEGIN\nabc\n-----END"\nNEXT=1')).toEqual([
      { key: "KEY", value: "-----BEGIN\nabc\n-----END" },
      { key: "NEXT", value: "1" },
    ]);
  });

  it("keeps non-entry lines", () => {
    expect(parseEnvLines("# a\n\nnot an entry\nX=1").map((line) => line.kind)).toEqual(["other", "other", "other", "entry"]);
  });

  it("uses the last duplicate like Compose", () => {
    expect(parseEnvEntries("X=1\nX=2")).toEqual([{ key: "X", value: "2" }]);
  });
});

describe("formatEnvValue", () => {
  it("leaves safe values unquoted", () => {
    expect(formatEnvValue("https://api-atlashub.marczelloo.dev")).toBe("https://api-atlashub.marczelloo.dev");
    expect(formatEnvValue("")).toBe("");
  });

  it("single-quotes values Compose would interpolate or split", () => {
    expect(formatEnvValue("$2a$10$abc")).toBe("'$2a$10$abc'");
    expect(formatEnvValue("two words")).toBe("'two words'");
    expect(formatEnvValue("a#b")).toBe("'a#b'");
  });

  it("double-quotes multi-line or apostrophe values without dollars", () => {
    expect(formatEnvValue("it's")).toBe(`"it's"`);
    expect(formatEnvValue("a\nb")).toBe('"a\\nb"');
  });

  it("refuses values combining $ with apostrophe or newline", () => {
    expect(() => formatEnvValue("it's $5")).toThrow(/ręcznie/);
  });

  it("round-trips through the parser", () => {
    for (const value of ["$2a$10$abc", "two words", "it's", "a\nb", 'q"uote', "back\\slash", "plain"]) {
      expect(parseEnvEntries(`K=${formatEnvValue(value)}`)).toEqual([{ key: "K", value }]);
    }
  });
});

describe("updateEnvContent", () => {
  it("keeps comments, order and untouched formatting", () => {
    const original = "# AtlasHub\nA=1\nB='x y'\n\n# tail\nC=3\n";
    const next = updateEnvContent(original, [
      { key: "A", value: "1" },
      { key: "B", value: "changed $value" },
      { key: "D", value: "new" },
    ]);
    expect(next).toBe("# AtlasHub\nA=1\nB='changed $value'\n\n# tail\nD=new\n");
  });

  it("drops later duplicates of an updated key", () => {
    expect(updateEnvContent("X=1\nX=2\n", [{ key: "X", value: "3" }])).toBe("X=3\n");
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/env/dotenv.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `src/server/env/dotenv.ts`**

```ts
export interface EnvEntry {
  key: string;
  value: string;
}

export type EnvLine = { kind: "entry"; key: string; value: string; raw: string } | { kind: "other"; raw: string };

const ENTRY = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

function closingQuoteIndex(body: string): number {
  let escaped = false;
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"') {
      return index;
    }
  }
  return -1;
}

function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\([\\"nrt])/g, (_match, char: string) => ({ n: "\n", r: "\r", t: "\t" })[char as "n" | "r" | "t"] ?? char);
}

export function parseEnvLines(content: string): EnvLine[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  const result: EnvLine[] = [];

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const match = ENTRY.exec(raw);
    if (!match) {
      result.push({ kind: "other", raw });
      continue;
    }

    const [, key, rest] = match;
    const value = rest.trimStart();

    if (value.startsWith('"')) {
      let body = value.slice(1);
      let block = raw;
      while (closingQuoteIndex(body) === -1 && index + 1 < lines.length) {
        index++;
        body += `\n${lines[index]}`;
        block += `\n${lines[index]}`;
      }
      const end = closingQuoteIndex(body);
      result.push({ kind: "entry", key, value: unescapeDoubleQuoted(end === -1 ? body : body.slice(0, end)), raw: block });
    } else if (value.startsWith("'")) {
      const end = value.indexOf("'", 1);
      result.push({ kind: "entry", key, value: end === -1 ? value.slice(1) : value.slice(1, end), raw });
    } else {
      const comment = value.search(/\s#/);
      result.push({ kind: "entry", key, value: (comment === -1 ? value : value.slice(0, comment)).trim(), raw });
    }
  }

  return result;
}

export function parseEnvEntries(content: string): EnvEntry[] {
  const byKey = new Map<string, string>();
  for (const line of parseEnvLines(content)) {
    if (line.kind !== "entry") continue;
    byKey.delete(line.key);
    byKey.set(line.key, line.value);
  }
  return [...byKey].map(([key, value]) => ({ key, value }));
}

export function formatEnvValue(value: string): string {
  if (value === "") return "";
  if (!/[\s#"'$\\`]/.test(value)) return value;
  if (!value.includes("'") && !value.includes("\n")) return `'${value}'`;
  if (value.includes("$")) {
    throw new Error("Wartość zawiera jednocześnie znak $ oraz apostrof lub nową linię — wpisz ją ręcznie w pliku na serwerze.");
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

export function updateEnvContent(original: string, vars: EnvEntry[]): string {
  const wanted = new Map(vars.map((variable) => [variable.key, variable.value]));
  const written = new Set<string>();
  const output: string[] = [];

  for (const line of parseEnvLines(original)) {
    if (line.kind === "other") {
      output.push(line.raw);
      continue;
    }
    if (!wanted.has(line.key) || written.has(line.key)) continue;

    const value = wanted.get(line.key)!;
    output.push(line.value === value ? line.raw : `${line.key}=${formatEnvValue(value)}`);
    written.add(line.key);
  }

  for (const variable of vars) {
    if (!written.has(variable.key)) {
      output.push(`${variable.key}=${formatEnvValue(variable.value)}`);
      written.add(variable.key);
    }
  }

  return output.length ? `${output.join("\n")}\n` : "";
}
```

Uwaga do testu „keeps comments”: linia `C=3` znika, bo `C` nie ma na liście — pusty wiersz i komentarz `# tail` zostają.

- [ ] **Step 4: Uruchom testy — PASS**

Run: `npx vitest run src/server/env/dotenv.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/env
git commit -m "feat: compose-compatible env file parser and serializer"
```

---

### Task 9: Zapis env przez parser i stosowanie przez odtworzenie kontenerów (E1, E3)

**Files:**
- Create: `src/server/deployments/compose-stack.ts`
- Test: `src/server/deployments/compose-stack.test.ts`
- Modify: `src/server/deployments/host.ts` (nowa funkcja `resolveComposeStack`)
- Modify: `src/server/deployments/index.ts`
- Modify: `src/app/api/env-vars/save-file/route.ts`
- Modify: `src/app/api/env-vars/load-file/route.ts`
- Create: `src/app/api/services/[id]/apply-env/route.ts`
- Modify: `src/components/features/env-manager.tsx:366-406`

**Interfaces:**
- Consumes: `parseEnvEntries`, `updateEnvContent` (Task 8); `runHostCommand`, `shellQuote`.
- Produces:
  - `export const SELF_COMPOSE_PROJECT = "marczelloo-dashboard"`
  - `export interface ComposeContainerInfo { labels: Record<string, string>; status: string }`
  - `export interface ComposeStack { project: string; workingDir: string; configFiles: string[]; services: string[] }`
  - `export function stackFromContainers(project: string, containers: ComposeContainerInfo[]): ComposeStack`
  - `export function buildComposeRecreateCommand(stack: ComposeStack): string`
  - `export async function resolveComposeStack(hint: { containerName?: string | null; composeProject?: string | null }): Promise<ComposeStack>` (w `host.ts`)

- [ ] **Step 1: Testy `src/server/deployments/compose-stack.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildComposeRecreateCommand, stackFromContainers } from "./compose-stack";

const labels = (service: string, extra: Record<string, string> = {}) => ({
  "com.docker.compose.project": "marczelloo-tools",
  "com.docker.compose.service": service,
  "com.docker.compose.project.working_dir": "/home/Marczelloo_pi/projects/marczelloo-tools",
  "com.docker.compose.project.config_files":
    "/home/Marczelloo_pi/projects/marczelloo-tools/docker-compose.yml,/home/Marczelloo_pi/projects/.dashboard/deploy-logs/compose-overrides/marczelloo-tools.yaml",
  ...extra,
});

describe("stackFromContainers", () => {
  it("reads working dir, all config files and running services", () => {
    const stack = stackFromContainers("marczelloo-tools", [
      { labels: labels("app"), status: "running" },
      { labels: labels("bootstrap"), status: "exited" },
      { labels: labels("app", { "com.docker.compose.oneoff": "True" }), status: "running" },
    ]);
    expect(stack).toEqual({
      project: "marczelloo-tools",
      workingDir: "/home/Marczelloo_pi/projects/marczelloo-tools",
      configFiles: [
        "/home/Marczelloo_pi/projects/marczelloo-tools/docker-compose.yml",
        "/home/Marczelloo_pi/projects/.dashboard/deploy-logs/compose-overrides/marczelloo-tools.yaml",
      ],
      services: ["app"],
    });
  });

  it("refuses containers from inconsistent compose invocations", () => {
    expect(() =>
      stackFromContainers("marczelloo-tools", [
        { labels: labels("app"), status: "running" },
        { labels: labels("worker", { "com.docker.compose.project.working_dir": "/tmp/x" }), status: "running" },
      ])
    ).toThrow(/różnych/);
  });

  it("refuses a stack without running services", () => {
    expect(() => stackFromContainers("marczelloo-tools", [{ labels: labels("app"), status: "exited" }])).toThrow(/działających/);
  });
});

describe("buildComposeRecreateCommand", () => {
  it("recreates only named services without building", () => {
    expect(
      buildComposeRecreateCommand({
        project: "atlas-hub",
        workingDir: "/home/Marczelloo_pi/projects/atlas-hub",
        configFiles: ["/home/Marczelloo_pi/projects/atlas-hub/docker-compose.yml"],
        services: ["gateway", "dashboard"],
      })
    ).toBe(
      "docker compose -p 'atlas-hub' --project-directory '/home/Marczelloo_pi/projects/atlas-hub' -f '/home/Marczelloo_pi/projects/atlas-hub/docker-compose.yml' up -d --no-build 'gateway' 'dashboard'"
    );
  });

  it("rejects unsafe identifiers and paths", () => {
    const base = { project: "x", workingDir: "/home/a", configFiles: ["/home/a/c.yml"], services: ["s"] };
    expect(() => buildComposeRecreateCommand({ ...base, project: "x;rm" })).toThrow();
    expect(() => buildComposeRecreateCommand({ ...base, workingDir: "relative" })).toThrow();
    expect(() => buildComposeRecreateCommand({ ...base, configFiles: ["/home/../etc/c.yml"] })).toThrow();
    expect(() => buildComposeRecreateCommand({ ...base, services: ["s s"] })).toThrow();
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/deployments/compose-stack.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `src/server/deployments/compose-stack.ts`**

```ts
import { shellQuote } from "@/server/runner/safe-paths";

export const SELF_COMPOSE_PROJECT = "marczelloo-dashboard";

export interface ComposeContainerInfo {
  labels: Record<string, string>;
  status: string;
}

export interface ComposeStack {
  project: string;
  workingDir: string;
  configFiles: string[];
  services: string[];
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const ABSOLUTE_PATH = /^\/[A-Za-z0-9._/@+-]+$/;

function assertPath(value: string, label: string) {
  if (!ABSOLUTE_PATH.test(value) || value.split("/").includes("..")) {
    throw new Error(`Nieprawidłowa ścieżka ${label}: ${value}`);
  }
}

export function stackFromContainers(project: string, containers: ComposeContainerInfo[]): ComposeStack {
  const regular = containers.filter((container) => container.labels["com.docker.compose.oneoff"] !== "True");
  const invocations = new Set(
    regular.map((container) => `${container.labels["com.docker.compose.project.working_dir"]}|${container.labels["com.docker.compose.project.config_files"]}`)
  );
  if (invocations.size !== 1) {
    throw new Error(`Kontenery projektu ${project} pochodzą z różnych wywołań Compose — zastosuj env ręcznie.`);
  }

  const [workingDir, configFiles] = [...invocations][0].split("|");
  const services = [
    ...new Set(
      regular
        .filter((container) => container.status === "running" || container.status === "restarting")
        .map((container) => container.labels["com.docker.compose.service"])
        .filter(Boolean)
    ),
  ];
  if (!services.length) {
    throw new Error(`Projekt ${project} nie ma działających usług do odtworzenia.`);
  }

  return { project, workingDir, configFiles: configFiles.split(",").filter(Boolean), services };
}

export function buildComposeRecreateCommand(stack: ComposeStack): string {
  if (!IDENTIFIER.test(stack.project)) throw new Error("Nieprawidłowa nazwa projektu Compose.");
  assertPath(stack.workingDir, "katalogu projektu");
  stack.configFiles.forEach((file) => assertPath(file, "pliku Compose"));
  if (!stack.services.length || stack.services.some((service) => !IDENTIFIER.test(service))) {
    throw new Error("Nieprawidłowa lista usług Compose.");
  }

  const files = stack.configFiles.map((file) => `-f ${shellQuote(file)}`).join(" ");
  const services = stack.services.map(shellQuote).join(" ");
  return `docker compose -p ${shellQuote(stack.project)} --project-directory ${shellQuote(stack.workingDir)} ${files} up -d --no-build ${services}`;
}
```

Dopisz w `src/server/deployments/index.ts`:

```ts
export * from "./compose-stack";
```

- [ ] **Step 4: Uruchom test — PASS**

Run: `npx vitest run src/server/deployments/compose-stack.test.ts`
Expected: PASS.

- [ ] **Step 5: `resolveComposeStack` w `src/server/deployments/host.ts`**

Dodaj import na górze:

```ts
import { stackFromContainers, type ComposeContainerInfo, type ComposeStack } from "./compose-stack";
```

Dopisz na końcu pliku:

```ts
/**
 * Resolve a Compose stack from the labels Docker stored when the containers
 * were created. Labels are authoritative: service rows in the database can
 * carry a wrong compose_project (for example "marczelloodashboard").
 */
export async function resolveComposeStack(hint: { containerName?: string | null; composeProject?: string | null }): Promise<ComposeStack> {
  const container = hint.containerName && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(hint.containerName) ? hint.containerName : "";
  const project = hint.composeProject && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(hint.composeProject) ? hint.composeProject : "";
  const command = `set -eu
project=""
if [ -n ${shellQuote(container)} ]; then
  project="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' ${shellQuote(container)} 2>/dev/null || true)"
fi
if [ -z "$project" ]; then project=${shellQuote(project)}; fi
if [ -z "$project" ]; then echo "Serwis nie wskazuje kontenera ani projektu Compose." >&2; exit 3; fi
ids="$(docker ps -aq --filter "label=com.docker.compose.project=$project")"
if [ -z "$ids" ]; then echo "Brak kontenerów projektu Compose $project." >&2; exit 4; fi
echo "PROJECT=$project"
docker inspect $ids --format '{"labels":{{json .Config.Labels}},"status":{{json .State.Status}}}'`;

  const result = await runHostCommand(command, 20_000);
  if (!result.success) throw new Error(result.stderr || "Nie udało się odczytać projektu Compose.");

  const resolvedProject = /^PROJECT=(.+)$/m.exec(result.stdout)?.[1]?.trim();
  if (!resolvedProject) throw new Error("Runner nie zwrócił nazwy projektu Compose.");
  const containers = result.stdout
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line) as ComposeContainerInfo);
  return stackFromContainers(resolvedProject, containers);
}
```

- [ ] **Step 6: `save-file` — odczyt, scalanie i zapis atomowy**

W `src/app/api/env-vars/save-file/route.ts` dodaj import:

```ts
import { formatEnvValue, parseEnvEntries, updateEnvContent } from "@/server/env/dotenv";
```

Dopisz pod funkcją `runShell`:

```ts
async function readCurrentFile(filePath: string): Promise<string> {
  const { response, result } = await runShell(`if [ -f ${shellQuote(filePath)} ]; then cat ${shellQuote(filePath)}; fi`);
  if (!response.ok || !result.success) throw new Error(result.stderr || "Nie udało się odczytać pliku env.");
  return String(result.stdout || "");
}

async function writeFileAtomic(filePath: string, content: string) {
  const encoded = Buffer.from(content, "utf8").toString("base64");
  const tempFile = `${filePath}.tmp`;
  return runShell(
    `umask 077 && printf '%s' ${shellQuote(encoded)} | base64 -d > ${shellQuote(tempFile)} && mv -f ${shellQuote(tempFile)} ${shellQuote(filePath)}`
  );
}
```

Zastąp trzy gałęzie `if (action === "append" …)`, `if (action === "write" …)`, `if (action === "delete" …)` jedną:

```ts
    if (["append", "write", "delete"].includes(action) && Array.isArray(vars)) {
      if (action !== "delete" && !validateVars(vars)) {
        return NextResponse.json({ success: false, error: "Nieprawidłowy klucz lub wartość zmiennej." }, { status: 400 });
      }
      if (action !== "write" && vars.length !== 1) {
        return NextResponse.json({ success: false, error: "Ta akcja przyjmuje dokładnie jedną zmienną." }, { status: 400 });
      }
      vars.forEach((variable: EnvVar) => formatEnvValue(variable.value ?? ""));

      const original = await readCurrentFile(target.filePath);
      const current = parseEnvEntries(original);
      const [single] = vars as EnvVar[];
      const next =
        action === "write"
          ? (vars as EnvVar[])
          : action === "append"
            ? [...current.filter((entry) => entry.key !== single.key), single]
            : current.filter((entry) => entry.key !== single.key);

      const { response, result } = await writeFileAtomic(target.filePath, updateEnvContent(original, next));
      if (!response.ok || !result.success) return runnerError(response, result);

      return NextResponse.json({ success: true, action, count: next.length, filePath: target.filePath });
    }
```

Błąd z `formatEnvValue` (znak `$` z apostrofem) trafia do istniejącego `catch` i wraca jako 500 z polskim komunikatem; zmień w `catch` ostatni zwrot na status `400`, gdy `error.message` zawiera `"ręcznie"`:

```ts
    if (error instanceof Error && error.message.includes("ręcznie")) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
```

- [ ] **Step 7: `load-file` używa tego samego parsera**

W `src/app/api/env-vars/load-file/route.ts` usuń lokalną funkcję `parseEnv`, dodaj import `import { parseEnvEntries } from "@/server/env/dotenv";` i zamień `vars: parseEnv(String(result.stdout || ""))` na `vars: parseEnvEntries(String(result.stdout || ""))`.

- [ ] **Step 8: Endpoint `src/app/api/services/[id]/apply-env/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auditLogs } from "@/server/atlashub";
import { services } from "@/server/data";
import { buildComposeRecreateCommand, resolveComposeStack, runHostCommand, SELF_COMPOSE_PROJECT } from "@/server/deployments";
import { AuthError, requirePinVerification } from "@/server/lib/auth";
import { checkDemoModeBlocked } from "@/lib/demo-mode";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const demo = checkDemoModeBlocked();
    if (demo.blocked) return NextResponse.json(demo.result, { status: 403 });

    const user = await requirePinVerification();
    const { id } = await params;
    const service = await services.getServiceById(id);
    if (!service) return NextResponse.json({ success: false, error: "Nie znaleziono serwisu." }, { status: 404 });
    if (service.type !== "docker") {
      return NextResponse.json({ success: false, error: "Zmienne można zastosować tylko dla serwisu Docker." }, { status: 400 });
    }

    const stack = await resolveComposeStack({ containerName: service.container_id, composeProject: service.compose_project });
    if (stack.project === SELF_COMPOSE_PROJECT) {
      return NextResponse.json(
        { success: false, selfDeployRequired: true, error: "Plik zapisany. Dashboard zastosuje zmienne przy najbliższym self-deployu (push do main)." },
        { status: 409 }
      );
    }

    const result = await runHostCommand(buildComposeRecreateCommand(stack), 180_000);
    await auditLogs.logAction(user.email, "update", "service", id, {
      apply_env: true,
      compose_project: stack.project,
      services: stack.services,
      success: result.success,
    });

    if (!result.success) {
      const detail = (result.stderr || result.stdout).split("\n").slice(-12).join("\n");
      return NextResponse.json({ success: false, error: `Docker Compose nie odtworzył kontenerów:\n${detail}` }, { status: 502 });
    }

    return NextResponse.json({ success: true, project: stack.project, services: stack.services });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message, requirePin: error.code === "PIN_REQUIRED" },
        { status: error.code === "NOT_AUTHENTICATED" ? 401 : 403 }
      );
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Nie udało się zastosować zmiennych." }, { status: 500 });
  }
}
```

Upewnij się, że `runHostCommand` jest eksportowany z `src/server/deployments/index.ts` (jeśli `index.ts` nie zawiera `export * from "./host"`, dopisz go).

- [ ] **Step 9: `env-manager.tsx` woła apply-env**

Zastąp blok `// 3. Restart the service` … do `} else { toast.success("Environment variables saved"); }` (linie 366–406) na:

```tsx
      // 3. Apply by recreating the Compose containers (docker restart does not reload env files)
      if (serviceId) {
        try {
          const applyResponse = await fetch(`/api/services/${serviceId}/apply-env`, { method: "POST" });
          const applyResult = await applyResponse.json().catch(() => ({}));

          if (applyResponse.ok && applyResult.success) {
            toast.success("Zmienne zapisane i zastosowane", {
              description: `Odtworzono: ${(applyResult.services || []).join(", ")}`,
            });
          } else if (applyResponse.status === 409) {
            toast.info(applyResult.error || "Plik zapisany; zmiany wejdą przy najbliższym wdrożeniu.");
          } else {
            if (applyResult.requirePin) setShowPinDialog(true);
            toast.warning("Plik zapisany, ale nie udało się zastosować zmian", {
              description: applyResult.error || `Status: ${applyResponse.status}`,
            });
          }
        } catch (applyError) {
          toast.warning("Plik zapisany, ale żądanie zastosowania zmian nie powiodło się", {
            description: applyError instanceof Error ? applyError.message : "Błąd sieci",
          });
        }
      } else {
        toast.success("Zmienne zapisane");
      }
```

- [ ] **Step 10: Testy, typy, lint, build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/server/deployments src/app/api/env-vars src/app/api/services src/components/features/env-manager.tsx
git commit -m "fix: write env files safely and apply them by recreating compose services"
```

---

### Task 10: Tabela `general_todos` i retencja `uptime_checks` (M4)

**Files:**
- Create: `scripts/migrations/2026-09-15-general-todos.ts`
- Create: `src/server/monitoring/retention.ts`
- Test: `src/server/monitoring/retention.test.ts`
- Modify: `src/server/scheduler.ts`

**Interfaces:**
- Produces:
  - `export function uptimeRetentionCutoff(now: Date, days: number): string`
  - `export async function pruneUptimeChecks(now?: Date, days?: number): Promise<number>`

- [ ] **Step 1: Test `src/server/monitoring/retention.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { uptimeRetentionCutoff } from "./retention";

describe("uptimeRetentionCutoff", () => {
  it("subtracts whole days in UTC", () => {
    expect(uptimeRetentionCutoff(new Date("2026-09-15T12:00:00.000Z"), 30)).toBe("2026-08-16T12:00:00.000Z");
  });

  it("rejects non-positive retention", () => {
    expect(() => uptimeRetentionCutoff(new Date(), 0)).toThrow();
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run src/server/monitoring/retention.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `src/server/monitoring/retention.ts`**

```ts
import "server-only";
import { deleteRows } from "@/server/atlashub/client";

export function uptimeRetentionCutoff(now: Date, days: number): string {
  if (!Number.isFinite(days) || days < 1) throw new Error("Retencja musi wynosić co najmniej 1 dzień.");
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function pruneUptimeChecks(now = new Date(), days = Number(process.env.UPTIME_RETENTION_DAYS || 30)): Promise<number> {
  const result = await deleteRows("uptime_checks", [{ operator: "lt", column: "checked_at", value: uptimeRetentionCutoff(now, days) }]);
  return result.deletedCount;
}
```

- [ ] **Step 4: Uruchom test — PASS**

Run: `npx vitest run src/server/monitoring/retention.test.ts`
Expected: PASS.

- [ ] **Step 5: Harmonogram w `src/server/scheduler.ts`**

Nad `export function startMonitoringScheduler` dodaj:

```ts
let retentionInterval: NodeJS.Timeout | null = null;

async function runRetention(): Promise<void> {
  try {
    const { pruneUptimeChecks } = await import("./monitoring/retention");
    const deleted = await pruneUptimeChecks();
    console.log(`[Scheduler] Uptime retention removed ${deleted} checks`);
  } catch (error) {
    console.error("[Scheduler] Uptime retention failed:", error);
  }
}
```

W `startMonitoringScheduler` po `monitoringInterval = setInterval(…)` dodaj:

```ts
  setTimeout(runRetention, 60_000);
  retentionInterval = setInterval(runRetention, 24 * 60 * 60 * 1000);
```

W `stopMonitoringScheduler` po `clearInterval(monitoringInterval)` dodaj:

```ts
    if (retentionInterval) clearInterval(retentionInterval);
    retentionInterval = null;
```

- [ ] **Step 6: Skrypt migracji `scripts/migrations/2026-09-15-general-todos.ts`**

```ts
/**
 * Creates the general_todos table used by /todos. Idempotent.
 * Run with the dashboard env: npx tsx scripts/migrations/2026-09-15-general-todos.ts
 */
async function main() {
const apiUrl = process.env.ATLASHUB_API_URL;
const secretKey = process.env.ATLASHUB_SECRET_KEY;
if (!apiUrl || !secretKey) {
  console.error("ATLASHUB_API_URL and ATLASHUB_SECRET_KEY are required");
  process.exit(1);
}

const response = await fetch(`${apiUrl}/v1/db/schema/tables`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": secretKey },
  body: JSON.stringify({
    name: "general_todos",
    ifNotExists: true,
    columns: [
      { name: "id", type: "uuid", primaryKey: true, defaultValue: "gen_random_uuid()" },
      { name: "title", type: "varchar(200)", nullable: false },
      { name: "description", type: "text", nullable: true },
      { name: "priority", type: "varchar(20)", nullable: false, defaultValue: "'medium'" },
      { name: "status", type: "varchar(20)", nullable: false, defaultValue: "'pending'" },
      { name: "due_date", type: "timestamptz", nullable: true },
      { name: "completed_at", type: "timestamptz", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
      { name: "updated_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
    ],
  }),
});

if (!response.ok) {
  console.error(`general_todos: HTTP ${response.status} ${await response.text()}`);
  process.exit(1);
}
console.log("general_todos: ready");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Po wklejeniu sformatuj plik (`npx prettier --write scripts/migrations/2026-09-15-general-todos.ts`), żeby ciało `main` miało wcięcia.

- [ ] **Step 7: Testy, typy**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add scripts/migrations src/server/monitoring src/server/scheduler.ts
git commit -m "feat: add general_todos migration and uptime check retention"
```

---

### Task 11: Utwardzenie runnera (S3, zakres minimalny)

Runner zostaje zastąpiony w etapie 2; tu tylko zamknięcie oczywistych luk.

**Files:**
- Create: `runner/trusted-remote.ts`
- Test: `runner/trusted-remote.test.ts`
- Modify: `runner/index.ts:437-502`

**Interfaces:**
- Produces: `export function isTrustedRemote(address: string | undefined): boolean`

- [ ] **Step 1: Test `runner/trusted-remote.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { isTrustedRemote } from "./trusted-remote";

describe("isTrustedRemote", () => {
  it("accepts loopback and Docker bridge ranges", () => {
    expect(isTrustedRemote("127.0.0.1")).toBe(true);
    expect(isTrustedRemote("::1")).toBe(true);
    expect(isTrustedRemote("::ffff:172.18.0.4")).toBe(true);
    expect(isTrustedRemote("172.31.255.1")).toBe(true);
  });

  it("rejects look-alikes and other networks", () => {
    expect(isTrustedRemote("192.168.100.12")).toBe(false);
    expect(isTrustedRemote("10.172.0.1")).toBe(false);
    expect(isTrustedRemote("172.32.0.1")).toBe(false);
    expect(isTrustedRemote("::ffff:8.8.8.8")).toBe(false);
    expect(isTrustedRemote(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom — FAIL**

Run: `npx vitest run runner/trusted-remote.test.ts`
Expected: FAIL — brak modułu.

- [ ] **Step 3: Implementacja `runner/trusted-remote.ts`**

```ts
import net from "node:net";

export function isTrustedRemote(address: string | undefined): boolean {
  if (!address) return false;
  const ip = address.startsWith("::ffff:") ? address.slice(7) : address;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (!net.isIPv4(ip)) return false;
  const [first, second] = ip.split(".").map(Number);
  return first === 172 && second >= 16 && second <= 31;
}
```

- [ ] **Step 4: Uruchom test — PASS**

Run: `npx vitest run runner/trusted-remote.test.ts`
Expected: PASS.

- [ ] **Step 5: `runner/index.ts`**

Dodaj import `import { isTrustedRemote } from "./trusted-remote";`.

Usuń trzy linie `res.setHeader("Access-Control-Allow-…")` oraz blok obsługi `OPTIONS`.

Zastąp obliczanie `isLocal`:

```ts
  const remoteIp = req.socket.remoteAddress;
  const isLocal =
    remoteIp?.includes("127.0.0.1") ||
    remoteIp?.includes("::1") ||
    remoteIp?.includes("172.") ||
    remoteIp?.includes("::ffff:172.");
  if (!isLocal) {
```

na:

```ts
  if (!isTrustedRemote(req.socket.remoteAddress)) {
```

Przenieś cały blok `// Status endpoint (no auth required)` (od `if (req.method === "GET" && url === "/status") {` do jego `return; }`) tak, by znalazł się **po** bloku sprawdzającym nagłówek `Authorization`, i zmień komentarz na `// Status endpoint (auth required)`.

- [ ] **Step 6: Weryfikacja składni runnera**

Run: `npx tsc --noEmit -p runner` (jeśli runner nie ma `tsconfig.json`: `npx tsc --noEmit --module nodenext --moduleResolution nodenext --target es2022 --esModuleInterop --skipLibCheck runner/index.ts`)
Expected: brak błędów.

- [ ] **Step 7: Commit**

```bash
git add runner/trusted-remote.ts runner/trusted-remote.test.ts runner/index.ts
git commit -m "fix: restrict runner callers and protect status endpoint"
```

---

### Task 12: Compose dashboardu, override portu i `.env.example` (S4)

**Files:**
- Modify: `docker-compose.yml`
- Modify: `src/server/deployments/host.ts` (skrypt Pythona w `startDeploymentJob`)
- Modify: `.env.example`

- [ ] **Step 1: `docker-compose.yml` — porty i zmienne**

Zamień mapowania portów:
- `"3100:3100"` → `"127.0.0.1:3100:3100"`
- `"3101:3101"` → `"127.0.0.1:3101:3101"`
- `"9201:9000"` → `"127.0.0.1:9201:9000"`

W `environment` usługi `dashboard` zamień:

```yaml
      - DEV_USER_EMAIL=${DEV_USER_EMAIL:-admin@marczelloo.local}
      - DEV_SKIP_PIN=${DEV_SKIP_PIN:-false}
      - OWNER_EMAILS=${OWNER_EMAILS:-${DEV_USER_EMAIL:-admin@marczelloo.local}}
```

na:

```yaml
      - OWNER_EMAILS=${OWNER_EMAILS}
      # Cloudflare Access application: Zero Trust → Access → Applications → Overview
      - CF_ACCESS_TEAM_DOMAIN=${CF_ACCESS_TEAM_DOMAIN}
      - CF_ACCESS_AUD=${CF_ACCESS_AUD}
      - UPTIME_RETENTION_DAYS=${UPTIME_RETENTION_DAYS:-30}
      # PIN sessions: createPinSession() throws without SESSION_SECRET
      - SESSION_SECRET=${SESSION_SECRET}
      - PIN_SESSION_TTL=${PIN_SESSION_TTL:-1800}
      - DASHBOARD_GITHUB_URL=${DASHBOARD_GITHUB_URL}
```

Kontekst: 15.09.2026 w kontenerze brakowało 16 kluczy obecnych w `.env`, w tym `SESSION_SECRET` i `PIN_SESSION_TTL`, bo compose ich nie przekazywał. Bez `SESSION_SECRET` sesja PIN nie mogła powstać — najpewniej dlatego włączono `DEV_SKIP_PIN=true`. `GITHUB_WEBHOOK_SECRET` jest już na liście (nie dodawaj drugi raz).

- [ ] **Step 2: Override portu wiąże do 127.0.0.1**

W `src/server/deployments/host.ts`, w skrypcie Pythona funkcji `startDeploymentJob`, zamień fragment:

```python
        candidates.append((service_name, str(port["published"]), int(port["target"])))
matching = [candidate for candidate in candidates if candidate[1] == str(assigned_port)]
if len(candidates) == 1:
    service_name, published_port, target_port = candidates[0]
elif len(matching) == 1:
    service_name, published_port, target_port = matching[0]
else:
    raise SystemExit("Automatic port assignment needs one published TCP port (or one already mapped to the selected port).")
if published_port == str(assigned_port):
```

na:

```python
        candidates.append((service_name, str(port["published"]), int(port["target"]), str(port.get("host_ip") or "")))
matching = [candidate for candidate in candidates if candidate[1] == str(assigned_port)]
if len(candidates) == 1:
    service_name, published_port, target_port, host_ip = candidates[0]
elif len(matching) == 1:
    service_name, published_port, target_port, host_ip = matching[0]
else:
    raise SystemExit("Automatic port assignment needs one published TCP port (or one already mapped to the selected port).")
if published_port == str(assigned_port) and host_ip == "127.0.0.1":
```

oraz:

```python
    f"      - {json.dumps(f'{assigned_port}:{target_port}/tcp')}\\n"
```

na:

```python
    f"      - {json.dumps(f'127.0.0.1:{assigned_port}:{target_port}/tcp')}\\n"
```

- [ ] **Step 3: `.env.example`**

W sekcji „Authentication” dodaj:

```bash
# Cloudflare Access (required in production)
# Team domain: Zero Trust → Settings → Custom pages → Team domain
CF_ACCESS_TEAM_DOMAIN=https://your-team.cloudflareaccess.com
# Application Audience (AUD) Tag: Zero Trust → Access → Applications → dashboard → Overview
CF_ACCESS_AUD=your-aud-tag
```

W sekcji „Development Mode” dopisz nad `DEV_USER_EMAIL` komentarz:

```bash
# DEV_USER_EMAIL and DEV_SKIP_PIN are ignored when NODE_ENV=production.
```

W sekcji „Application Settings” dodaj:

```bash
# Days of uptime check history to keep (default 30)
UPTIME_RETENTION_DAYS=30
```

Przy `PIN_HASH` dopisz:

```bash
# Keep the bcrypt hash in single quotes, otherwise Compose expands the $ signs:
# PIN_HASH='$2a$10$...'
```

- [ ] **Step 4: Walidacja compose**

Run: `docker compose config -q` (lokalnie, z dowolnym `.env`)
Expected: brak błędów.

- [ ] **Step 5: Testy i build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml src/server/deployments/host.ts .env.example
git commit -m "fix: bind dashboard ports to loopback and wire Access settings"
```

---

### Task 13: Runbook etapu 0 na Pi

**Files:**
- Create: `docs/runbooks/2026-09-15-stage-0-pi.md`

Runbook jest wykonywany po scaleniu Task 1–12 do `main`, **przed** pushem, który uruchomi self-deploy. Każdy krok wymaga zgody właściciela w chwili wykonania.

- [ ] **Step 1: Utwórz runbook z poniższą treścią**

````markdown
# Etap 0 — runbook na Raspberry Pi

SSH: `ssh -i ~/.ssh/nadstrona_pi_ed25519 Marczelloo_pi@192.168.100.12`
Kopia sprzed zmian: `~/backups/pre-migration-20260915-1744`.

## 1. Kopia poza kartą SD (zgoda)

Na komputerze właściciela, do katalogu przez niego wskazanego:

```bash
scp -r -i ~/.ssh/nadstrona_pi_ed25519 Marczelloo_pi@192.168.100.12:backups/pre-migration-20260915-1744 "<KATALOG_DOCELOWY>"
```

Weryfikacja na kopii: `cd "<KATALOG_DOCELOWY>/pre-migration-20260915-1744" && sha256sum -c SHA256SUMS | grep -v ': OK' ; echo done` → tylko `done`.

## 2. Ustawienia Cloudflare Access (właściciel)

1. Zero Trust → Settings → Custom pages → skopiuj *Team domain*.
2. Zero Trust → Access → Applications → aplikacja dla `dashboard.marczelloo.dev` → Overview → skopiuj *Application Audience (AUD) Tag*.
3. Upewnij się, że aplikacja ma regułę Bypass tylko dla ścieżki `/api/github/webhook`.

## 3. `.env` dashboardu (zgoda)

```bash
cd ~/projects/Marczelloo-dashboard
cp .env .env.backup-stage0-$(date +%Y%m%d-%H%M)
```

Edycja ręczna `.env`:
- dopisz `CF_ACCESS_TEAM_DOMAIN=https://<team>.cloudflareaccess.com` i `CF_ACCESS_AUD=<aud>`;
- ujmij hash w apostrofy: `PIN_HASH='$2a$10$…'`;
- usuń linię `DEV_SKIP_PIN=true`;
- upewnij się, że `OWNER_EMAILS` zawiera adres logowania do Access.

Kontrola składni bez ujawniania wartości:

```bash
docker compose config --format json | python3 -c 'import json,re,sys; env=json.load(sys.stdin)["services"]["dashboard"]["environment"]; h=env.get("PIN_HASH") or ""; print("PIN_HASH_OK" if re.fullmatch(r"\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}", h) else "PIN_HASH_BROKEN"); print("ACCESS_OK" if env.get("CF_ACCESS_AUD") and env.get("CF_ACCESS_TEAM_DOMAIN") else "ACCESS_MISSING"); print("SESSION_OK" if len(env.get("SESSION_SECRET") or "") >= 32 else "SESSION_MISSING")'
```

Expected: `PIN_HASH_OK`, `ACCESS_OK` i `SESSION_OK`. Przy innym wyniku nie przechodź dalej (brak sekretu sesji: `openssl rand -base64 32` → `SESSION_SECRET=...` w `.env`).

## 4. Trasy tunelu na 127.0.0.1 (zgoda; restart cloudflared ~2 s przerwy)

```bash
sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.backup-stage0-$(date +%Y%m%d-%H%M)
sudo sed -i -E 's#service: http://localhost:(3000|3100|3101|3200|4545|9201)$#service: http://127.0.0.1:\1#' /etc/cloudflared/config.yml
sudo cloudflared --config /etc/cloudflared/config.yml tunnel ingress validate
grep -c 'localhost' /etc/cloudflared/config.yml
sudo systemctl restart cloudflared
```

Expected: `Validating rules … OK`, licznik `localhost` = `0`. Potem `for h in marczelloo.dev dashboard.marczelloo.dev admin-atlashub.marczelloo.dev api-atlashub.marczelloo.dev tools.marczelloo.dev drive.marczelloo.dev nadstrona.pl mewbit.marczelloo.dev; do printf '%s ' $h; curl -s -o /dev/null -w '%{http_code}\n' https://$h; done` — każdy host zwraca ten sam kod co przed zmianą (200/302/403 dla Access).

## 5. Wdrożenie dashboardu (zgoda)

1. Push `main` z Task 1–12 → webhook uruchamia self-deploy (dashboard + runner).
2. Po `STATUS success` w banerze: odtwórz demo i Portainer z nowymi portami:

```bash
cd ~/projects/Marczelloo-dashboard && docker compose up -d --no-build dashboard-demo portainer
```

Weryfikacja:

```bash
ss -ltn | grep -E ':(3100|3101|9201) '
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.100.12:3100/dashboard   # z innej maszyny w LAN
curl -s -o /dev/null -w '%{http_code}\n' -H 'cf-access-authenticated-user-email: moskwamarcel@gmail.com' http://127.0.0.1:3100/api/projects/x
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/api/health
```

Expected: nasłuch tylko `127.0.0.1`; z LAN brak połączenia; spreparowany nagłówek → `401`; health → `200`. Logowanie przez `https://dashboard.marczelloo.dev` działa, akcja wymagająca PIN pyta o PIN.

Awaryjnie (brak dostępu po wdrożeniu): przywróć `.env` z kopii z kroku 3 i wykonaj `docker compose up -d --no-build dashboard`.

## 6. Tabela `general_todos` (zgoda)

```bash
cd ~/projects/Marczelloo-dashboard
docker run --rm --env-file .env -v "$PWD/scripts/migrations:/m:ro" node:20-alpine sh -c 'npx --yes tsx /m/2026-09-15-general-todos.ts'
```

Expected: `general_todos: ready`; strona /todos zapisuje nowe zadanie.

## 7. Profil AtlasHub (zgoda)

```bash
docker exec -i marczelloo-dashboard node - <<'JS'
const base = process.env.ATLASHUB_API_URL, key = process.env.ATLASHUB_SECRET_KEY;
const settingKey = "deployment-config:652a4e9a-ed0f-4abb-a298-07ffcdb96545";
(async () => {
  const headers = { "x-api-key": key, "Content-Type": "application/json" };
  const row = (await (await fetch(`${base}/v1/db/settings?eq.key=${encodeURIComponent(settingKey)}`, { headers })).json()).data[0];
  const config = JSON.parse(row.value);
  if (config.profiles.length) return console.log("PROFILES_ALREADY", config.profiles.join(","));
  config.profiles = ["default"];
  config.updatedAt = new Date().toISOString();
  const response = await fetch(`${base}/v1/db/settings?eq.key=${encodeURIComponent(settingKey)}`, {
    method: "PATCH", headers, body: JSON.stringify({ values: { value: JSON.stringify(config), updated_at: config.updatedAt } }),
  });
  console.log(response.ok ? "PROFILES_SET default" : `PROFILES_FAILED ${response.status}`);
})();
JS
```

Expected: `PROFILES_SET default`. Następny push do `atlashub/main` kończy się `STATUS: SUCCESS`, a nie `no service selected`.

## 8. Porty AtlasHub i portfolio (zgoda; osobne repozytoria)

- `Marczelloo/atlashub`, `docker-compose.yml`: `'${PORT:-4545}:${PORT:-4545}'` → `'127.0.0.1:${PORT:-4545}:${PORT:-4545}'`; `'3000:3001'` → `'127.0.0.1:3000:3001'`. Commit i push do `main` (deploy przez webhook).
- `Marczelloo/portfolio-redesign`, `docker-compose.yml`: `"3200:3200"` → `"127.0.0.1:3200:3200"`. Commit, push, na Pi: `cd ~/projects/portfolio-redesign && git pull --ff-only && docker compose up -d --no-build`.
- Tools: przycisk „Deploy” w projekcie Marczelloo-Tools regeneruje override z `127.0.0.1:3202`.

Weryfikacja: `ss -ltn | grep -E '0\.0\.0\.0:(3000|3200|3202|4545) '` → brak wyników; domeny jak w kroku 4 odpowiadają.

## 9. Sprzątanie (zgoda dla każdego punktu osobno)

```bash
docker builder prune -f --keep-storage 10GB
docker image prune -f
```

Expected: `docker system df` → Build Cache ≤ 10 GB.

Cotygodniowe czyszczenie (crontab użytkownika):

```bash
( crontab -l 2>/dev/null; echo '17 4 * * 0 docker builder prune -f --keep-storage 10GB >/dev/null 2>&1' ) | crontab -
```

Katalog-sierota (kopia w `projects/Marczelloo-tools-orphan.tar`):

```bash
mv ~/projects/Marczelloo-tools ~/backups/Marczelloo-tools-orphan-$(date +%Y%m%d)
```

Gałąź w pełni scalona z `main` (na komputerze właściciela):

```bash
git push origin --delete feature/env-manager-file-first-redesign
```

Odłożone do etapu 2 (wymaga restartu demona Dockera i wszystkich kontenerów): limity logów w `/etc/docker/daemon.json`.
````

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/2026-09-15-stage-0-pi.md
git commit -m "docs: add stage 0 Raspberry Pi runbook"
```

---

## Kryteria ukończenia etapu 0

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` przechodzą.
- Na Pi: żaden z portów 3000, 3100, 3101, 3200, 3202, 4545, 9201 nie nasłuchuje na `0.0.0.0`.
- Żądanie z nagłówkiem `cf-access-authenticated-user-email` bez JWT dostaje `401`; dashboard przez domenę działa, PIN jest wymagany.
- Webhook bez sekretu jest odrzucany; push do gałęzi innej niż skonfigurowana nie wdraża.
- Zapis env w UI kończy się „Zmienne zapisane i zastosowane”, a `docker inspect` pokazuje nowy `Created` dla odtworzonych usług.
- W UI nie ma „Deploy All” ani przycisku Deploy na stronie serwisu.
- `general_todos` istnieje; `uptime_checks` nie zawiera wpisów starszych niż 30 dni po pierwszej dobie działania.
- Klucz Resend unieważniony i wymieniony.

## Zmiany względem planu (implementacja 15.09.2026)

- Task 3: `auth-policy.ts` przyjmuje `Record<string, string | undefined>` zamiast `NodeJS.ProcessEnv` (typy Next.js wymagają `NODE_ENV`). `src/app/api/terminal/route.ts` również korzysta z `isPinBypassAllowed()` — wcześniej sam czytał `DEV_SKIP_PIN`.
- Task 9: realne etykiety z Pi pokazały, że w AtlasHub postgres i minio powstały z dodatkowym `docker-compose.override.yml`. `stackFromContainers` przyjmuje kontener docelowy i ogranicza odtwarzanie do usług z tego samego wywołania Compose; polecenie ma `--no-deps`. `save-file` nadal waliduje klucz przy `delete`.
- Task 10: skrypt migracji ma `export {}` (inaczej `main` koliduje z `scripts/setup-database.ts` w `tsc`).
- Task 13: runbook sprawdza też `OWNER_EMAILS` i `GITHUB_WEBHOOK_SECRET`, ma pełny rollback kodu i krok testu „Zastosuj env”.
