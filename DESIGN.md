---
name: Marczelloo Dashboard
description: Obsidian Console, a near-black operations panel for one Raspberry Pi, calm when healthy and unmistakable when not.
colors:
  canvas: "rgb(9 9 11)"
  surface: "rgb(17 17 19)"
  surface-raised: "rgb(24 24 27)"
  surface-hover: "rgb(31 31 35)"
  fg: "rgb(237 237 239)"
  fg-2: "rgb(180 180 188)"
  fg-3: "rgb(131 131 140)"
  fg-4: "rgb(86 86 95)"
  accent: "rgb(229 72 77)"
  accent-solid: "rgb(207 51 57)"
  accent-solid-hover: "rgb(217 59 65)"
  accent-text: "rgb(255 159 162)"
  accent-foreground: "#ffffff"
  ok: "rgb(61 214 140)"
  warn: "rgb(245 165 36)"
  err: "rgb(255 99 105)"
  line-subtle: "rgba(255, 255, 255, 0.055)"
  line: "rgba(255, 255, 255, 0.085)"
  line-strong: "rgba(255, 255, 255, 0.14)"
typography:
  stat-hero:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  page-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  stat:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
    fontFeature: "\"tnum\""
  dialog-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  panel-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"ss01\", \"cv11\""
  body-strong:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  control-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  meta:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
  micro:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    fontFeature: "\"tnum\""
  mono-count:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "10.5px"
    fontWeight: 500
    fontFeature: "\"tnum\""
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  "0.5": "2px"
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "3.5": "14px"
  "4": "16px"
  "6": "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-solid}"
    textColor: "{colors.accent-foreground}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.accent-solid-hover}"
    textColor: "{colors.accent-foreground}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.fg}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.fg}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.fg-2}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  button-danger:
    backgroundColor: "rgb(255 99 105 / 0.1)"
    textColor: "{colors.err}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  button-sm:
    typography: "{typography.control-sm}"
    rounded: "{rounded.sm}"
    padding: "0 9px"
    height: "26px"
  chip-neutral:
    backgroundColor: "rgba(255, 255, 255, 0.02)"
    textColor: "{colors.fg-2}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-ok:
    backgroundColor: "rgb(61 214 140 / 0.1)"
    textColor: "{colors.ok}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-warn:
    backgroundColor: "rgb(245 165 36 / 0.1)"
    textColor: "{colors.warn}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-err:
    backgroundColor: "rgb(255 99 105 / 0.1)"
    textColor: "{colors.err}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-live:
    backgroundColor: "transparent"
    textColor: "{colors.fg-2}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  chip-idle:
    backgroundColor: "transparent"
    textColor: "{colors.fg-3}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
  panel-header:
    typography: "{typography.panel-title}"
    padding: "12px 14px"
  panel-body:
    padding: "14px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  search-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
    padding: "0 10px 0 32px"
    height: "32px"
    width: "240px"
  segmented-control:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "2px"
  segmented-option-active:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.fg}"
    typography: "{typography.control-sm}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  tab:
    textColor: "{colors.fg-3}"
    typography: "{typography.body-strong}"
    padding: "9px 10px 11px"
  tab-active:
    textColor: "{colors.fg}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.fg-2}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  nav-item-active:
    backgroundColor: "rgba(255, 255, 255, 0.055)"
    textColor: "#ffffff"
  switch-on:
    backgroundColor: "rgb(229 72 77 / 0.25)"
    rounded: "{rounded.full}"
    height: "18px"
    width: "32px"
  kbd:
    backgroundColor: "rgba(255, 255, 255, 0.03)"
    textColor: "{colors.fg-3}"
    typography: "{typography.mono-count}"
    rounded: "{rounded.xs}"
    padding: "1px 5px"
  dialog:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.fg}"
    rounded: "{rounded.xl}"
    padding: "20px"
---

# Design System: Marczelloo Dashboard

## Overview

