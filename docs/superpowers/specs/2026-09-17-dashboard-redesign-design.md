# Dashboard redesign: Obsidian Console

Date: 2026-09-17 · Status: approved design, awaiting spec review

## Why

The deploy and hosting rebuild is finished; the interface is not. The current UI is hard to read, poorly composed, puts things in illogical places and does not scale (a fixed 256 px sidebar covers most of a phone screen). Navigation hides almost everything behind six collapsible groups of one or two items. The same data lives in several places (services on two pages with two forms, deploys in three). Every page hand-builds its own header. It also looks generic.

The owner wants a general rework: a logical menu with Overview as the default page, a stronger layout, the current palette refined rather than replaced, and a premium dashboard feel with light motion that gives flow without getting in the way.

## Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Scope | Navigation and information architecture **and** a new visual system (option C). |
| Pages kept | Tasks (merged Todos + Work Items), Docs, Features, Containers (Portainer). **Tech News is removed.** |
| Devices | Desktop first; the phone must be fully usable (drawer, single column) without separate mobile views. |
| Tasks | One "Tasks" view over general todos and project work items, filterable by project; the project page shows the same list filtered. No data migration. |
| Language | English throughout (existing Polish strings are translated). |
| Visual direction | **A: Obsidian Console** (near-monochrome, hairlines, faint dot grid, crimson only as signal). |
| Overview projects | **X: one fleet table**; projects that are deploying or unhealthy rise to the top and unfold inline with the action that resolves them; when healthy a single "All systems normal" line. |
| App mark | **Frame ring M**. |
| Brandboard | Approved as-is: `docs/brand/brandboard.html`. |

Product truth for all later design work lives in `PRODUCT.md` (written in this session). The brandboard is the visual reference; this spec does not repeat its values.

## Non-goals

- No new backend capabilities beyond read aggregates the new screens need (section 5) and one agent field exposing the current deploy step (section 4). Deploy, monitoring and tunnel logic stay as they are.
- No light theme.
- No return of removed features (terminal, exec, Pi restart, npm tools, Tech News, script engine).
- No change to authentication (Cloudflare Access + PIN) or to demo mode's behaviour.

## 1. Information architecture

### Navigation

A flat sidebar, always expanded, grouped with small section labels:

| Group | Item | Route | Replaces |
|---|---|---|---|
| (none) | Overview | `/` | `/dashboard` |
| Workspace | Projects | `/projects` | same |
| | Tasks | `/tasks` | `/todos`, `/projects/[id]/work-items` |
| Infrastructure | Host | `/host` | `/pi` |
| | Containers | `/containers` | same |
| | Services | `/services` | same |
| | Monitoring | `/monitoring` | same |
| Activity | Deployments | `/deployments` | new (deploys were scattered) |
| | Audit log | `/audit-log` | same |
| footer links | Settings · Docs · Features | `/settings`, `/docs`, `/features` | same |

The sidebar footer also carries the version and sign-out. Count badges (projects, open tasks) sit at the right of items.

### Redirects

Permanent redirects in `next.config.ts` so bookmarks keep working: `/dashboard → /`, `/pi → /host`, `/todos → /tasks`, `/news → /`, `/projects/:id/work-items → /projects/:id?tab=tasks` (the item and new-item sub-routes keep working until Tasks replaces them, then redirect to `/tasks?item=:itemId` / `/tasks?new=1&project=:id`).

### Project page

One header (name, status dot, primary domain, last deploy, **Deploy** button, overflow menu with Edit / Open repo / Open site) and tabs driven by `?tab=`:

