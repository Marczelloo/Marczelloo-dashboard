# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Owner (primary).** One developer, Marczelloo, running his own projects on a Raspberry Pi. Uses the dashboard daily on desktop, occasionally on a phone when something breaks away from the desk. Visits are a mix of four jobs: a quick glance to confirm everything is up or a deploy went through; reacting to a problem that arrived as a Discord alert or a broken site (logs, restart, rollback); longer configuration sessions (new project, environment variables, domains, settings); and planning work (tasks, GitHub activity, pull requests, releases).
- **Portfolio visitors (secondary).** The public demo at `demo-dashboard.marczelloo.dev` runs the same interface on simulated data so recruiters and other developers can see the project. They only browse; every write action is disabled.

## Product Purpose

A private, self-hosted control panel for the owner's projects and the machine they run on. It deploys projects from GitHub pushes, keeps their environment variables and domains, watches whether they are reachable, and shows the host's health, so the owner never has to SSH into the Pi for routine work. Success: the owner can tell at a glance whether anything needs attention, and can fix the common failures from the dashboard in a few clicks.

## Positioning

It is not a generic PaaS console: it is built around one owner's actual infrastructure. A push to GitHub reaches the dashboard's webhook, a host agent builds and releases the project with a health gate and rollback, routes are published through the owner's own Cloudflare tunnel onto a private Docker network, and monitoring watches the resulting domains, containers, TLS and disk. Everything the dashboard shows is the live state of that one Raspberry Pi.

## Operating Context

- Runs on a Raspberry Pi in Docker; reached at `dashboard.marczelloo.dev` behind Cloudflare Access and a PIN.
- Deploy pipeline: GitHub App webhook → dashboard → host agent (`marczelloo-agent`) → compose release with health gate → Cloudflare tunnel route on the `mz-edge` network.
- Data lives in AtlasHub (self-hosted Postgres REST API, rate limited to 100 requests/min for the whole dashboard). Container views come from Portainer and the agent.
- Monitoring runs every 60 s, alerts go to Discord on state changes, incidents are kept 90 days.
- Projects today: Tools, Portfolio, Drive, AtlasHub, the dashboard itself, MewBit (bot, no domain), plus static sites.

## Capabilities and Constraints

- Areas: Overview, Projects (per-project overview, deployments, environment, domains, GitHub, code, settings), Tasks (general todos and per-project work items in one view), Host, Containers, Services, Monitoring, Deployments, Audit log, Settings, Docs, Features.
- Removed on purpose and must not come back: host terminal, `docker exec`, Pi restart, npm tooling, Tech News, the legacy script deploy engine.
- Interface language: English.
- Desktop first; must remain fully usable on a phone (drawer navigation, single-column layouts), without separate mobile-only views.
- Demo mode (`DEMO_MODE=true`) serves mock data and blocks every mutation; it must keep working with the same UI.
- Stack: Next.js 16 App Router, React 19, Tailwind CSS 3, Radix primitives, framer-motion, Recharts, lucide-react.

## Brand Commitments

- Name: **Marczelloo Dashboard**.
- Near-black surfaces with a single crimson accent are the recognisable identity and stay.
- App mark: the "Frame ring M" — an M inside a rounded-square progress ring with one crimson segment (chosen 2026-09-17).

## Evidence on Hand

- Real project names, domains, deploy history and monitoring data exist in production; the demo uses simulated data (`src/app/api/demo`, `src/lib/demo-mode.ts`).
- No testimonials, users or metrics beyond the owner's own infrastructure; never invent them.

## Product Principles

1. **State before chrome.** The first thing on any screen is whether something needs the owner; calm when healthy, unmistakable when not.
2. **Fix where you look.** A problem is shown next to the action that resolves it (restart, rollback, logs), not on a different page.
3. **One place per thing.** Each project, deploy, domain or task has one home; other screens link to it instead of duplicating it.
4. **Honest live data.** Show real timestamps, commits and container states; never decorate with numbers the system does not have.
5. **Showable.** The same interface doubles as a portfolio piece, so craft matters, but never at the cost of the owner's speed.
