# Marczelloo Dashboard — Agent & Repo Instructions

## ⚠️ IMPORTANT — REQUIRED DESIGN SKILL

This project **MANDATES** usage of the **`frontend-design` skill**.

The agent MUST:

- think in terms of **layout systems**
- design clear **visual hierarchy**
- treat the dashboard as a **power-user tool**, not a generic admin panel
- avoid default SaaS dashboard patterns unless explicitly justified

---

## Product

Private project manager panel to manage and monitor:

- self-hosted projects (Raspberry Pi + Docker + Portainer + Cloudflare Tunnel)
- external websites (including Vercel-hosted services)

This is a **complex internal dashboard**, not a marketing website.

---

## UI Philosophy (UPDATED)

- Dark mode as default
- Red accent as brand identity
- Strong hierarchy > flat layouts
- Clear separation of concerns
- Navigation must scale with feature growth
- Pages should be **intent-driven**, not information-stacked

Avoid:

- one-column “everything at once” layouts
- endless scrolls for complex tools
- visually merged navigation items

---

## Tech Stack

- Next.js App Router + TypeScript
- TailwindCSS
- shadcn/ui
- lucide-react
- Framer Motion (subtle, purposeful)
- Server Actions / Route Handlers

---

## Authentication & Access Control

### Cloudflare Access

App is protected by Cloudflare Access in front of the tunnel.

Server must:

1. Read Cloudflare Access identity headers (e.g., authenticated user email)
2. Allowlist only the owner email(s)
3. Require a second factor: **PIN** inside the app for sensitive actions

### PIN

- Stored hashed (argon2 or bcrypt)
- Required for:
  - create / update / delete
  - deploy actions
  - env reveal / edit
  - container actions
- Revealing secrets requires re-entering PIN or a valid PIN session TTL

---

## AtlasHub (MANDATORY Data Layer)

**Canonical docs:** `docs/atlashub/USAGE.md`

All persistence must use the AtlasHub REST API.

- Base URL: `ATLASHUB_API_URL=http://localhost:3001`
- Auth header: `x-api-key: <server-side secret>`

Endpoints:

- DB CRUD: `${ATLASHUB_API_URL}/v1/db/:table`
- Storage: `${ATLASHUB_API_URL}/v1/storage/...`

Rules:

- Treat AtlasHub docs as source of truth
- NEVER expose secret keys to client bundles
- All AtlasHub calls must go through server-only modules
- Updates and deletes must include filters

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

- A Project can have multiple Services
- External (e.g. Vercel) projects are represented as Services with monitoring only

---

## Secrets / Env Vars Handling

User must be able to view env values for debugging.

Implementation rules:

- Store `value_encrypted` using AES-256-GCM
- Encryption key stored server-side only (`ENCRYPTION_KEY`)
- UI masks values by default
- Reveal requires PIN re-auth
- Every reveal is logged in `audit_logs`

---

## Portainer Integration

Portainer runs locally on Raspberry Pi.

Use Portainer API to:

- list containers / stacks
- fetch logs (tail)
- perform actions:
  - start / stop / restart
  - recreate
  - pull image
  - exec

Store server-side config only:

- `PORTAINER_URL`
- auth token / credentials

Services map to:

- `portainer_endpoint_id`
- `container_id` and/or `stack_id`

---

## Runner (Git Pull + Docker Rebuild)

DO NOT execute arbitrary shell commands from Next.js handlers.

Use a local Runner service with:

- strict allowlist:
  - repo paths
  - compose project names
  - allowed operations
- shared secret (`RUNNER_TOKEN`)

Allowed actions:

- `git pull`
- `docker compose up -d --build`
- `docker restart`

Each action must:

- create a deploy record
- write an audit log entry

---

## Website Monitoring

- Periodic checks from Raspberry Pi
- Capture:
  - HTTP status
  - latency
  - SSL expiry days
- Optional health check URL per service
- Store history in `uptime_checks`
- UI displays recent status and simple charts

---

## Notifications

- Discord webhook for:
  - downtime
  - unhealthy status
  - deploy results
- Optional email notifications via SMTP
- All notifications must also be recorded in audit logs

---

## UI / UX Requirements (UPDATED)

### Navigation

- Sidebar / navbar must support:
  - clear categories
  - subcategories
  - collapsible groups
- Navigation must scale to 20+ items

### Page-Specific Rules

- **Project Details**
  - MUST NOT be a single overloaded view
  - Split into logical sections or tabs
- **Terminal**
  - Requires full redesign
  - Dedicated tool-like layout
- **Documentation**
  - Must be split into categories and subpages
  - Sidebar navigation required
- **Raspberry Pi Monitoring**
  - Must feel visually complete, not empty

---

## Coding Conventions

- Strict TypeScript
- Server-only logic in `src/server/**`
- Client components only where needed
- Centralized API clients:
  - `src/server/atlashub/*`
  - `src/server/portainer/*`
  - `src/server/runner/*`
- Every sensitive action must write an audit log entry

---

## Environment Variables (Example)

- `ATLASHUB_API_URL=http://localhost:3001`
- `ATLASHUB_SECRET_KEY=sk_...`
- `OWNER_EMAIL=...`
- `PIN_HASH=...`
- `ENCRYPTION_KEY=...`
- `PORTAINER_URL=http://localhost:9000`
- `PORTAINER_TOKEN=...`
- `RUNNER_URL=http://127.0.0.1:8787`
- `RUNNER_TOKEN=...`
- `DISCORD_WEBHOOK_URL=...`
- `SMTP_HOST=...`
- `SMTP_USER=...`
- `SMTP_PASS=...`

---

## Definition of Done (Design Scope)

- New navigation structure implemented
- Clear hierarchy across all pages
- No page feels overloaded or chaotic
- Terminal and Documentation fully redesigned
- UI scales with future features
