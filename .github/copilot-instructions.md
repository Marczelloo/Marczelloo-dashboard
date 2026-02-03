# Marczelloo Dashboard (Marczelloo Dashboard) — Agent & Repo Instructions

## Product

Private project manager panel to manage and monitor self-hosted projects (Raspberry Pi + Docker + Portainer + Cloudflare Tunnel) and external websites (incl. Vercel-hosted).

UI style: **dark mode**, **red accent**, minimalist, modern, subtle animations.

---

## Tech Stack

- Next.js App Router + TypeScript
- TailwindCSS + shadcn/ui + lucide-react
- Framer Motion (subtle)
- Server Actions / Route Handlers for server-only work

---

## Authentication & Access Control

### Cloudflare Access

App is protected by Cloudflare Access in front of the tunnel.

Server must:

1. Read Cloudflare Access identity headers (e.g., authenticated user email).
2. Allowlist only the owner email(s).
3. Require a second factor: **PIN** inside the app for sensitive actions.

### PIN

- Stored hashed (argon2 or bcrypt).
- Required for: create/update/delete, deploy actions, env reveal/edit, container actions.
- For “reveal secret” require re-enter PIN (or recent PIN session TTL).

---

## AtlasHub (MANDATORY Data Layer)

**Source of truth docs:** `docs/atlashub/USAGE.md`

All app persistence uses AtlasHub REST API:

- Base URL: `ATLASHUB_API_URL=http://localhost:3001`
- Auth header: `x-api-key: <server-side secret>`

Use AtlasHub endpoints:

- DB CRUD: `${ATLASHUB_API_URL}/v1/db/:table`
- Storage (optional): `${ATLASHUB_API_URL}/v1/storage/...`

Rules:

- Treat `docs/atlashub/USAGE.md` as the canonical reference for request/response formats, filters, and examples.
- NEVER expose the secret key in client bundles. All AtlasHub calls must go through server-only modules.
- Updates/deletes must include filters (AtlasHub safety behavior).

---

## Data Model (Tables)

- `projects`
- `services`
- `work_items`
- `env_vars` (encrypted at rest)
- `deploys`
- `uptime_checks`
- `audit_logs`

Notes:

- A Project can have multiple Services (AtlasHub has multiple containers).
- Two “Vercel projects” exist: they are Services of type `vercel` and have monitoring only.

---

## Secrets / Env Vars Handling

User requires ability to view env values for debugging.
Therefore:

- Store `value_encrypted` (AES-256-GCM) in DB.
- Encryption key stored only in server env (`ENCRYPTION_KEY`).
- UI shows masked values by default.
- Reveal requires PIN re-auth and logs to `audit_logs`.

---

## Portainer Integration

- Portainer is local on Pi and manages Docker.
- Use Portainer API to:
  - list containers/stacks,
  - fetch logs (tail),
  - run actions: start/stop/restart/recreate/pull image/exec.

Store Portainer config server-side:

- `PORTAINER_URL`
- auth token/credentials (server only)

Map Services to:

- `portainer_endpoint_id`
- `container_id` and/or `stack_id`

---

## Runner (Git Pull + Docker Rebuild/Restart)

Do NOT execute arbitrary shell commands from Next.js request handlers.

Implement a local-only Runner service (localhost) with:

- strict allowlist:
  - repo paths (exact paths)
  - compose project names
  - allowed ops (pull, rebuild, restart, logs)
- shared secret token (`RUNNER_TOKEN`)
- refuse any request not matching allowlist

Panel triggers:

- `git pull` in allowed repo path
- `docker compose up -d --build` (or `docker restart`)
- write deploy record + audit log

---

## Website Monitoring

- Periodic checks from Pi (internal scheduler/cron).
- Capture: HTTP status, latency, SSL expiry days.
- Optional `health_url` per service.
- Store history in `uptime_checks`.
- UI shows recent status + simple charts.

---

## Notifications

- Discord webhook for alerts (downtime, unhealthy, deploy result).
- Email optional via SMTP (provider-agnostic).
- All alerts are also recorded in `audit_logs`/`deploys`.

---

## UI/UX Requirements

- Dark theme + red accent (unique but minimalist).
- Animations: subtle (opacity/slide, micro-interactions).
- Pages:
  - Dashboard (overview: red/yellow/green)
  - Projects list
  - Project detail: services, work items, notes, recent deploys
  - Service detail: monitoring, logs, actions, env manager
  - Audit log
  - Settings (Portainer/Runner/Notifications)

---

## Coding Conventions

- Strict TypeScript
- Server-only modules inside `src/server/**`
- Client components only where needed (forms, live refresh, charts)
- Centralized API clients:
  - `src/server/atlashub/*`
  - `src/server/portainer/*`
  - `src/server/runner/*`
- Every sensitive action writes an audit log entry.

---

## Environment Variables (example)

- `ATLASHUB_API_URL=http://localhost:3001`
- `ATLASHUB_SECRET_KEY=sk_...` (server only)
- `OWNER_EMAIL=...`
- `PIN_HASH=...` (or store in DB)
- `ENCRYPTION_KEY=...` (32 bytes base64)
- `PORTAINER_URL=http://localhost:9000`
- `PORTAINER_TOKEN=...`
- `RUNNER_URL=http://127.0.0.1:8787`
- `RUNNER_TOKEN=...`
- `DISCORD_WEBHOOK_URL=...`
- `SMTP_HOST=...` `SMTP_USER=...` `SMTP_PASS=...`

---

## Definition of Done (MVP)

- Cloudflare Access + email allowlist + PIN gate.
- Projects + Services + Work Items CRUD via AtlasHub.
- Portainer list + logs + restart.
- Monitoring (status/latency/SSL) with stored history.
- “Update” triggers git pull + restart via Runner.
- Audit log captures all sensitive operations.
