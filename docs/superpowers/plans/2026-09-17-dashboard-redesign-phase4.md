# Redesign Phase 4: Projects Implementation Plan

> Executed in-session by its author, continuing `docs/superpowers/plans/2026-09-17-dashboard-redesign.md` (phases 1–3, already on branch `redesign`). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the projects list, the project page and the project forms on the new design system, in the compositions approved on 2026-09-17.

**Architecture:** The list reuses the Overview aggregate (`getOverview().fleet`), extended with the few fields a card needs, so both screens share one cache and one vocabulary. The project page gets a server aggregate of its own (`getProjectDetail`), an identity header, a four-segment status strip and eight URL-driven tabs; existing feature components move into tab modules unchanged. Forms move off the left edge: create/edit screens get a form column plus a context rail, the Settings tab gets section sub-navigation, short forms get a centred column.

**Spec:** `docs/superpowers/specs/2026-09-17-dashboard-redesign-design.md` (section 1, "Project page") · visual reference `docs/brand/brandboard.html` · approved mockups in `.superpowers/brainstorm/268-1789661134/content/{projects-page,project-detail,forms}.html`

## Global Constraints

Everything from the phase 1–3 plan still applies (branch `redesign`, English copy, tokens only, Lucide 1.75, `npm run dev:demo` on :3100, `marczelloo-drive/` moved aside for typecheck/build, conventional commits with the Co-Authored-By line). Plus:

- The projects list must not add AtlasHub reads: it renders from the same cached `getOverview()` inputs.
- The project page may read per-project data on navigation, but never more than five AtlasHub calls per visit.
- Pinning stays client-side in `localStorage` under the existing key `marczelloo_pinned_projects`.
- Every existing feature component (GitHub tabs, env manager, tunnel panel, deploy engine, file browser…) is moved, not rewritten.

## Chosen compositions

| Screen | Choice |
|---|---|
| Projects list | **Status cards**: card per project with status, domain, 24-hour uptime, three numbers (services, open tasks, deploys 7 d), last deploy and the primary action in the footer; header carries search, All / Issues / Pinned and New project. |
| Project page | **Header + status strip**: identity line (status, name, domain, repo, last deploy, Deploy, overflow), status strip (Status · Uptime 24 h · Deploys 7 d · Open tasks), tabs, content 2 : 1 with Services / Domains / Tasks / Repository as fixed cards in the right column. |
| Create & edit forms | **Form + context rail** (preview card, resulting URL, danger zone). |
| Project Settings tab | **Sections with sub-navigation**. |
| Short forms (new task) | **Centred column** (max 720 px). |

---

### Task 1: Card fields on the fleet rows

**Files:** `src/server/overview/types.ts`, `assemble.ts`, `assemble.test.ts`

**Interfaces:** `FleetRow` gains `description: string | null; tags: string[]; services: number; openTasks: number; deploys7d: number`.

- [ ] **Step 1:** Extend the `FleetRow` interface in `types.ts` with the five fields above.
- [ ] **Step 2:** Add a test to `assemble.test.ts` asserting the new fields for the Drive row (`services: 1`, `openTasks: 0`, `deploys7d: 1`, `tags: []`).
- [ ] **Step 3:** Run `npx vitest run src/server/overview/assemble.test.ts` — expect FAIL.
- [ ] **Step 4:** In `assemble.ts`, compute them inside the fleet map: `services` from the project's services, `openTasks` from `inputs.workItems` filtered by project (status not done), `deploys7d` from the project's deploys within the 7-day window, `tags` via a local `parseTags(value: unknown): string[]` helper that accepts an array or a JSON string, `description` straight from the project.
- [ ] **Step 5:** Run the test — expect PASS. Then `npm run typecheck`.
- [ ] **Step 6:** Commit `feat: card fields on fleet rows`.

### Task 2: Projects list

**Files:**
- Create: `src/lib/pinned-projects.ts`, `src/lib/pinned-projects.test.ts`, `src/app/(dashboard)/projects/_components/project-card.tsx`, `projects-grid.tsx`
- Modify: `src/app/(dashboard)/projects/page.tsx`
- Delete: `src/app/(dashboard)/projects/_components/projects-list.tsx`, `projects-list-client.tsx`

**Interfaces:** `readPinned(storage): string[]`, `togglePinned(storage, id): string[]` (safe when storage throws); `ProjectCard({ row, pinned, onTogglePin })`; `ProjectsGrid({ rows })` owns search, filter (`all | issues | pinned`) and pins.

- [ ] **Step 1:** Write `pinned-projects.test.ts`: reads an array from the existing key, returns `[]` for junk and for a throwing storage, toggles an id in and out, and writes back what it returns.
- [ ] **Step 2:** Run it — expect FAIL. Implement `pinned-projects.ts` (same key `marczelloo_pinned_projects`), run again — expect PASS.
- [ ] **Step 3:** Write `project-card.tsx` per the approved mockup: header line (status dot, name, state chip), domain in mono, `UptimeStrip`, three `services / open tasks / deploys 7 d` numbers, footer with last deploy and the action (`Deploy`, or `Live logs` while deploying, or `Restart <service>` when degraded), pin button in the top-right corner, whole card links to the project.
- [ ] **Step 4:** Write `projects-grid.tsx`: search input filtering on name, slug, domain and tags; `SegmentedControl` for All / Issues / Pinned with counts; pinned rows first, then `rankFleet` order; empty states per filter; grid `sm:grid-cols-2 xl:grid-cols-3`.
- [ ] **Step 5:** Rewrite `page.tsx` to load `getOverview()` on the server, pass `fleet` to the grid, keep the `New project` action, and drop the old list components.
- [ ] **Step 6:** Verify at 1440 / 375 px in demo mode; `npm run typecheck && npm run lint`.
- [ ] **Step 7:** Commit `feat: status-card projects list with search, filters and pins`.