**Creative North Star: "Obsidian Console"**

The dashboard is a dense, near-black operator's console for one owner and one Raspberry Pi. Everything sits on a cool obsidian canvas (a faint 20 px dot grid fades out behind the top of every page) with panels a single tonal step lighter, separated by white hairlines at 5.5 to 14 percent opacity. At rest the screen is grey on black with small green dots. Colour appears only when something is happening or something is wrong, so a healthy fleet reads calm and a failure reads unmistakable.

Density is deliberate: 13 px body text, 32 px controls, 14 px panel padding, row lists instead of cards. State comes first on every list page: a status bar of four numbers, then grouped panels of rows, with problems ranked to the top and shown next to the one action that fixes them. Crimson is the identity, and it is rationed. It marks the single primary action on a view, the live pulse of a running operation, and thin selection indicators. It never means failure. Failure has its own coral red.

Motion is quick and functional (90 to 420 ms on a strong ease-out). Indicators travel, details unfold, rows reorder. Nothing decorates, and all of it switches off under reduced motion.

**Key Characteristics:**

- Obsidian canvas, one tonal step per layer, white hairline borders; a sheen gradient and a 1 px inset top highlight give panels their only depth.
- One crimson accent, rationed to the primary action, the live pulse and selection indicators.
- A separate status palette (ok green, warn amber, err coral) that appears only on exceptions.
- A dense literal type ramp in Geist from 10.5 px to 22 px, with Geist Mono and tabular numerals for anything a machine produced.
- Status bar, panel, row: every list page is built from the same three pieces.

## Colors

The palette is a cool near-neutral greyscale with one crimson and three status hues, stored as RGB channels in `src/app/globals.css` so every token takes an opacity modifier.

### Primary

- **Signal Crimson** (accent): the brand hue. Used for the live status dot and its expanding ring, the deploy progress bar and the current deploy step, the active nav indicator bar, the active tab underline, the on state of a switch, the focus outline and text selection (at 32 percent).
- **Pressed Crimson** (accent-solid, hover accent-solid-hover): the fill of the one primary button on a view, with white text.
- **Crimson Tint** (accent-text): readable crimson for text that names a live state on dark surfaces.

### Status

- **Up Green** (ok): healthy dots (with a 3 px halo at 10 percent), up hours in the uptime strip (at 70 percent), ok chips.
- **Degraded Amber** (warn): degraded states, meters past their threshold (disk at 85 percent or more, temperature at 70° or more), high-priority tasks.
- **Down Coral** (err): failures, open incidents, down hours, danger buttons and the danger-zone section. Deliberately lighter and pinker than Signal Crimson so "broken" never reads as "brand".

### Neutral

- **Obsidian** (canvas): the page, the top bar (at 80 percent with a blur), the sidebar, input and segmented-control wells.
- **Graphite Panel** (surface): panels and form sections.
- **Raised Graphite** (surface-raised): secondary buttons, dialogs, popovers, empty-state icon tiles.
- **Hover Graphite** (surface-hover): secondary button hover, the travelling segmented indicator.
- **Bright Ink** (fg): primary text, titles, values.
- **Soft Ink** (fg-2): row secondary text, form labels, ghost buttons, inactive nav items.
- **Muted Ink** (fg-3): notes, descriptions, stat labels, inactive tabs, panel-header icons.
- **Faint Ink** (fg-4): placeholders, idle dots, nav group labels, units after a number ("/ 3 up").
- **Hairlines** (line-subtle for dividers inside a panel, line for panel and chip borders, line-strong for controls, inputs, the live chip and keycaps).

### Named Rules

**The Crimson Budget Rule.** Crimson has three jobs: the one primary action per view, the live pulse of a running operation, and a 2 px selection indicator (nav bar, tab underline, switch, focus). If crimson appears anywhere else, it is a mistake.