| Tab | Content (existing components moved, not rewritten, unless noted) |
|---|---|
| Overview | Services, recent deploys, open tasks, repository summary (branch status, languages) |
| Deployments | Releases list with rollback (`project-deploy-engine`), deploy history with live logs, release creator |
| Environment | Env manager and version history of the project's primary docker service |
| Domains | Cloudflare tunnel route and DNS (`project-cloudflare-tunnel`) |
| GitHub | Commits, pull requests, releases, workflow activity |
| Code | README, file browser, dependencies, security alerts, changelog |
| Tasks | The Tasks view filtered to this project |
| Settings | Project fields (today's edit page) and danger zone |

`/projects/[id]/edit` redirects to `?tab=settings`. Service detail (`/projects/[id]/services/[serviceId]`, `/services/[id]`) stays a separate page in the new shell.

### Overview

Top to bottom:

1. **Status bar**: one panel with four segments: domains up (x / y, last check), open incidents (count + newest), deploys in the last 7 days (count + failures), host meters (CPU, RAM, disk, temperature).
2. **Projects fleet table** (signature behaviour, section 4). Filter segments: All · Issues · Pinned.
3. **Activity** (deploys, env changes, incidents, container restarts, merged from deploys + audit log + incidents) beside **Tasks due** (overdue, due soon, blocked).

## 2. Visual system

Source of truth: `docs/brand/brandboard.html`. Implementation rules:

- **Tokens.** `src/app/globals.css` defines the brandboard's custom properties (`--canvas`, `--surface*`, `--line*`, `--fg*`, `--accent*`, `--ok/--warn/--err`, radii, shadows, durations, easings). `tailwind.config.ts` maps them to utility names. The legacy shadcn names (`background`, `card`, `primary`, `muted-foreground`, …) are kept as aliases pointing at the new tokens during migration, then removed once no page uses them.
- **Fonts.** Geist and Geist Mono via the `geist` npm package (self-hosted, no network at build on the Pi), exposed as `--font-sans` / `--font-mono`.
- **Icons.** Lucide at 16 px, stroke 1.75. The emoji maps in project tabs (`TYPE_ICONS`, `TECH_INFO`) are replaced by Lucide icons or plain text.
- **Mark.** `src/app/icon.svg` becomes the 16 px cut of Frame ring M; `apple-icon.png` is regenerated from the 64 grid (crimson variant for home screens); `viewport.themeColor` becomes `#09090b`. The sidebar lockup uses an inline `<Mark>` component that animates the ring once on first app load and while the dashboard deploys itself.
- **Browser surfaces.** Selection colour, scrollbars, focus ring and tabular numerals are themed as in the brandboard.

## 3. Components and structure

New or rebuilt building blocks in `src/components`:

| Unit | Purpose |
|---|---|
| `layout/app-shell` | Sidebar + top bar + content frame; owns the mobile drawer and the collapsed icon rail (preference in `localStorage`, safe when storage is unavailable). |
| `layout/sidebar` | The IA table above as data; active item with the crimson indicator; counts. |
| `layout/top-bar` | Breadcrumbs, command palette trigger, live deploy indicator (replaces `deployment-status-banner` in the sidebar), notifications. |
| `layout/page-header` | Title, context line, actions, optional tabs. Every page uses it; hand-built headers and `PageInfoButton` headers are removed. |
| `layout/command-palette` | `Ctrl/Cmd K`: jump to pages and projects, run Deploy / Open logs / Roll back for a project. Built on the existing Radix Dialog. |
| `ui/*` | Button (32/26 px, primary · secondary · ghost · danger · icon, loading), Input, Select, Segmented control, Tabs (travelling indicator), Chip, StatusDot (ok · live · warn · err · idle), UptimeStrip, Meter, Panel, Table primitives, Skeleton, EmptyState, Toast styling for `sonner`. |
| `brand/mark` | Frame ring M as a component (sizes, variants, one-shot animation). |

Pages compose these; page-local components keep their data logic but drop bespoke styling.

## 4. Signature behaviour: the fleet table

- A pure function `rankFleet(projects, states)` orders rows: active deploy first, then down, then degraded, then everything else in the user's order (pinned first). Unit-tested.
- A row "needs attention" when its project has an active agent job, a monitor target in `down`/`degraded`, or a stopped container that should run. Such rows show an inline detail region:
  - **deploying**: step chips `Fetch → Env → Build → Start → Health → Route`, elapsed time, commit, thin progress bar, **Live logs**. The agent's `Job` has no step today; the agent gains a `step` field (the label of the step `runStep` / the health gate is executing, written to job state) and the dashboard maps labels to these six phases in a tested pure function. Agent-first rollout as usual: agent commit and rebuild before the dashboard code that reads it;
  - **down/degraded**: failing container or target, state, duration, one fix action (**Restart <service>** or **Roll back**), **Logs**.
- Reorder uses framer-motion layout animation (420 ms, ease-in-out); the detail unfolds with `grid-template-rows` (260 ms, ease-out); under `prefers-reduced-motion` both become instant.
- The 24-hour uptime strip is derived from `monitor_incidents` (hour buckets marked degraded/down when an incident overlapped them), not from raw uptime checks.

## 5. Data for the new screens

AtlasHub allows 100 requests per minute for the whole dashboard, so new screens read through **server-side aggregates**, cached, never one request per widget:

| Aggregate | Used by | Sources | Cache |
|---|---|---|---|
| `getOverview()` | Overview status bar, fleet, activity, tasks due | projects, monitor_state, monitor_incidents (24 h), deploys (7 d), audit_logs (latest), general todos + work items (open), agent `/status` and active jobs, host metrics | 10 s, single-flight |
| `listDeployments({ project, status, cursor })` | Deployments page, project Deployments tab | deploys + services + projects | per request |
| `listTasks({ project, status })` | Tasks page and project tab | general_todos + work_items mapped to one `Task` shape | per request |

The client polls `getOverview` every 15 s only while the tab is visible. Demo mode serves the same shapes from mock data.

## 6. Motion

Durations and easings are tokens (brandboard, Motion). The app uses CSS transitions for state changes and framer-motion only for layout reordering, presence (drawer, palette, toasts) and the mark. `MotionConfig reducedMotion="user"` wraps the app. Route changes fade content up 4 px in 200 ms; the shell never animates. Lists stagger only on first load (30 ms, max 8). The live pulse marks running operations only.

## 7. Responsive

- ≥ 1280: full sidebar; two-column regions where a page has side panels.
- 768–1279: sidebar collapses to a 56 px icon rail with tooltips; side panels move below.
- < 768: sidebar becomes a drawer opened from the top bar; tables render as stacked rows with actions always visible; status bar becomes a 2 × 2 grid; command palette is full-width.

Every page is checked at 1440, 1024 and 375 px.

## 8. Rollout

Work happens on a `redesign` branch; pushing to `main` deploys production, so `main` only receives a phase once it works end to end in demo mode locally. Phases, each shippable:

1. **Foundation**: tokens, fonts, `ui/*` primitives, Mark, favicon/app icon, sonner theme. Old pages keep working through token aliases.
2. **Shell**: app shell, sidebar, top bar, page header, command palette, redirects, deploy indicator, mobile drawer. Tech News removed.
3. **Overview**: agent `step` field (shipped and rebuilt first), `getOverview` aggregate, status bar, fleet table with signature behaviour, activity, tasks due. `/` becomes Overview. *(first merge to main)*
4. **Projects**: list (fleet-table style with filters), project header and eight tabs, edit → settings tab.
5. **Tasks**: unified view, project tab, redirects from todos and work items.
6. **Infrastructure**: Host (from Pi), Containers, Services, Monitoring on the new primitives.
7. **Activity & system**: Deployments page, Audit log, Settings, Docs, Features restyled and translated.
8. **Finish**: Impeccable finish review against the brandboard (desktop and mobile captures), fixes, `DESIGN.md` rewritten by the Impeccable documenter from the built app, `docs/brand/README.md` updated, `scripts/generate-brandboard.mjs` and `icon-inventory.json` retired (the brandboard is now authored), legacy token aliases removed. *(final merge to main)*

Mechanical page restyles in phases 6–7 are candidates for delegation to Codex (worktree isolation) with review before merge.

## 9. Testing and verification

- Unit tests (vitest) for pure logic: `rankFleet`, attention detection, uptime buckets from incidents, task mapping, redirect table, deploy step mapping.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green at the end of every phase.
- Visual verification per phase in demo mode (`DEMO_MODE=true npm run dev`) at 1440 / 1024 / 375 px in the in-app browser; keyboard pass (Tab order, focus rings, `Ctrl K`, Esc) and reduced-motion pass.
- After each merge to main: the dashboard deploy succeeds through the agent, `dashboard.marczelloo.dev` and `demo-dashboard.marczelloo.dev` load, and the AtlasHub request rate stays under the limit (no 429 in logs over 10 minutes with the Overview open).

## Risks

- **Rate limit.** Overview must not add per-widget queries; the aggregate and cache are the mitigation and are verified after merge.
- **Big-bang feel.** Phases 1–2 change every page's frame at once; token aliases keep old pages legible until their phase lands.
- **Demo drift.** Mock data must grow with the new aggregates or the public demo breaks; each aggregate ships with its demo shape.
- **Scope.** Settings (805 lines), Docs (768) and GitHub tabs (921) are large; they are restyled on the new primitives, not redesigned feature by feature.

## Decisions after approval (2026-09-18 – 2026-09-22)

Changes the owner asked for or approved while the phases were built. They supersede the sections above where they differ, and `DESIGN.md` records the result.

- **Projects list is a tile grid**, approved in phase 4; the fleet table stays the Overview's.
- **Navigation.** Containers moved under Host (`/containers` redirects to Host › Containers). Features was removed; `/features` redirects to Docs. Deployments joined Workspace as its own page. The version lives in Settings › About, not the sidebar.
- **Host console**, added at the owner's request. It runs an allowlist of read-mostly commands inside the agent container (Docker inspection and start/stop/restart, `df`, `free`, read-only `git`, file reads inside the projects directory), with no shell, pipes or redirects, behind the PIN and written to the audit log. It is not a terminal on the host, so the no-exec non-goal still holds for the Pi itself.
- **Deploy steps** show Fetch → Config → Build → Start → Health, plus Rollback when it happens: the agent's real stages. Applying variables is part of Config, and switching a route happens after the health gate, not as a step of its own.
- **Pinned projects** live on the Projects page (a Pinned filter backed by local storage); the Overview filter is All / Issues.
- **Crimson** marks the one primary action on a view and the live pulse on a dot. Running and deploying use a neutral chip; red is reserved for failure.
- **Audit log** reads as sentences with filters by kind, time, project and person, and exports CSV. **Docs** were rewritten against the running system. The demo gained GitHub data and one shared fleet fixture.