### Task 3: Project page shell — header, status strip, tabs

**Files:**
- Create: `src/server/projects/detail.ts`, `src/app/(dashboard)/projects/[id]/_components/project-header.tsx`, `project-status-strip.tsx`, `project-tabs.tsx`
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx`, `next.config.ts` (redirect `/projects/:id/edit` → `/projects/:id?tab=settings`)

**Interfaces:**
- `getProjectDetail(id: string): Promise<ProjectDetail | null>` with `{ project, services, workItems, deploys, config, agent: ProjectStatus | null, states: TargetState[], incidents: MonitorIncident[] }`, each source failing softly.
- `ProjectHeader({ detail })`, `ProjectStatusStrip({ detail })`, `ProjectTabs({ id, active })` where `active` comes from `?tab=`.

- [ ] **Step 1:** Implement `getProjectDetail` (project, services by project, open work items, deploys of its services, deployment config, agent status, monitor states filtered to the project, recent incidents). Reuse `attentionFor`, `toneFor` and `hourlyUptime` for the derived state.
- [ ] **Step 2:** Build `project-header.tsx`: status dot + name, then domain link, repo link and last deploy as one meta line; actions `Deploy` (existing `DeployProjectButton`), `Open ↗` and an overflow menu (Edit → Settings tab, Open repo, Delete).
- [ ] **Step 3:** Build `project-status-strip.tsx`: one `Panel` with four segments — Status (containers up), Uptime 24 h (`UptimeStrip` + percentage), Deploys 7 days (+ failures), Open tasks (+ highest priority).
- [ ] **Step 4:** Build `project-tabs.tsx`: eight links (`overview, deployments, environment, domains, github, code, tasks, settings`) rendered as `Link`s with `?tab=`, styled like the `Tabs` primitive with the sliding indicator, horizontally scrollable on phones.
- [ ] **Step 5:** Rewrite `page.tsx` to render header, strip, tabs and the active tab's module; keep `notFound()` and the load-error fallback.
- [ ] **Step 6:** Verify; commit `feat: project header, status strip and URL tabs`.

### Task 4: Tab modules

**Files:** `src/app/(dashboard)/projects/[id]/_components/tabs/{overview,deployments,environment,domains,github,code,tasks,settings}.tsx`; modify `project-detail-tabs.tsx` (split, then delete)

- [ ] **Step 1:** Overview tab: left column Services card (from the existing services section) and Recent deploys card; right column Open tasks, Domains and Repository cards (branch status + languages + last commit from `github-info`/`branch-status`).
- [ ] **Step 2:** Deployments tab: `ProjectDeployEngine` (releases, rollback) + `ProjectDeploys` (history with live logs) + `ReleaseCreator`.
- [ ] **Step 3:** Environment tab: `EnvManager` + `EnvVersionHistory` for the project's primary docker service, with an empty state when there is none.
- [ ] **Step 4:** Domains tab: `ProjectCloudflareTunnel`.
- [ ] **Step 5:** GitHub tab: `GitHubTabs` (+ `GitHubInfo`, `BranchStatus`). Code tab: `ReadmeViewer`, `FileBrowser`, `DependenciesViewer`, `SecurityDashboard`, `ChangelogViewer`.
- [ ] **Step 6:** Tasks tab: the project's work items with status filter and `New task`, reusing the work-items list markup.
- [ ] **Step 7:** Delete `project-detail-tabs.tsx` once nothing imports it; replace the emoji maps (`TYPE_ICONS`, `TECH_INFO`) with Lucide icons or plain text.
- [ ] **Step 8:** Verify every tab in demo mode; commit `feat: project tab modules`.

### Task 5: Forms

**Files:** `src/app/(dashboard)/projects/_components/project-form.tsx`, `projects/new/page.tsx`, `projects/[id]/_components/tabs/settings.tsx`, `projects/[id]/services/new/page.tsx`, `services/new/page.tsx`, `projects/[id]/work-items/new/page.tsx`, `work-items/[itemId]/page.tsx`; create `src/components/layout/form-layout.tsx`

**Interfaces:** `FormLayout({ children, rail })` (form column + 300 px rail, single column below `lg`), `FormSection({ title, description, children })`, `FormActions({ children, note })` (sticky bar inside the panel), `SectionNav({ sections, active })`.

- [ ] **Step 1:** Build `form-layout.tsx` with those four pieces on the tokens.
- [ ] **Step 2:** Project form (new + settings): sections Identity / Links / Notes, rail with live preview card, resulting `/projects/<slug>` address and the danger zone (edit only).
- [ ] **Step 3:** Settings tab: `SectionNav` (Identity, Links, Deployment, Danger zone) beside the sections; the Deployment section links to the Domains and Environment tabs instead of duplicating them.
- [ ] **Step 4:** Service forms: form column plus a rail explaining the service type, with the compose preview where one exists.
- [ ] **Step 5:** Work item forms: centred 720 px column, no rail.
- [ ] **Step 6:** Verify each form at 1440 / 375 px; commit `feat: form layouts with context rail and section navigation`.

### Task 6: Phase verification

- [ ] **Step 1:** `npm run typecheck && npm run lint && npm test && npm run build`.
- [ ] **Step 2:** Demo-mode pass over `/projects`, a project's eight tabs, new project, settings, new service, new task at 1440 / 1024 / 375 px; check no horizontal scroll and that focus rings survive.
- [ ] **Step 3:** Update the spec's status line; commit `docs: phase 4 shipped`.