**The Red Means Broken Rule.** Failure is Down Coral (err), never Signal Crimson. Running and deploying are not failures: they use the neutral live chip and a crimson pulse dot, never a red chip.

**The Exceptions Only Rule.** Tone chips (ok, warn, err) mark exceptions. A healthy row carries a green dot and no chip; a successful deploy has no status chip; a failed one has an err chip. Plain facts (container count "2 / 2", tags) use the neutral chip.

## Typography

**Display Font:** Geist (self-hosted via the `geist` package, falling back to ui-sans-serif, system-ui)
**Body Font:** Geist, with stylistic sets `ss01` and `cv11` on the body
**Label/Mono Font:** Geist Mono (falling back to ui-monospace, SFMono-Regular, Menlo, Consolas), always with tabular numerals

**Character:** One neutral grotesque carries everything; hierarchy comes from size steps of half a pixel to two pixels and weight 500/600, never from a second family. Geist Mono marks machine output: commit SHAs, domains, container names, ports, counts, log lines, keycaps.

### Hierarchy

The ramp is literal pixel sizes, as built:

- **Stat hero** (600, 22 px, 1.25, -0.02em, tabular): the four numbers of the Overview status bar only.
- **Page title** (600, 20 px, 1.25, -0.02em): the page header title and the project header title. One per page.
- **Stat** (600, 18 px, 1.25, tabular): values in the status bars of every other page (Deployments, Host, Services, Monitoring, Audit log, project strip, Tasks); also the README `h1`.
- **Dialog title** (600, 15 px, -0.01em): dialog and alert titles, Docs section titles, README `h2`.
- **Panel title** (600, 13.5 px): panel headers, form section titles, card titles, the "Marczelloo" wordmark.
- **Body** (400 to 500, 13 px): the workhorse: rows, buttons, inputs, nav items, tabs, section-nav links, descriptions under a page title, empty-state text. The most-used size in the app.
- **Search / command** (12.5 px): the top-bar command trigger and a few dense row lines.
- **Control small** (500, 12 px): small buttons, segmented options, form labels (fg-2), timestamps in rows.
- **Meta** (400, 11.5 px, fg-3): panel-header notes, form hints and errors, stat labels and stat details, chip text.
- **Micro** (11 px): meter labels, nav group labels (fg-4), deploy-list detail lines.
- **Mono count** (500, 10.5 px mono): counts inside nav items and segmented options, meter values, keycaps.

### Copy, dates and numbers

- **Voice:** English, short, plain, sentence case everywhere: titles, buttons, labels, nav groups. Say what happened or what the button does ("Restart api", "Live logs", "No incidents in the last 24 hours", "The agent is working"). No exclamation marks, no marketing.
- **Days:** a day heading reads "Tue, Sep 22" (`formatDay`). A date inside the current year reads "Sep 22" (`formatShortDate`), as in "Due Sep 23".
- **Recent times:** relative and compact: "just now", "14m ago", "3h ago", "2d ago"; older than a week falls back to "Sep 22, 2026".
- **Clock times:** 24 h, "14:05" or "14:05:09" in logs, the console and the audit log.
- **Separators:** a middle dot joins parts of a label ("Deploys · 7 days", "Host · raspberrypi", "dashboard · 14m ago").

### Named Rules

**The Machine Mono Rule.** If the system produced it (SHA, domain, container, port, path, count, log line), set it in Geist Mono with tabular numerals. If a person reads it as language, it stays in Geist.

**The Sentence Case Rule.** No uppercase labels and no kickers above headings. The only uppercase text is the "DASHBOARD" line inside the logo lockup, which is part of the mark, not a label style.

## Layout

**Shell.** A fixed sidebar (232 px expanded, 56 px icon rail) and a sticky 52 px top bar (current section name, command trigger, notifications) frame the content. Content is centred to a maximum of 1440 px with 16 px side padding, 24 px from 768 px up, and 24 px vertical padding. The page header sits 24 px from the top: title, a 13 px fg-3 context line, actions aligned to the bottom right, and optional tabs 16 px below.

**Rhythm.** A 2 px based rhythm tuned for density: 14 px panel padding, 12 px header height padding, 8 px gaps inside rows, 16 px between panels and page regions, 18 px horizontal padding in status-bar cells. Rows are at least 44 px tall and separated by line-subtle hairlines.

**Page patterns.**

- **Status bar:** one panel split into four cells by hairlines at the top of every list page: a label (11.5 px, optionally led by a status dot), a value (18 px, or 22 px on the Overview), a detail line. The Overview's fourth cell holds the host meters.
- **Grouped panels with row lists:** list pages group rows into panels (by day on Deployments, by kind elsewhere), each with a panel header and a count.
- **Fleet table (Overview):** columns Project, Uptime · 24 h, Containers, Last deploy. A row that needs attention gets a 2 px left edge (fg-3 while deploying, warn when degraded, err with a 6 percent coral wash when down) and unfolds an inline detail below it: deploy steps with a progress bar and "Live logs", or the failing container, its state and duration next to one fix action and "Logs".
- **Projects list:** a tile grid, not a table.
- **Settings-style forms:** a sticky section nav on the left (from 1024 px), form sections as panels in the middle, a 300 px context rail on the right with previews and related links. The rail moves below the form under 1024 px, and a form without a rail is capped at 720 px.
- **Project page:** a project header (status dot, 20 px name, mono domain and repo, Deploy as the primary action), a status strip, then tabs driven by `?tab=`.
- **Docs:** a contents column with a search field and collapsible groups (active entry uses the crimson nav indicator) beside panels of term / description rows.

**Responsive.**

- From 1280 px: the full sidebar (unless collapsed to the rail by preference). From 768 to 1279 px: the 56 px icon rail with tooltips. Under 768 px the sidebar becomes a drawer opened from the top bar.
- Status bars become a 2 × 2 grid under 768 px; the host cell spans both columns and its meters sit in two columns.
- Segmented controls and tab lists scroll horizontally with hidden scrollbars rather than wrapping.
- Search fields are full width under 640 px and 240 px from 640 px up; filters stack under the search.
- Table rows stack into two-line rows on phones, with actions always visible (icon-only buttons where space runs out). Dialog footers stack in reverse order under 640 px.

## Elevation & Depth

The system is tonal, not shadowed. Depth comes from three canvas-to-surface steps, hairline borders, a top-to-bottom sheen (`linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012))`) and a 1 px white inset highlight on the top edge of panels and raised controls. Real drop shadows exist only for things that float over the page.

### Shadow Vocabulary

- **Inset top** (`box-shadow: inset 0 1px 0 rgba(255,255,255,.045)`): panels, form sections, secondary buttons, the segmented indicator, empty-state tiles.
- **Lift** (`box-shadow: 0 6px 18px -8px rgba(0,0,0,.6)`): small floating controls such as the sidebar collapse handle and menus.
- **Overlay** (`box-shadow: 0 16px 40px -12px rgba(0,0,0,.7), 0 4px 12px -4px rgba(0,0,0,.5)`): dialogs, the command palette, popovers.
- **Primary press** (`inset 0 1px 0 rgba(255,255,255,.18), 0 1px 2px rgba(0,0,0,.4)`, on hover a crimson glow `0 4px 14px -4px rgba(229,72,77,.55)`): the primary button only.
- **Status halo** (`0 0 0 3px` of the status colour at 10 percent): ok, warn and err dots.
- **Live glow** (`0 0 10px` to `0 0 12px` of accent at 70 to 80 percent): the active nav indicator bar and the deploy progress bar.

### Named Rules

**The Flat Panel Rule.** Panels never cast drop shadows. A panel is surface, sheen, inset top and a line border; only overlays and floating handles get a real shadow.

## Shapes

Small, even corners: 4 px for keycaps, 6 px for buttons, chips, inputs, nav items and segmented options, 8 px for segmented wells and nested tiles, 10 px for panels, 14 px for dialogs. Status dots, switches, meters and indicator bars are fully round; uptime-strip bars are 2 px. Every border is 1 px; accents are 2 px bars (nav indicator, tab underline, attention edge). Icons are Lucide at 16 px (14 px in small controls), stroke 1.75, in currentColor.

## Components

### Buttons

Compact and quiet; the hierarchy is carried by fill, not size.

- **Shape:** 6 px corners, 32 px tall (26 px small, 36 px large), 7 px icon gap, 13 px medium text.
- **Primary:** Pressed Crimson fill, white text, inset highlight. Exactly one per view (Deploy on a project, Restart on a down row, Save on a form).
- **Secondary:** Raised Graphite with a strong hairline; the default for every other visible action ("Live logs", "Open", "Hide contents").
- **Ghost:** no fill, fg-2 text, 5 percent white on hover; for panel-header links, icon buttons and toolbar actions.
- **Danger:** coral text on a 10 percent coral fill with a 25 percent coral border; destructive actions only, usually inside the danger zone.
- **States:** colour and shadow transition in 140 ms; pressed scales to 0.97; disabled drops to 45 percent opacity; loading shows a spinner and sets `aria-busy`.

**The One Primary Rule.** A view has at most one crimson button. Everything else is secondary, ghost or danger.

### Chips

- **Style:** 22 px tall, 6 px corners, 8 px padding, 11.5 px medium text (11 px in mono), 1 px border.
- **Tones:** neutral (line border, 2 percent white fill, fg-2) for plain facts; ok, warn, err at a 10 percent fill with a 20 to 25 percent border; live (line-strong border, no fill, fg-2) for running and deploying; idle (no fill, fg-3) for cancelled and low priority.

### Status dot

7 px circle (6 px small, 10 px large). ok, warn and err carry a 3 px halo; idle is fg-4; live is crimson with a ring that expands to 3.2× and fades over 1.8 s. When the dot is the only carrier of a status it takes an accessible label.

### Cards / Containers

- **Corner Style:** 10 px.
- **Background:** Graphite Panel with the sheen gradient.
- **Shadow Strategy:** inset top only (see The Flat Panel Rule).
- **Border:** 1 px line; the danger-zone form section uses a 25 percent coral border and a coral title.
- **Internal Padding:** 14 px; header 12 px by 14 px.

**The Panel Header Rule.** Every panel opens with one header row: a 13.5 px semibold title (optionally led by a 16 px fg-3 icon), an optional 11.5 px fg-3 note under it, actions on the right (ghost links, small buttons or a segmented filter), and a line-subtle hairline beneath. No second header inside the same panel.

### Inputs / Fields

- **Style:** 32 px tall, Obsidian fill, line-strong border, 6 px corners, 10 px padding, 13 px text, fg-4 placeholder. The search input adds a 14 px search icon inside at the left.
- **Focus:** border shifts to 40 percent crimson with a 3 px crimson ring at 15 percent.
- **Error / Disabled:** `aria-invalid` turns the border 50 percent coral and the hint below becomes an 11.5 px coral message; disabled drops to 50 percent opacity.
- **Form field:** a 12 px medium fg-2 label, the control, then an 11.5 px hint, 6 px apart.

### Segmented control

A 2 px padded Obsidian well with 8 px corners; options are 12 px medium text with an optional mono count. A Hover Graphite indicator travels to the selected option in 200 ms. Used for list filters (All / Running / Failed / Succeeded, All / Issues).

### Tabs

13 px medium labels, fg-3 inactive, fg active, over a line border; a 2 px crimson underline travels to the active tab in 200 ms. The list scrolls horizontally on narrow screens.

### Navigation

- **Sidebar:** 32 px items with a 16 px icon, 13 px label and an optional mono count at the right. Inactive fg-2, hover 4 percent white; active is 5.5 percent white with white text and a 2 px glowing crimson bar at the left edge. Groups (Workspace, Infrastructure, Activity) are labelled in 11 px fg-4 sentence case; Settings, Docs and Sign out sit at the bottom (Sign out hovers coral).
- **Top bar:** section name at 13 px medium, a 30 px command trigger ("Search or run a command" with a Ctrl K keycap), notifications.
- **Command palette:** Ctrl/Cmd K, full width on phones.
- **Mobile:** the sidebar slides in as a drawer from the left in 260 ms.

### Meter and uptime strip

Meters are a 4 px round track (7 percent white) under an 11 px label and a 10.5 px mono value; the fill is fg-2, or warn past its threshold. The uptime strip is 24 hourly 16 px bars 2 px apart: ok at 70 percent, warn, err, or 8 percent white for no data; hovering one bar dims the rest, and the strip is announced as one sentence ("No incidents in the last 24 hours").

### Empty state, skeleton, keycap, dialog

Empty states centre a 44 px icon tile, a 14 px title, a 13 px description capped at 36 characters, and at most one action. Skeletons shimmer a faint white gradient over 1.6 s. Keycaps are 10.5 px mono on a 4 px corner. Dialogs are Raised Graphite with 14 px corners, 20 px padding, the overlay shadow, a 70 percent black backdrop with a 2 px blur, and scale in from 0.97 over 260 ms.

### Motion and accessibility

- **Durations:** instant 90 ms, quick 140 ms (hover, press, colour), base 200 ms (indicators, switches, route fade), panel 260 ms (drawer, dialogs, attention detail, sidebar width), layout 420 ms (fleet reorder).
- **Easings:** ease-out `cubic-bezier(0.16, 1, 0.3, 1)` for almost everything; ease-in-out `cubic-bezier(0.65, 0, 0.35, 1)` for shimmer and reordering.
- **Focus:** every focusable element shows a 2 px crimson outline at a 2 px offset on `:focus-visible`; inputs use their crimson ring instead.
- **Reduced motion:** `prefers-reduced-motion` collapses every animation and transition to 1 ms, stops smooth scroll and removes the live ring; the dot itself stays.
- **Semantics:** icon-only buttons carry `aria-label`; segmented controls are radio groups, switches are `role="switch"`, meters are `role="meter"`; colour is always paired with a word or label.

## Do's and Don'ts

### Do:

- **Do** start every list page with the status bar, then grouped panels of rows; put the fix action on the row that needs it.
- **Do** keep exactly one primary (crimson) button per view; make every other action secondary, ghost or danger.
- **Do** use Down Coral for failure and the neutral live chip plus a crimson pulse dot for anything running.
- **Do** give every panel one header row: 13.5 px title, optional 11.5 px note, actions right, hairline below.
- **Do** use the literal ramp (22, 20, 18, 15, 13.5, 13, 12.5, 12, 11.5, 11, 10.5 px) and nothing between.
- **Do** set machine data in Geist Mono with tabular numerals.
- **Do** write dates as "Tue, Sep 22" for day headings, "Sep 22" within the year, "14m ago" for recent events, and clock times in 24 h.
- **Do** make status bars 2 × 2, segmented controls scroll, search fields full width and rows stack on phones.
- **Do** use Lucide at 16 px with stroke 1.75.

### Don't:

- **Don't** use crimson for failure, for decoration, or for a second button on the same view.
- **Don't** put a tone chip on a healthy or successful item; the green dot is enough.
- **Don't** add drop shadows to panels or rows; depth is tonal.
- **Don't** set uppercase labels, eyebrows or kickers; everything is sentence case.
- **Don't** introduce a second typeface or font sizes outside the ramp.
- **Don't** use 12-hour clock times.
- **Don't** animate without a reduced-motion fallback, and don't use the live pulse for anything that is not running right now.
