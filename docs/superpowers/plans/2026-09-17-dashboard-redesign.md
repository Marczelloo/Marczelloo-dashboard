# Dashboard Redesign (Phases 1–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Obsidian Console foundation, the new app shell and the new Overview (spec phases 1–3) and merge them to `main`.

**Architecture:** Design tokens live as CSS custom properties in `globals.css` and are exposed through Tailwind; legacy shadcn colour names stay as aliases so untouched pages keep working. A client `AppShell` (sidebar, top bar, drawer, command palette) wraps every dashboard page. The Overview reads one cached server aggregate (`getOverview`) assembled by pure, unit-tested functions; the agent gains a `step` field so deploy progress can be shown.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 3, Radix primitives, framer-motion 12, lucide-react, sonner, vitest (node environment, `*.test.ts` only), `geist` font package.

**Spec:** `docs/superpowers/specs/2026-09-17-dashboard-redesign-design.md` · visual reference `docs/brand/brandboard.html` · product record `PRODUCT.md`

Phases 4–8 are listed at the end as a roadmap; each gets its own detailed plan after phase 3 is merged, because they build on the primitives created here.

## Global Constraints

- Work on branch `redesign`. Nothing is pushed to `main` before Task 17; a push to `main` deploys production.
- UI copy is English, sentence case. Controls name their action ("Deploy Drive", not "Submit").
- Colours, radii, shadows, durations and easings come from the tokens in `src/app/globals.css` / `tailwind.config.ts`. No raw hex in components except `src/components/brand/mark.tsx` and the icon files.
- Icons: lucide-react only, `size-4` in UI, `strokeWidth={1.75}`.
- Fonts: Geist (`--font-geist-sans`) and Geist Mono (`--font-geist-mono`) from the `geist` package. Mono only for machine data (SHAs, domains, ports, durations, logs, keys).
- Motion: durations 90 / 140 / 200 / 260 / 420 ms, ease-out `cubic-bezier(.16,1,.3,1)`, ease-in-out `cubic-bezier(.65,0,.35,1)`. Everything respects `prefers-reduced-motion`.
- AtlasHub allows 100 requests/min for the whole dashboard. New server reads go through `ttlCache` (Task 6). Overview database inputs are cached 30 s and live agent inputs 5 s; the client polls every 15 s only while the tab is visible. (The spec said 10 s; 30 s keeps the Overview under 20 AtlasHub requests/min.)
- Demo mode (`DEMO_MODE=true`) must render every new surface with mock data and block every mutation.
- Deploy phases shown in the UI are `Fetch → Config → Build → Start → Health`, plus `Rolling back`. (The spec's "Env" is part of config in the agent and "Route" happens after the agent job, so neither is a real agent step.) The spec's "Pinned" filter is dropped: projects have no pin data.
- Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. The untracked `marczelloo-drive/` folder breaks type-checking and builds; move it out of the repo before those commands (`Move-Item marczelloo-drive ..\marczelloo-drive-aside`) and back afterwards.
- Local visual checks use `npm run dev:demo` (Task 1) at http://localhost:3100, viewports 1440×900, 1024×768 and 375×812.
- Commit messages: conventional (`feat:`, `fix:`, `chore:`, `docs:`), ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Map

| Path | Responsibility | Task |
|---|---|---|
| `scripts/dev-demo.mjs`, `package.json`, `.claude/launch.json` | Demo dev server on :3100 | 1 |
| `src/app/globals.css`, `tailwind.config.ts` | Tokens, legacy aliases, base styles, keyframes | 1 |
| `src/app/layout.tsx`, `src/components/providers/motion-provider.tsx` | Fonts, theme colour, reduced-motion config | 1 |
| `src/components/brand/mark.tsx`, `src/app/icon.svg`, `src/app/apple-icon.tsx`, `src/proxy.ts` | Frame ring M | 2 |
| `src/lib/tone.ts` (+test), `src/components/ui/button.tsx`, `chip.tsx`, `badge.tsx`, `src/components/status-dot.tsx` | Actions and status primitives | 3 |
| `src/components/ui/use-indicator.ts`, `segmented-control.tsx`, `tabs.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `label.tsx` | Form, container and navigation primitives | 4 |
| `src/components/ui/skeleton.tsx`, `empty-state.tsx`, `uptime-strip.tsx`, `meter.tsx`, `kbd.tsx`, `sonner.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `index.ts` | Feedback and overlay primitives | 5 |
| `src/server/lib/ttl-cache.ts` (+test), `src/server/shell.ts` | Cached shell data | 6 |
| `src/components/layout/nav.ts` (+test), `sidebar-preference.ts` (+test) | Navigation model | 7 |
| `src/components/layout/app-shell.tsx`, `sidebar.tsx`, `mobile-drawer.tsx`, `src/app/(dashboard)/layout.tsx`, `template.tsx`, route moves | Shell | 8 |
| `src/components/layout/self-deployment.tsx` (+`self-deployment-state.ts` test), `top-bar.tsx`, `deploy-indicator.tsx`, `notifications-dropdown.tsx`, `version-display.tsx` | Top bar | 9 |
| `src/components/layout/page-header.tsx`, `header.tsx`, 11 page files | Page header migration | 10 |
| `src/components/layout/commands.ts` (+test), `command-palette.tsx`, `src/components/features/use-pin-guard.tsx` (+`pin-guard.ts` test) | Command palette | 11 |
| `agent/src/types.ts`, `queue.ts`, `pipeline.ts`, `status.ts`, `main.ts` (+tests) | Agent `step` | 12 |
| `src/server/overview/types.ts`, `phases.ts`, `uptime.ts`, `fleet.ts` (+tests) | Fleet logic | 13 |
| `src/server/overview/activity.ts`, `tasks.ts`, `assemble.ts` (+tests) | Overview assembly | 14 |
| `src/server/overview/sources.ts`, `demo.ts`, `index.ts`, `src/app/api/overview/route.ts` | Overview data access | 15 |
| `src/app/(dashboard)/_overview/*`, `src/app/(dashboard)/page.tsx` | Overview UI | 16 |
| — | Verification, agent-first rollout, merge | 17 |

---

### Task 0: Branch

- [ ] **Step 1: Create the branch**

```bash
git checkout main
git pull --ff-only
git checkout -b redesign
```

Expected: `Switched to a new branch 'redesign'`.

---

### Task 1: Tokens, fonts and demo dev server

**Files:**
- Create: `scripts/dev-demo.mjs`, `.claude/launch.json`, `src/components/providers/motion-provider.tsx`
- Modify: `package.json` (scripts, dependency), `src/app/globals.css` (replace), `tailwind.config.ts` (replace), `src/app/layout.tsx` (replace)

**Interfaces:**
- Produces: Tailwind colours `canvas`, `surface{,-raised,-hover}`, `fg{,-2,-3,-4}`, `accent{,-solid,-solid-hover,-foreground}`, `ok`, `warn`, `err`, `line{,-subtle,-strong}`; radii `rounded-xs|sm|md|lg|xl` = 4/6/8/10/14 px; shadows `shadow-inset-top|lift|overlay`; `bg-sheen`; durations `duration-instant|quick|base|panel|layout`; easings `ease-out|ease-in-out|ease-spring`; animations `animate-live|shimmer|overlay-in|fade-in|drawer-in`; CSS classes `.dot-grid`, `.status-live`; script `npm run dev:demo`.

- [ ] **Step 1: Install the font package**

Run: `npm install geist@^1.4.2`
Expected: `package.json` lists `"geist"` under dependencies.

- [ ] **Step 2: Add the demo dev script**

`scripts/dev-demo.mjs`:

```js
import { spawn } from "node:child_process";

// Local preview with mock data and no authentication (see src/proxy.ts).
const child = spawn("npx", ["next", "dev", "--port", "3100"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DEMO_MODE: "true" },
});
child.on("exit", (code) => process.exit(code ?? 0));
```

In `package.json` `scripts`, add after `"dev"`: `"dev:demo": "node scripts/dev-demo.mjs",`

`.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "dashboard-demo", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev:demo"], "port": 3100 }
  ]
}
```

- [ ] **Step 3: Replace `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Obsidian Console (docs/brand/brandboard.html). RGB channels so Tailwind opacity modifiers work. */
    --canvas: 9 9 11;
    --surface: 17 17 19;
    --surface-raised: 24 24 27;
    --surface-hover: 31 31 35;
    --fg: 237 237 239;
    --fg-2: 180 180 188;
    --fg-3: 131 131 140;
    --fg-4: 86 86 95;
    --accent: 229 72 77;
    --accent-solid: 207 51 57;
    --accent-solid-hover: 217 59 65;
    --ok: 61 214 140;
    --warn: 245 165 36;
    --err: 255 99 105;
    --line-subtle: rgba(255, 255, 255, 0.055);
    --line: rgba(255, 255, 255, 0.085);
    --line-strong: rgba(255, 255, 255, 0.14);
    --sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.012));
    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-inout: cubic-bezier(0.65, 0, 0.35, 1);
    --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);

    /* Legacy shadcn names (HSL channels) mapped onto the tokens. Removed in phase 8. */
    --background: 240 10% 4%;
    --foreground: 240 6% 93%;
    --card: 240 6% 7%;
    --card-foreground: 240 6% 93%;
    --popover: 240 6% 10%;
    --popover-foreground: 240 6% 93%;
    --primary: 358 62% 50%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 6% 13%;
    --secondary-foreground: 240 6% 93%;
    --muted: 240 6% 13%;
    --muted-foreground: 240 3% 53%;
    --destructive: 358 100% 69%;
    --destructive-foreground: 0 0% 100%;
    --border: 240 4% 12%;
    --input: 240 4% 16%;
    --ring: 358 75% 59%;
    --success: 151 65% 54%;
    --warning: 37 91% 55%;
    --danger: 358 100% 69%;
    --radius: 10px;
  }

  * {
    @apply border-border;
  }

  html {
    color-scheme: dark;
    scroll-behavior: smooth;
    -webkit-font-smoothing: antialiased;
  }

  body {
    @apply bg-canvas font-sans text-fg;
    font-feature-settings: "ss01", "cv11";
  }

  ::selection {
    background: rgb(var(--accent) / 0.32);
    color: #fff;
  }

  * {
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }
  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border: 3px solid rgb(var(--canvas));
    border-radius: 10px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.16);
  }

  :focus-visible {
    outline: 2px solid rgb(var(--accent));
    outline-offset: 2px;
  }

  code,
  kbd,
  samp,
  .font-mono {
    font-variant-numeric: tabular-nums;
  }
}

@layer components {
  /* Faint console grid behind the top of the app; masked so it fades out. */
  .dot-grid {
    background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
    background-size: 20px 20px;
    mask-image: radial-gradient(ellipse 70% 100% at 60% 0%, #000, transparent 70%);
  }

  /* Expanding ring behind a live status dot. */
  .status-live::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: rgb(var(--accent));
    animation: live 1.8s var(--ease-out) infinite;
  }

  /* Legacy helpers still used by pages that are not migrated yet. */
  .card-hover {
    @apply transition-colors duration-quick ease-out hover:border-line-strong;
  }
  .skeleton {
    @apply animate-shimmer rounded-md bg-[length:300%_100%];
    background-image: linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.085) 40%, rgba(255, 255, 255, 0.04) 80%);
  }
  .status-dot {
    @apply h-2 w-2 rounded-full;
  }
  .status-dot-online {
    @apply bg-ok;
  }
  .status-dot-warning {
    @apply bg-warn;
  }
  .status-dot-offline {
    @apply bg-err;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  .status-live::after {
    display: none;
  }
}
```

- [ ] **Step 4: Replace `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const rgb = (token: string) => `rgb(var(--${token}) / <alpha-value>)`;
const hsl = (token: string) => `hsl(var(--${token}))`;

const config: Config = {
  darkMode: "class",
  content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: rgb("canvas"),
        surface: { DEFAULT: rgb("surface"), raised: rgb("surface-raised"), hover: rgb("surface-hover") },
        fg: { DEFAULT: rgb("fg"), 2: rgb("fg-2"), 3: rgb("fg-3"), 4: rgb("fg-4") },
        accent: { DEFAULT: rgb("accent"), solid: rgb("accent-solid"), "solid-hover": rgb("accent-solid-hover"), foreground: "#ffffff" },
        ok: rgb("ok"),
        warn: rgb("warn"),
        err: rgb("err"),
        line: { DEFAULT: "var(--line)", subtle: "var(--line-subtle)", strong: "var(--line-strong)" },
        // Legacy names, removed in phase 8.
        background: hsl("background"),
        foreground: hsl("foreground"),
        card: { DEFAULT: hsl("card"), foreground: hsl("card-foreground") },
        popover: { DEFAULT: hsl("popover"), foreground: hsl("popover-foreground") },
        primary: { DEFAULT: hsl("primary"), foreground: hsl("primary-foreground") },
        secondary: { DEFAULT: hsl("secondary"), foreground: hsl("secondary-foreground") },
        muted: { DEFAULT: hsl("muted"), foreground: hsl("muted-foreground") },
        destructive: { DEFAULT: hsl("destructive"), foreground: hsl("destructive-foreground") },
        border: hsl("border"),
        input: hsl("input"),
        ring: hsl("ring"),
        success: hsl("success"),
        warning: hsl("warning"),
        danger: hsl("danger"),
      },
      borderRadius: { xs: "4px", sm: "6px", md: "8px", lg: "10px", xl: "14px" },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        "inset-top": "inset 0 1px 0 rgba(255,255,255,.045)",
        lift: "0 6px 18px -8px rgba(0,0,0,.6)",
        overlay: "0 16px 40px -12px rgba(0,0,0,.7), 0 4px 12px -4px rgba(0,0,0,.5)",
      },
      backgroundImage: { sheen: "var(--sheen)" },
      transitionDuration: { instant: "90ms", quick: "140ms", base: "200ms", panel: "260ms", layout: "420ms" },
      transitionTimingFunction: { out: "var(--ease-out)", "in-out": "var(--ease-inout)", spring: "var(--ease-spring)" },
      keyframes: {
        live: { "0%": { transform: "scale(1)", opacity: "0.7" }, "100%": { transform: "scale(3.2)", opacity: "0" } },
        shimmer: { "0%": { backgroundPosition: "100% 0" }, "100%": { backgroundPosition: "-50% 0" } },
        "overlay-in": { "0%": { opacity: "0", scale: "0.97" }, "100%": { opacity: "1", scale: "1" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "drawer-in": { "0%": { translate: "-100% 0" }, "100%": { translate: "0 0" } },
      },
      animation: {
        live: "live 1.8s var(--ease-out) infinite",
        shimmer: "shimmer 1.6s var(--ease-inout) infinite",
        "overlay-in": "overlay-in 260ms var(--ease-out)",
        "fade-in": "fade-in 200ms var(--ease-out)",
        "drawer-in": "drawer-in 260ms var(--ease-out)",
      },
    },
  },
  plugins: [typography],
};

export default config;
```

- [ ] **Step 5: Add the motion provider**

`src/components/providers/motion-provider.tsx`:

```tsx
"use client";

import { MotionConfig } from "framer-motion";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </MotionConfig>
  );
}
```

- [ ] **Step 6: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/providers/motion-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Marczelloo Dashboard", template: "%s · Marczelloo" },
  description: "Private control panel for self-hosted projects",
  robots: "noindex, nofollow",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-fg antialiased">
        <MotionProvider>{children}</MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck` then `npm test` then `npm run build` (with `marczelloo-drive/` moved aside).
Expected: all pass. Then `npm run dev:demo`, open http://localhost:3100/dashboard: text is Geist, background near-black `#09090b`, existing cards still readable.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json scripts/dev-demo.mjs .claude/launch.json src/app/globals.css tailwind.config.ts src/app/layout.tsx src/components/providers/motion-provider.tsx
git commit -m "feat: Obsidian Console tokens, Geist fonts and demo dev server"
```

---

### Task 2: Frame ring M

**Files:**
- Create: `src/components/brand/mark.tsx`, `src/app/apple-icon.tsx`
- Modify: `src/app/icon.svg` (replace), `src/proxy.ts:28` (matcher)
- Delete: `src/app/apple-icon.png`

**Interfaces:**
- Produces: `Mark({ size?: number; variant?: "obsidian" | "crimson" | "bare"; animate?: boolean; replayKey?: string | number | null; title?: string; className?: string })`.

Geometry (64 grid): tile radius 15; ring rect x/y 10, 44×44, radius 11, stroke 5, perimeter 157.12; white 0–60 %, gap 3 %, crimson 63–76 %. 16 px cut: ring x/y 2.25, 11.5×11.5, radius 3, stroke 1.6, perimeter 40.85, crimson 63–79 %.

- [ ] **Step 1: Write `src/components/brand/mark.tsx`**

```tsx
"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export type MarkVariant = "obsidian" | "crimson" | "bare";

const VARIANTS: Record<MarkVariant, { tile: string; edge: string; ink: string; dim: string; signal: string; sheen: boolean }> = {
  obsidian: { tile: "#111113", edge: "rgba(255,255,255,.12)", ink: "#ededef", dim: "rgba(237,237,239,.16)", signal: "#e5484d", sheen: true },
  crimson: { tile: "#cf3339", edge: "rgba(255,255,255,.22)", ink: "#ffffff", dim: "rgba(255,255,255,.3)", signal: "#1b0708", sheen: true },
  bare: { tile: "transparent", edge: "transparent", ink: "#ededef", dim: "rgba(237,237,239,.16)", signal: "#e5484d", sheen: false },
};

const INK = 60;
const SIGNAL = 13;
const SIGNAL_OFFSET = 63;
const EASE = "cubic-bezier(.16,1,.3,1)";

interface MarkProps {
  size?: number;
  variant?: MarkVariant;
  /** Fill the ring once on mount and again whenever `replayKey` changes. */
  animate?: boolean;
  replayKey?: string | number | null;
  title?: string;
  className?: string;
}

export function Mark({ size = 28, variant = "obsidian", animate = false, replayKey = null, title, className }: MarkProps) {
  const colors = VARIANTS[variant];
  const sheenId = `mark-sheen-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const inkRef = useRef<SVGRectElement>(null);
  const signalRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ink = inkRef.current?.animate([{ strokeDasharray: "0 100" }, { strokeDasharray: `${INK} 100` }], { duration: 900, easing: EASE, fill: "both" });
    const signal = signalRef.current?.animate(
      [{ opacity: 0, strokeDasharray: "0 100" }, { opacity: 1, strokeDasharray: `${SIGNAL} 100` }],
      { duration: 420, delay: 760, easing: EASE, fill: "both" }
    );
    return () => {
      ink?.cancel();
      signal?.cancel();
    };
  }, [animate, replayKey]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={sheenId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".10" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={colors.tile} />
      {colors.sheen && <rect width="64" height="64" rx="15" fill={`url(#${sheenId})`} />}
      <rect x=".75" y=".75" width="62.5" height="62.5" rx="14.25" fill="none" stroke={colors.edge} strokeWidth="1.5" />
      <rect x="10" y="10" width="44" height="44" rx="11" fill="none" stroke={colors.dim} strokeWidth="5" />
      <rect ref={inkRef} x="10" y="10" width="44" height="44" rx="11" fill="none" stroke={colors.ink} strokeWidth="5" pathLength={100} strokeDasharray={`${INK} 100`} />
      <rect
        ref={signalRef}
        x="10"
        y="10"
        width="44"
        height="44"
        rx="11"
        fill="none"
        stroke={colors.signal}
        strokeWidth="5"
        pathLength={100}
        strokeDasharray={`${SIGNAL} 100`}
        strokeDashoffset={-SIGNAL_OFFSET}
      />
      <path fill={colors.ink} d="M23.5 39.5V24.5h4.1L32 31l4.4-6.5h4.1v15h-4v-8.6L32 37.3l-4.5-6.4v8.6Z" />
    </svg>
  );
}
```

- [ ] **Step 2: Replace `src/app/icon.svg` with the 16 px cut**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" role="img" aria-label="Marczelloo Dashboard">
  <rect width="16" height="16" rx="3.8" fill="#111113"/>
  <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="3" fill="none" stroke="#ededef" stroke-opacity=".22" stroke-width="1.6"/>
  <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="3" fill="none" stroke="#ededef" stroke-width="1.6" stroke-dasharray="24.51 40.85"/>
  <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="3" fill="none" stroke="#e5484d" stroke-width="1.6" stroke-dasharray="6.54 40.85" stroke-dashoffset="-25.74"/>
  <path fill="#ededef" d="M5.4 10.3V5.7h1.25L8 7.6l1.35-1.9h1.25v4.6H9.4V7.75L8 9.6 6.6 7.75v2.55Z"/>
</svg>
```

- [ ] **Step 3: Replace the PNG touch icon with a generated one**

Delete `src/app/apple-icon.png`. Create `src/app/apple-icon.tsx`:

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Crimson variant, full bleed: iOS applies its own corner mask. Ring perimeter 157.12.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#cf3339" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <rect x="10" y="10" width="44" height="44" rx="11" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="5" />
          <rect x="10" y="10" width="44" height="44" rx="11" fill="none" stroke="#ffffff" strokeWidth="5" strokeDasharray="94.27 157.12" />
          <rect x="10" y="10" width="44" height="44" rx="11" fill="none" stroke="#1b0708" strokeWidth="5" strokeDasharray="20.43 157.12" strokeDashoffset="-98.99" />
          <path fill="#ffffff" d="M23.5 39.5V24.5h4.1L32 31l4.4-6.5h4.1v15h-4v-8.6L32 37.3l-4.5-6.4v8.6Z" />
        </svg>
      </div>
    ),
    size
  );
}
```

In `src/proxy.ts`, change the matcher entry `apple-icon.png` to `apple-icon` so the generated route stays public:

```ts
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon).*)"],
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`, `npm run build`.
Expected: pass; build output lists `/apple-icon`. With `npm run dev:demo`, http://localhost:3100/icon.svg shows the ring with a crimson segment at the bottom-left, and http://localhost:3100/apple-icon returns a 180×180 crimson PNG.

- [ ] **Step 5: Commit**

```bash
git add src/components/brand/mark.tsx src/app/icon.svg src/app/apple-icon.tsx src/proxy.ts
git rm src/app/apple-icon.png
git commit -m "feat: Frame ring M mark, favicon and touch icon"
```

---

### Task 3: Status tone, Button, Chip, Badge, StatusDot

**Files:**
- Create: `src/lib/tone.ts`, `src/lib/tone.test.ts`, `src/components/ui/chip.tsx`
- Modify: `src/components/ui/button.tsx` (replace), `src/components/ui/badge.tsx` (replace), `src/components/status-dot.tsx` (replace)

**Interfaces:**
- Produces: `type Tone = "ok" | "live" | "warn" | "err" | "idle"`; `type LegacyStatus = "online" | "warning" | "offline" | "unknown"`; `toTone(status: Tone | LegacyStatus): Tone`; `Button` variants `primary | secondary | ghost | danger | link` (legacy `default | destructive | outline` still accepted), sizes `default | sm | lg | icon | icon-sm`, prop `loading`; `Chip({ tone?: Tone | "neutral"; mono?: boolean })`; `StatusDot({ status: Tone | LegacyStatus; size?: "sm" | "md" | "lg"; pulse?: boolean; label?: string })`.

- [ ] **Step 1: Write the failing test** `src/lib/tone.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { toTone } from "./tone";

describe("toTone", () => {
  it("maps legacy status names", () => {
    expect(toTone("online")).toBe("ok");
    expect(toTone("warning")).toBe("warn");
    expect(toTone("offline")).toBe("err");
    expect(toTone("unknown")).toBe("idle");
  });

  it("keeps tones unchanged", () => {
    for (const tone of ["ok", "live", "warn", "err", "idle"] as const) expect(toTone(tone)).toBe(tone);
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run src/lib/tone.test.ts` — Expected: FAIL, cannot resolve `./tone`.

- [ ] **Step 3: Implement `src/lib/tone.ts`**

```ts
/** Visual status used across the UI. `live` means an operation is running right now. */
export type Tone = "ok" | "live" | "warn" | "err" | "idle";
export type LegacyStatus = "online" | "warning" | "offline" | "unknown";

const LEGACY: Record<LegacyStatus, Tone> = { online: "ok", warning: "warn", offline: "err", unknown: "idle" };

export function toTone(status: Tone | LegacyStatus): Tone {
  return status in LEGACY ? LEGACY[status as LegacyStatus] : (status as Tone);
}
```

- [ ] **Step 4: Run it** — `npx vitest run src/lib/tone.test.ts` — Expected: PASS.

- [ ] **Step 5: Replace `src/components/ui/button.tsx`**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const primary =
  "bg-accent-solid text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(0,0,0,.4)] hover:bg-accent-solid-hover hover:shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_4px_14px_-4px_rgba(229,72,77,.55)]";
const secondary = "border-line-strong bg-surface-raised text-fg shadow-inset-top hover:bg-surface-hover";
const danger = "border-err/25 bg-err/10 text-err hover:border-err/40 hover:bg-err/15";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-sm border border-transparent font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-quick ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary,
        secondary,
        ghost: "text-fg-2 hover:bg-white/5 hover:text-fg",
        danger,
        link: "h-auto px-0 text-fg-2 underline-offset-4 hover:text-fg hover:underline active:scale-100",
        // Legacy names kept until every page is migrated (phase 8).
        default: primary,
        destructive: danger,
        outline: secondary,
      },
      size: {
        default: "h-8 px-3 text-[13px]",
        sm: "h-[26px] gap-1.5 px-[9px] text-xs [&_svg]:size-3.5",
        lg: "h-9 px-4 text-sm",
        icon: "h-8 w-8",
        "icon-sm": "h-[26px] w-[26px] [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
        {loading && !asChild ? (
          <>
            <Loader2 className="animate-spin" strokeWidth={1.75} />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 6: Create `src/components/ui/chip.tsx` and replace `badge.tsx`**

`chip.tsx`:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 text-[11.5px] font-medium [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-line bg-white/[.02] text-fg-2",
        ok: "border-ok/20 bg-ok/10 text-ok",
        warn: "border-warn/25 bg-warn/10 text-warn",
        err: "border-err/25 bg-err/10 text-err",
        live: "border-accent/40 bg-accent/10 text-[#ff9fa2]",
        idle: "border-line bg-transparent text-fg-3",
      },
      mono: { true: "font-mono text-[11px]", false: "" },
    },
    defaultVariants: { tone: "neutral", mono: false },
  }
);

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof chipVariants> {}

export function Chip({ className, tone, mono, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ tone, mono }), className)} {...props} />;
}

export { chipVariants };
```

`badge.tsx`:

```tsx
import * as React from "react";
import { chipVariants } from "./chip";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "danger";

const TONE = { default: "neutral", secondary: "neutral", outline: "neutral", destructive: "err", danger: "err", success: "ok", warning: "warn" } as const;

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant | null;
}

/** Legacy badge API rendered as a Chip; new code uses Chip directly. */
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(chipVariants({ tone: TONE[variant ?? "default"] }), className)} {...props} />;
}

const badgeVariants = ({ variant }: { variant?: BadgeVariant | null } = {}) => chipVariants({ tone: TONE[variant ?? "default"] });

export { Badge, badgeVariants };
```

- [ ] **Step 7: Replace `src/components/status-dot.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { toTone, type LegacyStatus, type Tone } from "@/lib/tone";

interface StatusDotProps {
  status: Tone | LegacyStatus;
  size?: "sm" | "md" | "lg";
  /** Legacy flag; a running operation should pass status "live" instead. */
  pulse?: boolean;
  /** Accessible name when the dot is the only carrier of the status. */
  label?: string;
  className?: string;
}

const SIZE = { sm: "size-1.5", md: "size-[7px]", lg: "size-2.5" };

const TONE: Record<Tone, string> = {
  ok: "bg-ok shadow-[0_0_0_3px_rgb(var(--ok)/.1)]",
  live: "bg-accent",
  warn: "bg-warn shadow-[0_0_0_3px_rgb(var(--warn)/.1)]",
  err: "bg-err shadow-[0_0_0_3px_rgb(var(--err)/.1)]",
  idle: "bg-fg-4",
};

export function StatusDot({ status, size = "md", pulse = false, label, className }: StatusDotProps) {
  const tone = toTone(status);
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative inline-block shrink-0 rounded-full", SIZE[size], TONE[tone], (tone === "live" || pulse) && "status-live", className)}
    />
  );
}
```

- [ ] **Step 8: Verify**

Run: `npm run typecheck`, `npm test`.
Expected: pass. Pages that pass `variant="default"` or `variant="outline"` still compile. In `npm run dev:demo`, http://localhost:3100/projects shows crimson primary buttons and toned chips.

- [ ] **Step 9: Commit**

```bash
git add src/lib/tone.ts src/lib/tone.test.ts src/components/ui/button.tsx src/components/ui/chip.tsx src/components/ui/badge.tsx src/components/status-dot.tsx
git commit -m "feat: status tones, button, chip and status dot primitives"
```

---

### Task 4: Containers, fields, tabs and segmented control

**Files:**
- Create: `src/components/ui/use-indicator.ts`, `src/components/ui/segmented-control.tsx`
- Modify (replace): `src/components/ui/card.tsx`, `input.tsx`, `textarea.tsx`, `tabs.tsx`
- Modify (class strings): `src/components/ui/select.tsx`, `src/components/ui/label.tsx`

**Interfaces:**
- Produces: `useIndicator(container: RefObject<HTMLElement | null>, activeSelector: string): { left: number; width: number } | null`; `SegmentedControl<T extends string>({ options: { value: T; label: ReactNode; count?: number }[]; value: T; onChange(value: T): void; "aria-label": string; className?: string })`; `Panel` (alias of `Card`).

- [ ] **Step 1: Write `src/components/ui/use-indicator.ts`**

```ts
"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export interface IndicatorRect {
  left: number;
  width: number;
}

/**
 * Tracks the position of the active child inside `container` (for a sliding tab
 * or segment indicator). Re-measures on resize and when state attributes change.
 */
export function useIndicator(container: RefObject<HTMLElement | null>, activeSelector: string): IndicatorRect | null {
  const [rect, setRect] = useState<IndicatorRect | null>(null);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>(activeSelector);
      setRect((previous) => {
        if (!active) return null;
        const next = { left: active.offsetLeft, width: active.offsetWidth };
        return previous && previous.left === next.left && previous.width === next.width ? previous : next;
      });
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    const mutations = new MutationObserver(measure);
    mutations.observe(root, { subtree: true, attributes: true, attributeFilter: ["data-state", "data-active"] });
    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [container, activeSelector]);

  return rect;
}
```

- [ ] **Step 2: Write `src/components/ui/segmented-control.tsx`**

```tsx
"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useIndicator } from "./use-indicator";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange(value: T): void;
  "aria-label": string;
  className?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, className, ...aria }: SegmentedControlProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const indicator = useIndicator(ref, '[data-active="true"]');

  return (
    <div ref={ref} role="radiogroup" aria-label={aria["aria-label"]} className={cn("relative inline-flex gap-0.5 rounded-md border border-line bg-canvas p-0.5", className)}>
      {indicator && (
        <span
          aria-hidden
          className="absolute inset-y-0.5 rounded-[6px] bg-surface-hover shadow-inset-top transition-[left,width] duration-base ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-[1] inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors duration-quick ease-out",
              active ? "text-fg" : "text-fg-3 hover:text-fg-2"
            )}
          >
            {option.label}
            {option.count !== undefined && <span className={cn("font-mono text-[10.5px]", active ? "text-fg-2" : "text-fg-3")}>{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/components/ui/card.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border border-line bg-surface bg-sheen text-fg shadow-inset-top", className)} {...props} />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-1 p-5", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-[15px] font-semibold leading-snug tracking-[-0.01em]", className)} {...props} />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-[13px] text-fg-3", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-5 pt-0", className)} {...props} />
));
CardFooter.displayName = "CardFooter";

/** Panel is the design-system name for a Card. */
const Panel = Card;

export { Card, Panel, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

- [ ] **Step 4: Replace `input.tsx` and `textarea.tsx`**

`input.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const fieldClass =
  "w-full rounded-sm border border-line-strong bg-canvas px-2.5 text-[13px] text-fg placeholder:text-fg-4 transition-[border-color,box-shadow] duration-quick ease-out hover:border-white/20 focus-visible:border-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15 aria-[invalid=true]:border-err/50 disabled:cursor-not-allowed disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(fieldClass, "flex h-8 file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-fg", className)}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
```

`textarea.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea className={cn(fieldClass, "flex min-h-[80px] py-2 leading-relaxed", className)} ref={ref} {...props} />
));
Textarea.displayName = "Textarea";

export { Textarea };
```

- [ ] **Step 5: Replace `src/components/ui/tabs.tsx`**

```tsx
"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { useIndicator } from "./use-indicator";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, children, ...props }, ref) => {
    const localRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => localRef.current as HTMLDivElement);
    const indicator = useIndicator(localRef, '[data-state="active"]');
    return (
      <TabsPrimitive.List ref={localRef} className={cn("relative flex items-center gap-0.5 overflow-x-auto border-b border-line", className)} {...props}>
        {children}
        {indicator && (
          <span
            aria-hidden
            className="absolute -bottom-px h-0.5 rounded-full bg-accent transition-[left,width] duration-base ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
        )}
      </TabsPrimitive.List>
    );
  }
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center gap-[7px] whitespace-nowrap rounded-sm px-2.5 pb-[11px] pt-[9px] text-[13px] font-medium text-fg-3 transition-colors duration-quick ease-out hover:text-fg-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-fg [&_svg]:size-4",
        className
      )}
      {...props}
    />
  )
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn("mt-4 focus-visible:outline-none", className)} {...props} />
);
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

- [ ] **Step 6: Update class strings in `select.tsx` and `label.tsx`**

In `src/components/ui/select.tsx`:
- `SelectTrigger` class string → `"flex h-8 w-full items-center justify-between gap-2 rounded-sm border border-line-strong bg-canvas px-2.5 text-[13px] text-fg transition-[border-color,box-shadow] duration-quick ease-out hover:border-white/20 focus:outline-none focus-visible:border-accent/40 focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-fg-4 [&>span]:line-clamp-1"`; its chevron icon class → `"size-4 text-fg-3"`.
- `SelectContent` first class string → `"relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-line-strong bg-surface-raised text-fg shadow-overlay data-[state=open]:animate-overlay-in"`.
- `SelectLabel` → `"px-2 pb-1 pt-2 text-[11px] font-medium text-fg-4"`.
- `SelectItem` → `"relative flex w-full cursor-default select-none items-center rounded-[6px] py-1.5 pl-2 pr-8 text-[13px] text-fg-2 outline-none focus:bg-white/[.06] focus:text-fg data-[disabled]:pointer-events-none data-[disabled]:opacity-50"`.
- `SelectSeparator` → `"-mx-1 my-1 h-px bg-line"`.

In `src/components/ui/label.tsx`, set the `cva` base string of `labelVariants` to `"text-xs font-medium text-fg-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60"`.

- [ ] **Step 7: Verify**

Run: `npm run typecheck`. Expected: pass.
In `npm run dev:demo`, open http://localhost:3100/containers/1/… (any container detail from the list): the tab underline slides between tabs; open http://localhost:3100/settings: inputs are 32 px with a soft crimson focus ring.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/use-indicator.ts src/components/ui/segmented-control.tsx src/components/ui/card.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/ui/tabs.tsx src/components/ui/select.tsx src/components/ui/label.tsx
git commit -m "feat: panel, field, tabs and segmented control primitives"
```

---

### Task 5: Feedback and overlay primitives

**Files:**
- Create: `src/components/ui/empty-state.tsx`, `uptime-strip.tsx`, `meter.tsx`, `kbd.tsx`
- Modify (replace): `src/components/ui/skeleton.tsx`, `src/components/ui/sonner.tsx`
- Modify (class strings): `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `index.ts`

**Interfaces:**
- Consumes: `Button` (Task 3).
- Produces: `EmptyState({ icon: LucideIcon; title: string; description?: string; action?: ReactNode; className?: string })`; `type UptimeState = "ok" | "warn" | "down" | "none"`; `UptimeStrip({ buckets: { start: string; state: UptimeState }[]; className?: string })`; `Meter({ label: string; value: number; display?: string; tone?: "neutral" | "warn" })`; `Kbd`; all exported from `@/components/ui`.

- [ ] **Step 1: Replace `skeleton.tsx`**

```tsx
import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden className={cn("skeleton", className)} {...props} />;
}

export { Skeleton };
```

- [ ] **Step 2: Create `empty-state.tsx`, `meter.tsx`, `kbd.tsx`**

`empty-state.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-5 py-9 text-center", className)}>
      <div className="mb-1.5 grid size-11 place-items-center rounded-lg border border-line bg-surface-raised text-fg-3 shadow-inset-top">
        <Icon className="size-4" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="max-w-[36ch] text-[13px] text-fg-3">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

`meter.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface MeterProps {
  label: string;
  /** 0–100 */
  value: number;
  display?: string;
  tone?: "neutral" | "warn";
  className?: string;
}

export function Meter({ label, value, display, tone = "neutral", className }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2 text-[11px] text-fg-3">
        <span>{label}</span>
        <span className="font-mono text-[10.5px] text-fg-2">{display ?? `${Math.round(clamped)}%`}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[.07]" role="meter" aria-label={label} aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone === "warn" ? "bg-warn" : "bg-fg-2")} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
```

`kbd.tsx`:

```tsx
import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <kbd className={cn("inline-flex items-center rounded-xs border border-line-strong bg-white/[.03] px-[5px] py-px font-mono text-[10.5px] font-medium text-fg-3", className)} {...props} />;
}
```

- [ ] **Step 3: Create `uptime-strip.tsx`**

```tsx
import { cn } from "@/lib/utils";

export type UptimeState = "ok" | "warn" | "down" | "none";

const STATE: Record<UptimeState, { className: string; label: string }> = {
  ok: { className: "bg-ok/70", label: "up" },
  warn: { className: "bg-warn/90", label: "degraded" },
  down: { className: "bg-err", label: "down" },
  none: { className: "bg-white/[.08]", label: "no data" },
};

interface UptimeStripProps {
  buckets: { start: string; state: UptimeState }[];
  className?: string;
}

export function UptimeStrip({ buckets, className }: UptimeStripProps) {
  const down = buckets.filter((bucket) => bucket.state === "down").length;
  const degraded = buckets.filter((bucket) => bucket.state === "warn").length;
  const summary = down || degraded ? `${down} hours down, ${degraded} degraded in the last ${buckets.length} hours` : `No incidents in the last ${buckets.length} hours`;
  return (
    <div role="img" aria-label={summary} className={cn("group/uptime flex h-4 gap-0.5", className)}>
      {buckets.map((bucket) => {
        const hour = new Date(bucket.start).toISOString().slice(11, 16);
        return (
          <span
            key={bucket.start}
            title={`${hour} UTC · ${STATE[bucket.state].label}`}
            className={cn(
              "flex-1 origin-bottom rounded-[2px] transition-[opacity,transform] duration-quick ease-out group-hover/uptime:opacity-50 hover:!opacity-100 hover:scale-y-[1.15]",
              STATE[bucket.state].className
            )}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Replace `sonner.tsx`**

```tsx
"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    position="bottom-right"
    toastOptions={{
      classNames: {
        toast: "!rounded-lg !border !border-line-strong !bg-surface-raised !text-fg !shadow-overlay !font-sans",
        title: "!text-[13px] !font-medium",
        description: "!text-xs !text-fg-3",
        actionButton: "!bg-accent-solid !text-white !rounded-sm",
        cancelButton: "!bg-surface-hover !text-fg-2 !rounded-sm",
        success: "[&_[data-icon]]:!text-ok",
        error: "[&_[data-icon]]:!text-err",
        warning: "[&_[data-icon]]:!text-warn",
        info: "[&_[data-icon]]:!text-fg-2",
      },
    }}
    {...props}
  />
);

export { Toaster };
```

- [ ] **Step 5: Update overlay class strings**

`dialog.tsx`:
- `DialogOverlay` → `"fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-fade-in"`.
- `DialogContent` → `"fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-line-strong bg-surface-raised p-5 text-fg shadow-overlay data-[state=open]:animate-overlay-in"`.
- Close button → `"absolute right-3 top-3 grid size-7 place-items-center rounded-sm text-fg-3 transition-colors duration-quick hover:bg-white/5 hover:text-fg disabled:pointer-events-none"`.
- `DialogTitle` → `"text-[15px] font-semibold tracking-[-0.01em]"`; `DialogDescription` → `"text-[13px] text-fg-3"`; `DialogFooter` → `"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"`.

`alert-dialog.tsx`: the same overlay and content strings as `dialog.tsx`; title → `"text-[15px] font-semibold"`; description → `"text-[13px] text-fg-3"`; footer → `"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"`; `AlertDialogAction` → `cn(buttonVariants({ variant: "primary" }), className)`; `AlertDialogCancel` → `cn(buttonVariants({ variant: "secondary" }), className)`.

`dropdown-menu.tsx`:
- `DropdownMenuContent` and `DropdownMenuSubContent` → `"z-50 min-w-[10rem] overflow-hidden rounded-md border border-line-strong bg-surface-raised p-1 text-fg shadow-overlay data-[state=open]:animate-overlay-in"` (delete the second animation string of Content).
- `DropdownMenuItem` → `"relative flex cursor-default select-none items-center gap-2 rounded-[6px] px-2 py-1.5 text-[13px] text-fg-2 outline-none transition-colors duration-quick focus:bg-white/[.06] focus:text-fg data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0"`.
- `DropdownMenuSubTrigger` → `"flex cursor-default select-none items-center gap-2 rounded-[6px] px-2 py-1.5 text-[13px] text-fg-2 outline-none focus:bg-white/[.06] data-[state=open]:bg-white/[.06] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"`.
- `DropdownMenuCheckboxItem` / `RadioItem` → `"relative flex cursor-default select-none items-center rounded-[6px] py-1.5 pl-8 pr-2 text-[13px] text-fg-2 outline-none transition-colors focus:bg-white/[.06] focus:text-fg data-[disabled]:pointer-events-none data-[disabled]:opacity-50"`.
- `DropdownMenuLabel` → `"px-2 pb-1 pt-2 text-[11px] font-medium text-fg-4"`; separator → `"-mx-1 my-1 h-px bg-line"`; shortcut → `"ml-auto font-mono text-[10.5px] text-fg-4"`.

`tooltip.tsx`: `TooltipContent` → `"z-50 overflow-hidden rounded-sm border border-line-strong bg-surface-raised px-2 py-1 text-xs text-fg shadow-overlay data-[state=delayed-open]:animate-overlay-in"`.

`index.ts`: append

```ts
export { Chip, chipVariants } from "./chip";
export { Panel } from "./card";
export { SegmentedControl, type SegmentedOption } from "./segmented-control";
export { EmptyState } from "./empty-state";
export { UptimeStrip, type UptimeState } from "./uptime-strip";
export { Meter } from "./meter";
export { Kbd } from "./kbd";
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck`, `npm run lint`.
Expected: pass. In `npm run dev:demo`: open a dropdown (project card menu on http://localhost:3100/projects) — it scales in, focused items are grey (not crimson); trigger a toast (any blocked demo action) — dark raised toast.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui
git commit -m "feat: feedback and overlay primitives on the new tokens"
```

---

### Task 6: Cached shell data

**Files:**
- Create: `src/server/lib/ttl-cache.ts`, `src/server/lib/ttl-cache.test.ts`, `src/server/shell.ts`

**Interfaces:**
- Produces: `ttlCache<T>(ttlMs: number, load: () => Promise<T>, now?: () => number): () => Promise<T>` (single-flight, failures not cached); `interface ShellProject { id: string; name: string; slug: string }`; `interface ShellData { projects: ShellProject[]; counts: { projects: number; tasks: number } }`; `getShellData(): Promise<ShellData>` (never throws, 60 s cache).

- [ ] **Step 1: Write the failing test** `src/server/lib/ttl-cache.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { ttlCache } from "./ttl-cache";

describe("ttlCache", () => {
  it("reuses a value until it expires", async () => {
    let clock = 0;
    const load = vi.fn(async () => clock);
    const get = ttlCache(1000, load, () => clock);
    expect(await get()).toBe(0);
    clock = 999;
    expect(await get()).toBe(0);
    clock = 1000;
    expect(await get()).toBe(1000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between concurrent callers", async () => {
    let resolve!: (value: string) => void;
    const load = vi.fn(() => new Promise<string>((done) => (resolve = done)));
    const get = ttlCache(1000, load, () => 0);
    const both = Promise.all([get(), get()]);
    resolve("x");
    expect(await both).toEqual(["x", "x"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    const get = ttlCache(1000, load, () => 0);
    await expect(get()).rejects.toThrow("boom");
    expect(await get()).toBe("ok");
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run src/server/lib/ttl-cache.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/server/lib/ttl-cache.ts`**

```ts
/**
 * Memoises an async loader for `ttlMs`. Concurrent callers share one load and a
 * failed load is not cached. Used to keep AtlasHub reads under its rate limit.
 */
export function ttlCache<T>(ttlMs: number, load: () => Promise<T>, now: () => number = Date.now): () => Promise<T> {
  let entry: { at: number; value: T } | null = null;
  let inflight: Promise<T> | null = null;
  return () => {
    if (entry && now() - entry.at < ttlMs) return Promise.resolve(entry.value);
    if (inflight) return inflight;
    inflight = load()
      .then((value) => {
        entry = { at: now(), value };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };
}
```

- [ ] **Step 4: Run it** — Expected: PASS (3 tests).

- [ ] **Step 5: Implement `src/server/shell.ts`**

```ts
import "server-only";

import { generalTodos, projects, workItems } from "@/server/data";
import { ttlCache } from "@/server/lib/ttl-cache";

export interface ShellProject {
  id: string;
  name: string;
  slug: string;
}

export interface ShellData {
  projects: ShellProject[];
  counts: { projects: number; tasks: number };
}

const EMPTY: ShellData = { projects: [], counts: { projects: 0, tasks: 0 } };

const load = ttlCache(60_000, async (): Promise<ShellData> => {
  const [allProjects, todos, items] = await Promise.all([projects.getProjects({ limit: 1000 }), generalTodos.getActiveTodos(), workItems.getOpenWorkItems()]);
  const visible = allProjects.filter((project) => project.status !== "archived").sort((a, b) => a.name.localeCompare(b.name));
  return {
    projects: visible.map(({ id, name, slug }) => ({ id, name, slug })),
    counts: { projects: visible.length, tasks: todos.length + items.length },
  };
});

/** Navigation counts and the command palette's project list; never throws. */
export async function getShellData(): Promise<ShellData> {
  try {
    return await load();
  } catch (error) {
    console.error("[shell] Failed to load shell data:", error);
    return EMPTY;
  }
}
```

- [ ] **Step 6: Verify** — `npm run typecheck`, `npm test` — Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/server/lib/ttl-cache.ts src/server/lib/ttl-cache.test.ts src/server/shell.ts
git commit -m "feat: ttl cache and cached shell data"
```

---

### Task 7: Navigation model and sidebar preference

**Files:**
- Create: `src/components/layout/nav.ts`, `nav.test.ts`, `sidebar-preference.ts`, `sidebar-preference.test.ts`

**Interfaces:**
- Produces: `NAV_GROUPS: NavGroup[]`, `FOOTER_LINKS: NavItem[]`, `interface NavItem { href: string; label: string; icon: LucideIcon; countKey?: "projects" | "tasks" }`, `interface NavGroup { label: string | null; items: NavItem[] }`, `isActive(pathname: string, href: string): boolean`, `sectionFor(pathname: string): NavItem | null`; `type SidebarMode = "expanded" | "collapsed"`, `readSidebarMode(storage: Pick<Storage, "getItem"> | null): SidebarMode`, `writeSidebarMode(storage: Pick<Storage, "setItem"> | null, mode: SidebarMode): void`.

Route decisions for this phase: `/host` and `/tasks` are thin aliases of today's `/pi` and `/todos` pages (Task 8) until phases 5–6 replace them. The Deployments item is added in phase 7 together with its page.

- [ ] **Step 1: Write the failing tests**

`src/components/layout/nav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FOOTER_LINKS, isActive, NAV_GROUPS, sectionFor } from "./nav";

describe("isActive", () => {
  it("matches Overview only on the root path", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/projects", "/")).toBe(false);
  });

  it("matches a section and its sub-pages but not look-alike prefixes", () => {
    expect(isActive("/projects", "/projects")).toBe(true);
    expect(isActive("/projects/abc?tab=env", "/projects")).toBe(true);
    expect(isActive("/projectsx", "/projects")).toBe(false);
  });
});

describe("sectionFor", () => {
  it("finds the navigation entry for nested and footer routes", () => {
    expect(sectionFor("/projects/abc")?.label).toBe("Projects");
    expect(sectionFor("/settings")?.label).toBe("Settings");
    expect(sectionFor("/")?.label).toBe("Overview");
    expect(sectionFor("/nowhere")).toBeNull();
  });
});

describe("navigation", () => {
  it("has unique destinations and no Tech News", () => {
    const hrefs = [...NAV_GROUPS.flatMap((group) => group.items), ...FOOTER_LINKS].map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).not.toContain("/news");
  });
});
```

`src/components/layout/sidebar-preference.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readSidebarMode, SIDEBAR_KEY, writeSidebarMode } from "./sidebar-preference";

describe("sidebar preference", () => {
  it("defaults to expanded and reads a stored collapsed value", () => {
    expect(readSidebarMode(null)).toBe("expanded");
    expect(readSidebarMode({ getItem: () => "collapsed" })).toBe("collapsed");
    expect(readSidebarMode({ getItem: () => "garbage" })).toBe("expanded");
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readSidebarMode(broken)).toBe("expanded");
    expect(() => writeSidebarMode(broken, "collapsed")).not.toThrow();
  });

  it("writes under a stable key", () => {
    const written: string[] = [];
    writeSidebarMode({ setItem: (key, value) => written.push(`${key}=${value}`) }, "collapsed");
    expect(written).toEqual([`${SIDEBAR_KEY}=collapsed`]);
  });
});
```

- [ ] **Step 2: Run them** — `npx vitest run src/components/layout` — Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `nav.ts`**

```ts
import { Activity, BookOpen, Box, Cpu, FolderKanban, History, LayoutDashboard, ListChecks, Server, Settings, Sparkles, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  countKey?: "projects" | "tasks";
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ href: "/", label: "Overview", icon: LayoutDashboard }] },
  {
    label: "Workspace",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban, countKey: "projects" },
      { href: "/tasks", label: "Tasks", icon: ListChecks, countKey: "tasks" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { href: "/host", label: "Host", icon: Cpu },
      { href: "/containers", label: "Containers", icon: Box },
      { href: "/services", label: "Services", icon: Server },
      { href: "/monitoring", label: "Monitoring", icon: Activity },
    ],
  },
  { label: "Activity", items: [{ href: "/audit-log", label: "Audit log", icon: History }] },
];

export const FOOTER_LINKS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/features", label: "Features", icon: Sparkles },
];

export function isActive(pathname: string, href: string): boolean {
  const path = pathname.split(/[?#]/)[0];
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function sectionFor(pathname: string): NavItem | null {
  const items = [...NAV_GROUPS.flatMap((group) => group.items), ...FOOTER_LINKS];
  return items.find((item) => isActive(pathname, item.href)) ?? null;
}
```

- [ ] **Step 4: Implement `sidebar-preference.ts`**

```ts
export type SidebarMode = "expanded" | "collapsed";

export const SIDEBAR_KEY = "mz.sidebar";

export function readSidebarMode(storage: Pick<Storage, "getItem"> | null): SidebarMode {
  try {
    return storage?.getItem(SIDEBAR_KEY) === "collapsed" ? "collapsed" : "expanded";
  } catch {
    return "expanded";
  }
}

export function writeSidebarMode(storage: Pick<Storage, "setItem"> | null, mode: SidebarMode): void {
  try {
    storage?.setItem(SIDEBAR_KEY, mode);
  } catch {
    // Private windows and blocked storage: the preference just does not persist.
  }
}

/** `window.localStorage`, or null when the browser refuses access. */
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the tests** — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/nav.ts src/components/layout/nav.test.ts src/components/layout/sidebar-preference.ts src/components/layout/sidebar-preference.test.ts
git commit -m "feat: navigation model and sidebar preference"
```

---

### Task 8: App shell, sidebar, drawer and route moves

**Files:**
- Create: `src/components/layout/app-shell.tsx`, `sidebar.tsx`, `mobile-drawer.tsx`, `src/app/(dashboard)/template.tsx`, `src/app/(dashboard)/host/page.tsx`, `src/app/(dashboard)/tasks/page.tsx`
- Move: `src/app/(dashboard)/dashboard/page.tsx` → `src/app/(dashboard)/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx` (replace), `next.config.ts`, `src/components/layout/index.ts`, `src/components/layout/version-display.tsx`
- Delete: `src/app/page.tsx`, `src/app/(dashboard)/news/` (whole folder), old `src/components/layout/sidebar.tsx` content (replaced)

**Interfaces:**
- Consumes: `ShellData` (Task 6), `NAV_GROUPS`, `FOOTER_LINKS`, `isActive`, sidebar preference (Task 7), `Mark` (Task 2).
- Produces: `AppShell({ data: ShellData; children })`; `SidebarNav({ expanded: boolean; counts: ShellData["counts"]; onNavigate?: () => void })`; `Sidebar({ mode: SidebarMode; counts; onToggleMode(): void; className?: string })`; `MobileDrawer({ open: boolean; onOpenChange(open: boolean): void; counts })`. `AppShell` exposes slots used by Task 9 (`TopBar`) and Task 11 (`CommandPalette`): until those tasks land it renders a plain 52 px bar with the menu button.

- [ ] **Step 1: Move routes and add redirects**

```bash
git mv "src/app/(dashboard)/dashboard/page.tsx" "src/app/(dashboard)/page.tsx"
git rm src/app/page.tsx
git rm -r "src/app/(dashboard)/news"
```

In the moved `src/app/(dashboard)/page.tsx`, change every `./_components/` import to `./dashboard/_components/`.

`src/app/(dashboard)/host/page.tsx`:

```tsx
// Alias of the Raspberry Pi page until phase 6 moves it here.
export { default } from "../pi/page";
```

`src/app/(dashboard)/tasks/page.tsx`:

```tsx
// Alias of the todos page until phase 5 replaces it with the unified Tasks view.
export { default } from "../todos/page";
```

`next.config.ts` — add inside `nextConfig`:

```ts
  async redirects() {
    return [
      { source: "/dashboard", destination: "/", permanent: true },
      { source: "/news", destination: "/", permanent: true },
      { source: "/pi", destination: "/host", permanent: true },
      { source: "/todos", destination: "/tasks", permanent: true },
    ];
  },
```

- [ ] **Step 2: Write `src/components/layout/sidebar.tsx` (replace)**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Mark } from "@/components/brand/mark";
import { cn } from "@/lib/utils";
import type { ShellData } from "@/server/shell";
import { FOOTER_LINKS, isActive, NAV_GROUPS, type NavItem } from "./nav";
import type { SidebarMode } from "./sidebar-preference";
import { VersionDisplay } from "./version-display";

interface SidebarNavProps {
  expanded: boolean;
  counts: ShellData["counts"];
  onNavigate?: () => void;
  /** Replays the mark animation, e.g. while the dashboard deploys itself. */
  markReplayKey?: string | null;
}

/** `hidden xl:inline` when the rail may expand on wide screens, always hidden when collapsed. */
function labelClass(expanded: boolean, responsive: boolean) {
  if (!expanded) return "hidden";
  return responsive ? "hidden xl:inline" : "inline";
}

function NavLink({ item, active, expanded, responsive, count, onNavigate }: { item: NavItem; active: boolean; expanded: boolean; responsive: boolean; count?: number; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "relative flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] transition-colors duration-quick ease-out",
        active ? "bg-white/[.055] text-white" : "text-fg-2 hover:bg-white/[.04] hover:text-fg"
      )}
    >
      {active && <span aria-hidden className="absolute -left-2 bottom-2 top-2 w-0.5 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent)/.8)]" />}
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span className={cn("truncate", labelClass(expanded, responsive))}>{item.label}</span>
      {count !== undefined && <span className={cn("ml-auto font-mono text-[10.5px] text-fg-3", labelClass(expanded, responsive))}>{count}</span>}
    </Link>
  );
}

export function SidebarNav({ expanded, counts, onNavigate, responsive = false, markReplayKey = null }: SidebarNavProps & { responsive?: boolean }) {
  const pathname = usePathname();
  const label = labelClass(expanded, responsive);
  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex h-[52px] shrink-0 items-center gap-2.5 px-3.5">
        <Mark size={26} animate replayKey={markReplayKey} title="Marczelloo Dashboard" />
        <span className={cn("leading-tight", label)}>
          <span className="block text-[13.5px] font-semibold tracking-[-0.01em]">Marczelloo</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-fg-3">Dashboard</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 pb-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label ?? "root"} className="mt-1">
            {group.label && <p className={cn("px-2.5 pb-1 pt-3 text-[11px] font-medium text-fg-4", label)}>{group.label}</p>}
            {group.label && !expanded && <div aria-hidden className="mx-2.5 my-2 h-px bg-line-subtle" />}
            <div className="flex flex-col gap-px">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  expanded={expanded}
                  responsive={responsive}
                  count={item.countKey ? counts[item.countKey] : undefined}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line-subtle px-2 py-2">
        <div className="flex flex-col gap-px">
          {FOOTER_LINKS.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} expanded={expanded} responsive={responsive} onNavigate={onNavigate} />
          ))}
          <a
            href="/cdn-cgi/access/logout"
            title="Sign out"
            className="flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] text-fg-3 transition-colors duration-quick hover:bg-err/10 hover:text-err"
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
            <span className={label}>Sign out</span>
          </a>
        </div>
        <div className={label}>
          <VersionDisplay />
        </div>
      </div>
    </div>
  );
}

interface SidebarProps {
  mode: SidebarMode;
  counts: ShellData["counts"];
  onToggleMode(): void;
  markReplayKey?: string | null;
  className?: string;
}

export function Sidebar({ mode, counts, onToggleMode, markReplayKey, className }: SidebarProps) {
  const expanded = mode === "expanded";
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex-col border-r border-line-subtle bg-canvas transition-[width] duration-panel ease-out",
        expanded ? "w-14 xl:w-[232px]" : "w-14",
        className
      )}
    >
      <SidebarNav expanded={expanded} responsive counts={counts} markReplayKey={markReplayKey} />
      <button
        type="button"
        onClick={onToggleMode}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        className="absolute -right-3 top-[64px] hidden size-6 place-items-center rounded-full border border-line-strong bg-surface-raised text-fg-3 opacity-0 shadow-lift transition-[opacity,color] duration-quick hover:text-fg focus-visible:opacity-100 group-hover/shell:opacity-100 xl:grid"
      >
        {expanded ? <PanelLeftClose className="size-3.5" strokeWidth={1.75} /> : <PanelLeftOpen className="size-3.5" strokeWidth={1.75} />}
      </button>
    </aside>
  );
}
```

- [ ] **Step 3: Write `src/components/layout/mobile-drawer.tsx`**

```tsx
"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ShellData } from "@/server/shell";
import { SidebarNav } from "./sidebar";

interface MobileDrawerProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  counts: ShellData["counts"];
}

export function MobileDrawer({ open, onOpenChange, counts }: MobileDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in md:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-[272px] max-w-[85vw] border-r border-line-strong bg-canvas shadow-overlay focus:outline-none data-[state=open]:animate-drawer-in md:hidden">
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <SidebarNav expanded counts={counts} onNavigate={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

- [ ] **Step 4: Write `src/components/layout/app-shell.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ShellData } from "@/server/shell";
import { MobileDrawer } from "./mobile-drawer";
import { Sidebar } from "./sidebar";
import { browserStorage, readSidebarMode, writeSidebarMode, type SidebarMode } from "./sidebar-preference";

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<SidebarMode>("expanded");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setMode(readSidebarMode(browserStorage())), []);
  useEffect(() => setDrawerOpen(false), [pathname]);

  const toggleMode = () =>
    setMode((current) => {
      const next = current === "expanded" ? "collapsed" : "expanded";
      writeSidebarMode(browserStorage(), next);
      return next;
    });

  return (
    <div className="group/shell relative min-h-screen bg-canvas">
      <div aria-hidden className="dot-grid pointer-events-none fixed inset-x-0 top-0 h-[420px]" />
      <Sidebar mode={mode} counts={data.counts} onToggleMode={toggleMode} className="hidden md:flex" />
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} counts={data.counts} />
      <div className={cn("relative flex min-h-screen flex-col transition-[padding] duration-panel ease-out md:pl-14", mode === "expanded" && "xl:pl-[232px]")}>
        {/* Replaced by <TopBar> in Task 9. */}
        <header className="sticky top-0 z-30 flex h-[52px] items-center border-b border-line-subtle bg-canvas/80 px-4 backdrop-blur-md md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
            <Menu strokeWidth={1.75} />
          </Button>
        </header>
        <main className="relative flex-1">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Page transition template** `src/app/(dashboard)/template.tsx`

```tsx
"use client";

import { motion } from "framer-motion";

// Re-mounts on every navigation: content fades up 4 px; the shell in layout.tsx stays still.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 6: Replace `src/app/(dashboard)/layout.tsx`**

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { DemoBanner } from "@/components/layout/demo-banner";
import { isDemoMode } from "@/lib/demo-mode";
import { getShellData } from "@/server/shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const data = await getShellData();
  return (
    <>
      {isDemoMode() && <DemoBanner />}
      <AppShell data={data}>{children}</AppShell>
    </>
  );
}
```

`src/components/layout/index.ts`:

```ts
export { AppShell } from "./app-shell";
export { Sidebar, SidebarNav } from "./sidebar";
export { Header } from "./header";
```

- [ ] **Step 7: Restyle `version-display.tsx`**

Remove the `DeploymentStatusBanner` import and its `<DeploymentStatusBanner … />` line (the top bar takes it over in Task 9). Replace the loading branch with `return <div className="h-8" />;` and the loaded markup with:

```tsx
  if (!version) return null;
  return (
    <div className="mt-1 flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-fg-4" title={version.subject ?? undefined}>
      <GitCommit className="size-3.5 shrink-0" strokeWidth={1.75} />
      <code className="text-fg-3">{version.shortCommit}</code>
      <span className="truncate">· {formatRelativeTime(version.deployedAt)}</span>
    </div>
  );
```

- [ ] **Step 8: Verify**

Run: `npm run typecheck`, `npm test`, `npm run build`.
Expected: pass; the build lists `/`, `/host`, `/tasks` and no `/news`.
In `npm run dev:demo`:
- 1440 px: http://localhost:3100/ shows the old dashboard content inside the new 232 px sidebar with groups Workspace / Infrastructure / Activity, crimson indicator on Overview, mark fills once on first load.
- Hover the sidebar edge and collapse it: 56 px icon rail, preference survives a reload.
- 1024 px: rail with icons only.
- 375 px: no sidebar; the menu button opens the drawer, which closes after choosing a page.
- http://localhost:3100/dashboard, `/pi`, `/todos` redirect to `/`, `/host`, `/tasks`.

- [ ] **Step 9: Commit**

```bash
git add -A src/app src/components/layout next.config.ts
git commit -m "feat: app shell with grouped sidebar, icon rail and mobile drawer"
```

---

### Task 9: Top bar and self-deploy indicator

**Files:**
- Create: `src/components/layout/self-deployment-state.ts`, `self-deployment-state.test.ts`, `self-deployment.tsx`, `deploy-indicator.tsx`, `top-bar.tsx`
- Modify: `src/components/layout/app-shell.tsx`, `src/components/layout/notifications-dropdown.tsx` (class strings)
- Delete: `src/components/layout/deployment-status-banner.tsx`

**Interfaces:**
- Consumes: `/api/deployment/status` → `{ commit: string | null; activeJob: { jobId: string; kind: string; logFile: string } | null }` (`SelfDeployment` in `src/server/agent/self-version.ts`); `sectionFor` (Task 7); `LiveDeployLogs` (`src/components/features/live-deploy-logs.tsx`, props `logFile`, `isRunning`, `defaultExpanded`, `className`).
- Produces: `selfDeployState(deployment: SelfDeployment | null, loadedCommit: string | null, dismissedCommit: string | null): "deploying" | "new-version" | null`; `SelfDeploymentProvider({ children })`; `useSelfDeployment(): { deployment: SelfDeployment | null; state: ReturnType<typeof selfDeployState>; dismiss(): void }`; `TopBar({ onOpenMenu(): void; onOpenPalette(): void })`.

- [ ] **Step 1: Write the failing test** `src/components/layout/self-deployment-state.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { selfDeployState } from "./self-deployment-state";

const job = { jobId: "j1", kind: "deploy", logFile: "agent:j1" };

describe("selfDeployState", () => {
  it("reports a running self deploy first", () => {
    expect(selfDeployState({ commit: "b", activeJob: job }, "a", null)).toBe("deploying");
  });

  it("offers a reload when a different release is live", () => {
    expect(selfDeployState({ commit: "b", activeJob: null }, "a", null)).toBe("new-version");
  });

  it("stays quiet when nothing changed, the page commit is unknown, or the release was dismissed", () => {
    expect(selfDeployState({ commit: "a", activeJob: null }, "a", null)).toBeNull();
    expect(selfDeployState({ commit: "b", activeJob: null }, null, null)).toBeNull();
    expect(selfDeployState({ commit: "b", activeJob: null }, "a", "b")).toBeNull();
    expect(selfDeployState(null, "a", null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run src/components/layout/self-deployment-state.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `self-deployment-state.ts`**

```ts
import type { SelfDeployment } from "@/server/agent/self-version";

export type SelfDeployState = "deploying" | "new-version" | null;

export function selfDeployState(deployment: SelfDeployment | null, loadedCommit: string | null, dismissedCommit: string | null): SelfDeployState {
  if (!deployment) return null;
  if (deployment.activeJob) return "deploying";
  if (loadedCommit && deployment.commit && deployment.commit !== loadedCommit && deployment.commit !== dismissedCommit) return "new-version";
  return null;
}
```

If `src/server/agent/self-version.ts` imports `server-only` at runtime, this `import type` is erased and safe for client code.

- [ ] **Step 4: Run it** — Expected: PASS.

- [ ] **Step 5: Write `self-deployment.tsx`**

```tsx
"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { SelfDeployment } from "@/server/agent/self-version";
import { selfDeployState, type SelfDeployState } from "./self-deployment-state";

interface SelfDeploymentValue {
  deployment: SelfDeployment | null;
  state: SelfDeployState;
  dismiss(): void;
}

const SelfDeploymentContext = createContext<SelfDeploymentValue>({ deployment: null, state: null, dismiss: () => undefined });

/** Polls the dashboard's own deploy status every 10 s; shared by the top bar and the sidebar mark. */
export function SelfDeploymentProvider({ children }: { children: React.ReactNode }) {
  const [deployment, setDeployment] = useState<SelfDeployment | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const loadedCommit = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const response = await fetch("/api/deployment/status", { cache: "no-store" });
        if (!response.ok || !mounted) return;
        const next = (await response.json()) as SelfDeployment;
        if (loadedCommit.current === null && next.commit && !next.activeJob) loadedCommit.current = next.commit;
        setDeployment(next);
      } catch {
        // The dashboard restarts during its own deploy; the next poll catches up.
      }
    };
    void check();
    const interval = setInterval(check, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const value: SelfDeploymentValue = {
    deployment,
    state: selfDeployState(deployment, loadedCommit.current, dismissed),
    dismiss: () => setDismissed(deployment?.commit ?? null),
  };
  return <SelfDeploymentContext.Provider value={value}>{children}</SelfDeploymentContext.Provider>;
}

export function useSelfDeployment(): SelfDeploymentValue {
  return useContext(SelfDeploymentContext);
}
```

- [ ] **Step 6: Write `deploy-indicator.tsx`**

```tsx
"use client";

import { RefreshCw, X } from "lucide-react";
import { LiveDeployLogs } from "@/components/features/live-deploy-logs";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSelfDeployment } from "./self-deployment";

export function DeployIndicator() {
  const { deployment, state, dismiss } = useSelfDeployment();
  if (!state || !deployment) return null;

  if (state === "new-version") {
    return (
      <div className="flex h-[30px] items-center gap-1 rounded-sm border border-ok/25 bg-ok/10 pl-2.5 pr-1 text-xs text-ok">
        <RefreshCw className="size-3.5" strokeWidth={1.75} />
        <span className="hidden sm:inline">New version</span>
        <Button size="sm" variant="ghost" className="h-6 text-ok hover:bg-ok/10 hover:text-ok" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button size="icon-sm" variant="ghost" className="size-6 text-ok/70 hover:text-ok" onClick={dismiss} aria-label="Dismiss new version">
          <X />
        </Button>
      </div>
    );
  }

  const job = deployment.activeJob!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex h-[30px] items-center gap-2 whitespace-nowrap rounded-sm border border-accent/40 bg-accent/10 px-2.5 text-xs text-[#ffb3b5] transition-colors duration-quick hover:bg-accent/15">
          <StatusDot status="live" size="sm" />
          <span className="hidden sm:inline">Deploying dashboard</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(560px,calc(100vw-2rem))] p-3">
        <LiveDeployLogs logFile={job.logFile} isRunning defaultExpanded />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 7: Write `top-bar.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { DeployIndicator } from "./deploy-indicator";
import { sectionFor } from "./nav";
import { NotificationsDropdown } from "./notifications-dropdown";

interface TopBarProps {
  onOpenMenu(): void;
  onOpenPalette(): void;
}

export function TopBar({ onOpenMenu, onOpenPalette }: TopBarProps) {
  const section = sectionFor(usePathname());
  return (
    <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-line-subtle bg-canvas/80 px-4 backdrop-blur-md md:px-6">
      <Button variant="ghost" size="icon" className="-ml-1.5 md:hidden" onClick={onOpenMenu} aria-label="Open navigation">
        <Menu strokeWidth={1.75} />
      </Button>
      <p className="min-w-0 truncate text-[13px] font-medium text-fg">{section?.label}</p>
      <button
        type="button"
        onClick={onOpenPalette}
        className="ml-auto flex h-[30px] min-w-0 max-w-[260px] flex-1 items-center gap-2 rounded-sm border border-line bg-white/[.02] px-2.5 text-[12.5px] text-fg-4 transition-colors duration-quick ease-out hover:border-line-strong hover:bg-white/[.035] sm:flex-none sm:basis-[260px]"
      >
        <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
        <span className="truncate">Search or run a command</span>
        <Kbd className="ml-auto hidden sm:inline-flex">Ctrl K</Kbd>
      </button>
      <DeployIndicator />
      <NotificationsDropdown />
    </header>
  );
}
```

- [ ] **Step 8: Wire into `app-shell.tsx`**

Wrap the returned tree in `<SelfDeploymentProvider>` (import from `./self-deployment`). Replace the temporary `<header>…</header>` with:

```tsx
        <TopBar onOpenMenu={() => setDrawerOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
```

Add `const [paletteOpen, setPaletteOpen] = useState(false);` (the palette itself arrives in Task 11; until then `paletteOpen` is unused, so add `void paletteOpen;` directly below the state to satisfy lint). Pass the self-deploy job to the mark: inside the provider create a small child component

```tsx
function ShellSidebar(props: Omit<React.ComponentProps<typeof Sidebar>, "markReplayKey">) {
  const { deployment } = useSelfDeployment();
  return <Sidebar {...props} markReplayKey={deployment?.activeJob?.jobId ?? null} />;
}
```

and render `<ShellSidebar …/>` instead of `<Sidebar …/>`. Remove the now unused `Menu` and `Button` imports.

- [ ] **Step 9: Restyle `notifications-dropdown.tsx`**

Class string replacements:
- Trigger `Button`: `variant="ghost" size="icon"`; unread badge → `"absolute right-1 top-1 grid min-w-[16px] place-items-center rounded-full bg-accent-solid px-1 font-mono text-[9.5px] leading-4 text-white"`.
- Panel `div` → `"absolute right-0 top-full z-50 mt-2 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line-strong bg-surface-raised shadow-overlay animate-overlay-in"`.
- Header row → `"flex items-center justify-between border-b border-line-subtle px-3 py-2.5"`, title → `"text-[13px] font-medium"`, "Mark all read" → `"text-xs text-fg-3 hover:text-fg"`.
- Spinner → replace the spinning div with `<Loader2 className="size-4 animate-spin text-fg-3" strokeWidth={1.75} />` (import `Loader2`).
- Empty text → `"py-8 text-center text-[13px] text-fg-3"`.
- Item row → `` `flex gap-3 px-3 py-2.5 transition-colors duration-quick hover:bg-white/[.04] ${!notification.read ? "bg-white/[.02]" : ""}` ``; title `"text-[13px] font-medium"`; message and time `"text-xs text-fg-3"`; unread dot → `<StatusDot status="live" size="sm" className="mt-1.5" />` without the pulse animation class (import `StatusDot`).
- Icons: `CheckCircle` → `className="size-4 text-ok"`, `AlertTriangle` → `"size-4 text-warn"`, `Bell` → `"size-4 text-fg-3"`; add `strokeWidth={1.75}` to each.
- Footer link → `"flex items-center justify-center gap-1 rounded-sm p-2 text-xs text-fg-3 hover:bg-white/[.04] hover:text-fg"`.

- [ ] **Step 10: Delete the old banner and verify**

```bash
git rm src/components/layout/deployment-status-banner.tsx
```

Run: `npm run typecheck`, `npm run lint`, `npm test`.
Expected: pass. In `npm run dev:demo` at 1440 and 375 px: sticky top bar with section name, search trigger (full width on phone), bell; no deploy pill (demo returns no active job).

- [ ] **Step 11: Commit**

```bash
git add -A src/components/layout
git commit -m "feat: top bar with section title, search trigger and self-deploy indicator"
```

---

### Task 10: Page header and header migration

**Files:**
- Create: `src/components/layout/page-header.tsx`
- Modify: `src/components/layout/header.tsx` (replace), `src/app/(dashboard)/page.tsx`, `audit-log/page.tsx`, `containers/page.tsx`, `docs/page.tsx`, `features/page.tsx`, `monitoring/page.tsx`, `pi/page.tsx`, `projects/page.tsx`, `services/page.tsx`, `settings/page.tsx`, `todos/page.tsx` (all under `src/app/(dashboard)/`)
- Delete: `src/components/layout/page-info-button.tsx`, `src/lib/page-info.ts` (after the grep in Step 4 is empty)

**Interfaces:**
- Produces: `PageHeader({ title: string; description?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string })`, `PageBody({ children; className? })`. `Header({ title, description, children })` keeps its API and renders `PageHeader` with `children` as `actions`.

- [ ] **Step 1: Write `page-header.tsx`**

```tsx
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Buttons aligned to the right of the title. */
  actions?: React.ReactNode;
  /** Row under the title, typically tabs. */
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, children, className }: PageHeaderProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-4 pt-6 md:px-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight tracking-[-0.02em] text-fg">{title}</h1>
          {description && <p className="mt-1 text-[13px] text-fg-3">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6", className)}>{children}</div>;
}
```

- [ ] **Step 2: Replace `header.tsx`**

```tsx
import { PageHeader } from "./page-header";

interface HeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/** Legacy page header API; new pages use PageHeader directly. */
export function Header({ title, description, children }: HeaderProps) {
  return <PageHeader title={title} description={description} actions={children} />;
}
```

- [ ] **Step 3: Migrate the hand-built headers**

In each page listed under **Files**, replace the whole `<header …>…</header>` block with `<PageHeader title="…" description="…" actions={…} />` using this rule set:
- `title`: the text of the old `<h1>` (for `pi/page.tsx` use `"Host"`; for `todos/page.tsx` use `"Tasks"`).
- `description`: the old subtitle `<p>`, translated to English where it is Polish.
- `actions`: every interactive element that sat on the right side of the old header (buttons, links, selects), unchanged except `variant="outline"` → `variant="secondary"`.
- Drop the icon tile (`div` with `rounded-xl bg-primary/10`) and every `<PageInfoButton …/>`.
- Wrap the content that followed the header in `<PageBody>` when it had its own `p-6`/`px-6 py-4` wrapper; remove that padding from the wrapper.
- Remove imports that become unused (`PageInfoButton`, `PAGE_INFO`, the header icon).

Example for `src/app/(dashboard)/projects/page.tsx` (before → after):

```tsx
// before
<header className="shrink-0 border-b border-border/50 bg-card/30 px-6 py-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><FolderKanban className="h-5 w-5 text-primary" /></div>
      <div><h1 className="text-lg font-semibold">Projects</h1><p className="text-sm text-muted-foreground">Manage your projects</p></div>
    </div>
    <div className="flex items-center gap-2"><PageInfoButton {...PAGE_INFO.projects} /><Button asChild>…New Project…</Button></div>
  </div>
</header>
<div className="flex-1 p-6">…</div>

// after
<PageHeader title="Projects" description="Everything deployed from this Pi" actions={<Button asChild>…New project…</Button>} />
<PageBody>…</PageBody>
```

- [ ] **Step 4: Remove the page-info leftovers**

Run: `git grep -n "PageInfoButton\|PAGE_INFO" -- src`
Expected: no output. Then:

```bash
git rm src/components/layout/page-info-button.tsx src/lib/page-info.ts
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`, `npm run lint`, `npm run build`.
Expected: pass. In `npm run dev:demo`, visit `/`, `/projects`, `/services`, `/containers`, `/monitoring`, `/host`, `/tasks`, `/audit-log`, `/settings`, `/docs`, `/features` at 1440 and 375 px: each has the same 20 px title block aligned with the content, actions wrap under the title on the phone, no horizontal scroll.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat: shared page header across dashboard pages"
```

---

### Task 11: Command palette

**Files:**
- Create: `src/components/layout/commands.ts`, `commands.test.ts`, `command-palette.tsx`, `src/components/features/pin-guard.ts`, `pin-guard.test.ts`, `use-pin-guard.tsx`
- Modify: `src/components/layout/app-shell.tsx`

**Interfaces:**
- Consumes: `ShellProject` (Task 6), `NAV_GROUPS`, `FOOTER_LINKS` (Task 7), `deployProjectAction(id: string): Promise<ActionResult<…>>` from `@/app/actions/projects`, `PinDialog({ open, onSuccess, onCancel })` from `@/components/pin-dialog`.
- Produces: `interface Command { id: string; kind: "page" | "project" | "action"; label: string; hint?: string; href?: string; deployProjectId?: string; keywords: string[] }`; `buildCommands(projects: ShellProject[]): Command[]`; `filterCommands(commands: Command[], query: string, limit?: number): Command[]`; `needsPin(result: { success: boolean; error?: string; requirePin?: boolean }): boolean`; `usePinGuard(): { run<T extends { success: boolean; error?: string; requirePin?: boolean }>(action: () => Promise<T>): Promise<T | null>; dialog: ReactNode }`; `CommandPalette({ open: boolean; onOpenChange(open: boolean): void; projects: ShellProject[] })`.

- [ ] **Step 1: Write the failing tests**

`src/components/layout/commands.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCommands, filterCommands } from "./commands";

const projects = [
  { id: "p1", name: "Drive", slug: "drive" },
  { id: "p2", name: "AtlasHub", slug: "atlas-hub" },
];

describe("buildCommands", () => {
  it("lists pages, projects and per-project actions", () => {
    const commands = buildCommands(projects);
    expect(commands.find((command) => command.id === "page:/")).toMatchObject({ kind: "page", label: "Overview", href: "/" });
    expect(commands.find((command) => command.id === "project:p1")).toMatchObject({ kind: "project", href: "/projects/p1" });
    expect(commands.find((command) => command.id === "deploy:p1")).toMatchObject({ kind: "action", label: "Deploy Drive", deployProjectId: "p1" });
    expect(commands.find((command) => command.id === "logs:p2")).toMatchObject({ href: "/projects/p2?tab=deployments" });
    expect(commands.find((command) => command.id === "rollback:p2")).toMatchObject({ label: "Roll back AtlasHub", href: "/projects/p2?tab=deployments" });
  });
});

describe("filterCommands", () => {
  const commands = buildCommands(projects);

  it("shows pages and projects, not actions, for an empty query", () => {
    const result = filterCommands(commands, "  ");
    expect(result.some((command) => command.kind === "action")).toBe(false);
    expect(result[0].label).toBe("Overview");
  });

  it("ranks prefix matches first, then word prefixes, then substrings", () => {
    const result = filterCommands(commands, "dri");
    expect(result[0]).toMatchObject({ id: "project:p1" });
    expect(result.map((command) => command.id)).toContain("deploy:p1");
  });

  it("matches slugs and is case-insensitive", () => {
    expect(filterCommands(commands, "ATLAS-HUB").map((command) => command.id)).toContain("project:p2");
  });

  it("respects the limit and drops non-matches", () => {
    expect(filterCommands(commands, "zzz")).toEqual([]);
    expect(filterCommands(commands, "a", 2)).toHaveLength(2);
  });
});
```

`src/components/features/pin-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { needsPin } from "./pin-guard";

describe("needsPin", () => {
  it("detects both PIN signals", () => {
    expect(needsPin({ success: false, requirePin: true })).toBe(true);
    expect(needsPin({ success: false, error: "PIN verification required" })).toBe(true);
  });

  it("ignores other outcomes", () => {
    expect(needsPin({ success: true })).toBe(false);
    expect(needsPin({ success: false, error: "This action is disabled in demo mode" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run them** — `npx vitest run src/components/layout/commands.test.ts src/components/features/pin-guard.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `commands.ts`**

```ts
import type { ShellProject } from "@/server/shell";
import { FOOTER_LINKS, NAV_GROUPS } from "./nav";

export type CommandKind = "page" | "project" | "action";

export interface Command {
  id: string;
  kind: CommandKind;
  label: string;
  hint?: string;
  href?: string;
  deployProjectId?: string;
  keywords: string[];
}

const KIND_ORDER: Record<CommandKind, number> = { page: 0, project: 1, action: 2 };

export function buildCommands(projects: ShellProject[]): Command[] {
  const pages: Command[] = [...NAV_GROUPS.flatMap((group) => group.items), ...FOOTER_LINKS].map((item) => ({
    id: `page:${item.href}`,
    kind: "page",
    label: item.label,
    href: item.href,
    keywords: [item.label.toLowerCase()],
  }));
  const projectCommands: Command[] = projects.flatMap((project) => {
    const keywords = [project.name.toLowerCase(), project.slug.toLowerCase()];
    const deployments = `/projects/${project.id}?tab=deployments`;
    return [
      { id: `project:${project.id}`, kind: "project", label: project.name, hint: project.slug, href: `/projects/${project.id}`, keywords },
      { id: `deploy:${project.id}`, kind: "action", label: `Deploy ${project.name}`, deployProjectId: project.id, keywords },
      { id: `logs:${project.id}`, kind: "action", label: `Open ${project.name} deployments`, href: deployments, keywords },
      { id: `rollback:${project.id}`, kind: "action", label: `Roll back ${project.name}`, hint: "choose a release", href: deployments, keywords },
    ];
  });
  return [...pages, ...projectCommands];
}

function score(command: Command, query: string): number | null {
  const label = command.label.toLowerCase();
  if (label.startsWith(query)) return 0;
  if (label.split(/\s+/).some((word) => word.startsWith(query))) return 1;
  if (label.includes(query)) return 2;
  if (command.keywords.some((keyword) => keyword.includes(query))) return 3;
  return null;
}

export function filterCommands(commands: Command[], query: string, limit = 12): Command[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return commands.filter((command) => command.kind !== "action").slice(0, limit);
  return commands
    .map((command) => ({ command, rank: score(command, normalized) }))
    .filter((entry): entry is { command: Command; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || KIND_ORDER[a.command.kind] - KIND_ORDER[b.command.kind] || a.command.label.localeCompare(b.command.label))
    .slice(0, limit)
    .map((entry) => entry.command);
}
```

- [ ] **Step 4: Implement `pin-guard.ts` and `use-pin-guard.tsx`**

`pin-guard.ts`:

```ts
export interface GuardedResult {
  success: boolean;
  error?: string;
  requirePin?: boolean;
}

/** Server actions report a missing PIN either as a flag or as the AuthError message. */
export function needsPin(result: GuardedResult): boolean {
  return result.requirePin === true || result.error === "PIN verification required";
}
```

`use-pin-guard.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { PinDialog } from "@/components/pin-dialog";
import { needsPin, type GuardedResult } from "./pin-guard";

/** Runs an action; when it needs the PIN, asks for it once and retries. */
export function usePinGuard() {
  const [open, setOpen] = useState(false);
  const pending = useRef<((verified: boolean) => void) | null>(null);

  async function run<T extends GuardedResult>(action: () => Promise<T>): Promise<T | null> {
    const first = await action();
    if (!needsPin(first)) return first;
    const verified = await new Promise<boolean>((resolve) => {
      pending.current = resolve;
      setOpen(true);
    });
    return verified ? action() : null;
  }

  const settle = (verified: boolean) => {
    setOpen(false);
    pending.current?.(verified);
    pending.current = null;
  };

  return { run, dialog: <PinDialog open={open} onSuccess={() => settle(true)} onCancel={() => settle(false)} /> };
}
```

- [ ] **Step 5: Run the tests** — Expected: PASS.

- [ ] **Step 6: Implement `command-palette.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, FolderKanban, Rocket, Search } from "lucide-react";
import { toast } from "sonner";
import { deployProjectAction } from "@/app/actions/projects";
import { usePinGuard } from "@/components/features/use-pin-guard";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type { ShellProject } from "@/server/shell";
import { buildCommands, filterCommands, type Command } from "./commands";

const GROUP_LABEL = { page: "Pages", project: "Projects", action: "Actions" } as const;

interface CommandPaletteProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  projects: ShellProject[];
}

export function CommandPalette({ open, onOpenChange, projects }: CommandPaletteProps) {
  const router = useRouter();
  const guard = usePinGuard();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const commands = useMemo(() => buildCommands(projects), [projects]);
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  const close = () => {
    onOpenChange(false);
    setQuery("");
    setSelected(0);
  };

  const execute = async (command: Command) => {
    close();
    if (command.href) {
      router.push(command.href);
      return;
    }
    if (command.deployProjectId) {
      const result = await guard.run(() => deployProjectAction(command.deployProjectId!));
      if (!result) return;
      if (result.success) toast.success(`${command.label} queued`, { description: "Follow it on the project's Deployments tab." });
      else toast.error(`${command.label} failed`, { description: result.error });
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && results[selected]) {
      event.preventDefault();
      void execute(results[selected]);
    }
  };

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
          <DialogPrimitive.Content
            onKeyDown={onKeyDown}
            className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-xl border border-line-strong bg-surface-raised shadow-overlay focus:outline-none data-[state=open]:animate-overlay-in"
          >
            <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
            <div className="flex h-12 items-center gap-2.5 border-b border-line-subtle px-3.5">
              <Search className="size-4 text-fg-3" strokeWidth={1.75} />
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected(0);
                }}
                placeholder="Search pages and projects, or type an action"
                aria-label="Search commands"
                className="h-full flex-1 bg-transparent text-sm text-fg placeholder:text-fg-4 focus:outline-none"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div role="listbox" aria-label="Commands" className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
              {results.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-fg-3">No matches for “{query}”.</p>}
              {results.map((command, index) => {
                const Icon = command.kind === "project" ? FolderKanban : command.deployProjectId ? Rocket : ArrowRight;
                const header = index === 0 || results[index - 1].kind !== command.kind;
                return (
                  <div key={command.id}>
                    {header && <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-fg-4">{GROUP_LABEL[command.kind]}</p>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === selected}
                      onMouseMove={() => setSelected(index)}
                      onClick={() => void execute(command)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors duration-instant",
                        index === selected ? "bg-white/[.06] text-fg" : "text-fg-2"
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-fg-3" strokeWidth={1.75} />
                      <span className="truncate">{command.label}</span>
                      {command.hint && <span className="ml-auto truncate font-mono text-[11px] text-fg-4">{command.hint}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 border-t border-line-subtle px-3.5 py-2 text-[11px] text-fg-4">
              <span>↑↓ move</span>
              <span>↵ run</span>
              <span>esc close</span>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      {guard.dialog}
    </>
  );
}
```

- [ ] **Step 7: Wire into `app-shell.tsx`**

Remove the `void paletteOpen;` line added in Task 9. Add the keyboard shortcut and render the palette:

```tsx
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
```

and, as the last child inside the outer shell `div`:

```tsx
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} projects={data.projects} />
```

- [ ] **Step 8: Verify**

Run: `npm run typecheck`, `npm run lint`, `npm test`.
Expected: pass. In `npm run dev:demo`: `Ctrl K` opens the palette; typing `atl` shows AtlasHub first; arrows and Enter navigate; "Deploy AtlasHub" shows a demo-mode error toast; Esc closes; at 375 px the palette is full width with 16 px margins.

- [ ] **Step 9: Commit**

```bash
git add src/components/layout/commands.ts src/components/layout/commands.test.ts src/components/layout/command-palette.tsx src/components/features/pin-guard.ts src/components/features/pin-guard.test.ts src/components/features/use-pin-guard.tsx src/components/layout/app-shell.tsx
git commit -m "feat: command palette with page, project and deploy commands"
```

---

### Task 12: Agent reports the current deploy step

**Files:**
- Modify: `agent/src/types.ts` (`Job`, `ProjectStatus`), `agent/src/queue.ts` (`enqueue`, `finishJob`, new `setJobStep`), `agent/src/pipeline.ts` (new `stepLabel`), `agent/src/status.ts:109`, `agent/src/main.ts:89`
- Test: `agent/src/queue.test.ts`, `agent/src/pipeline.test.ts`, `agent/src/status.test.ts`
- Modify fixtures: `src/server/monitoring/cycle.test.ts:107`, `src/server/monitoring/targets.test.ts:86`, `agent/src/server.test.ts:132`

**Interfaces:**
- Produces: `Job.step?: string | null`; `ProjectStatus.activeJob: { id: string; kind: string; status: string; step: string | null; sha: string; startedAt: string | null } | null`; `setJobStep(state: AgentState, jobId: string, step: string | null): AgentState`; `stepLabel(line: string): string | null`.

- [ ] **Step 1: Write the failing tests**

Append to `agent/src/queue.test.ts` (add `setJobStep` to the import list):

```ts
describe("setJobStep", () => {
  it("records the step of a running job and clears it when the job finishes", () => {
    let state = startJob(enqueue(emptyState(), input("j1", "a"), "t1").state, "j1", "t2");
    state = setJobStep(state, "j1", "Build");
    expect(state.jobs[0].step).toBe("Build");
    state = finishJob(state, "j1", { status: "succeeded", error: null, rolledBackTo: null, release: null, baseline: null, orphanImages: [] }, "t3");
    expect(state.jobs[0].step).toBeNull();
  });

  it("ignores queued, finished and unknown jobs and returns the same state when nothing changes", () => {
    const queued = enqueue(emptyState(), input("j1", "a"), "t1").state;
    expect(setJobStep(queued, "j1", "Build")).toBe(queued);
    expect(setJobStep(queued, "missing", "Build")).toBe(queued);
    const running = setJobStep(startJob(queued, "j1", "t2"), "j1", "Build");
    expect(setJobStep(running, "j1", "Build")).toBe(running);
  });
});
```

Append to `agent/src/pipeline.test.ts` (add `stepLabel` to its import from `./pipeline`):

```ts
describe("stepLabel", () => {
  it("extracts the label of a step banner", () => {
    expect(stepLabel("=== Build ===")).toBe("Build");
    expect(stepLabel("=== Git fetch 7e1f0aa ===\n")).toBe("Git fetch 7e1f0aa");
  });

  it("ignores ordinary log lines", () => {
    expect(stepLabel("#14 DONE 9.2s")).toBeNull();
    expect(stepLabel("[agent] deploy tools @ abc")).toBeNull();
  });
});
```

Append to `agent/src/status.test.ts` (import `assembleAgentStatus` from `./status`, and `emptyState`, `enqueue`, `startJob`, `setJobStep` from `./queue`):

```ts
describe("assembleAgentStatus", () => {
  it("exposes the active job's step, commit and start time", () => {
    const target = { projectId: "p", composeProject: "drive", repoPath: "/r", githubUrl: "https://github.com/x/y", branch: "main", composeFile: null, profiles: [], tunnel: null };
    let state = enqueue(emptyState(), { id: "j1", kind: "deploy", target, sha: "a".repeat(40), deployId: "d1", triggeredBy: "test" }, "t1").state;
    state = setJobStep(startJob(state, "j1", "2026-09-17T10:00:00.000Z"), "j1", "Build");
    const status = assembleAgentStatus(state, {}, null, null, "now");
    expect(status.projects.drive.activeJob).toEqual({ id: "j1", kind: "deploy", status: "running", step: "Build", sha: "a".repeat(40), startedAt: "2026-09-17T10:00:00.000Z" });
  });
});
```

- [ ] **Step 2: Run them** — `npx vitest run agent/src/queue.test.ts agent/src/pipeline.test.ts agent/src/status.test.ts` — Expected: FAIL (`setJobStep`, `stepLabel` not exported; `activeJob` lacks fields).

- [ ] **Step 3: Implement**

`agent/src/types.ts`, inside `interface Job` after `rolledBackTo`:

```ts
  /** Label of the pipeline step running now; null when not running. Missing in older jobs. */
  step?: string | null;
```

and in `ProjectStatus`:

```ts
  activeJob: { id: string; kind: string; status: string; step: string | null; sha: string; startedAt: string | null } | null;
```

`agent/src/queue.ts`: in `enqueue` add `step: null` to the new job object literal; in `finishJob`'s updater add `step: null`; add after `startJob`:

```ts
export function setJobStep(state: AgentState, jobId: string, step: string | null): AgentState {
  const current = state.jobs.find((job) => job.id === jobId);
  if (!current || current.status !== "running" || (current.step ?? null) === step) return state;
  return { ...state, jobs: updateJob(state, jobId, (job) => ({ ...job, step })).jobs };
}
```

`agent/src/pipeline.ts`, below `describeError`:

```ts
/** `=== Build ===` banners written by runStep and the health gate mark the start of a step. */
export function stepLabel(line: string): string | null {
  const match = /^=== (.+) ===\s*$/.exec(line);
  return match ? match[1] : null;
}
```

`agent/src/status.ts:109`:

```ts
      activeJob: active ? { id: active.id, kind: active.kind, status: active.status, step: active.step ?? null, sha: active.sha, startedAt: active.startedAt } : null,
```

`agent/src/main.ts:89` — replace the `log` constant (import `setJobStep` from `./queue` and `stepLabel` from `./pipeline`):

```ts
  const log = (line: string) => {
    const step = stepLabel(line);
    if (step) mutate((current) => setJobStep(current, job.id, step));
    store.appendLog(job.id, line.endsWith("\n") ? line : `${line}\n`);
  };
```

- [ ] **Step 4: Update fixtures**

Add `step: null, sha: "a".repeat(40), startedAt: null` to the `activeJob` object literals in `src/server/monitoring/cycle.test.ts:107`, `src/server/monitoring/targets.test.ts:86` and `agent/src/server.test.ts:132`.

- [ ] **Step 5: Run everything** — `npm test`, `npm run typecheck`, and in `agent/`: `npx tsc --noEmit -p .` — Expected: PASS.

- [ ] **Step 6: Commit (agent-only, shipped first in Task 17)**

```bash
git add agent/src src/server/monitoring/cycle.test.ts src/server/monitoring/targets.test.ts
git commit -m "feat(agent): report the running pipeline step in job state and status"
```

---

### Task 13: Fleet logic — phases, uptime buckets, attention, ranking

**Files:**
- Create: `src/server/overview/types.ts`, `phases.ts`, `phases.test.ts`, `uptime.ts`, `uptime.test.ts`, `fleet.ts`, `fleet.test.ts`

**Interfaces:**
- Consumes: `Tone` (Task 3), `UptimeState` (Task 5), `ProjectStatus` from `@agent/types` (Task 12), `TargetState` from `@/server/monitoring/types`, `MonitorIncident` from `@/server/atlashub/monitor` (type only).
- Produces (all in `src/server/overview/`):
  - `types.ts`: `DeployPhase = "fetch" | "config" | "build" | "start" | "health" | "rollback"`; `HourBucket { start: string; state: UptimeState }`; `Attention` = `{ kind: "deploying"; jobId: string; phase: DeployPhase | null; startedAt: string | null; sha: string }` | `{ kind: "down" | "degraded"; reason: string; since: string; container: { name: string; service: string; status: string; exitCode: number } | null }`; `FleetRow { projectId; name; slug; domain: string | null; composeProject: string | null; serviceId: string | null; tone: Tone; uptime: HourBucket[]; containers: { running: number; total: number } | null; lastDeploy: { at: string; sha: string | null; status: DeployStatus } | null; attention: Attention | null }`.
  - `phases.ts`: `DEPLOY_PHASES: DeployPhase[]` (without rollback), `deployPhase(step: string | null | undefined): DeployPhase | null`.
  - `uptime.ts`: `hourlyUptime(incidents: Pick<MonitorIncident, "project_id" | "severity" | "started_at" | "ended_at">[], projectId: string, monitored: boolean, now: Date, hours?: number): HourBucket[]`.
  - `fleet.ts`: `attentionFor(input: { agent: ProjectStatus | null; states: TargetState[] }): Attention | null`; `toneFor(attention: Attention | null, monitored: boolean): Tone`; `rankFleet(rows: FleetRow[]): FleetRow[]`.

- [ ] **Step 1: Write `types.ts`**

```ts
import type { UptimeState } from "@/components/ui/uptime-strip";
import type { Tone } from "@/lib/tone";
import type { DeployStatus } from "@/types";

export type DeployPhase = "fetch" | "config" | "build" | "start" | "health" | "rollback";

export interface HourBucket {
  start: string;
  state: UptimeState;
}

export type Attention =
  | { kind: "deploying"; jobId: string; phase: DeployPhase | null; startedAt: string | null; sha: string }
  | { kind: "down" | "degraded"; reason: string; since: string; container: { name: string; service: string; status: string; exitCode: number } | null };

export interface FleetRow {
  projectId: string;
  name: string;
  slug: string;
  domain: string | null;
  composeProject: string | null;
  /** Docker service used for restarts. */
  serviceId: string | null;
  tone: Tone;
  uptime: HourBucket[];
  containers: { running: number; total: number } | null;
  lastDeploy: { at: string; sha: string | null; status: DeployStatus } | null;
  attention: Attention | null;
}
```

- [ ] **Step 2: Write the failing tests**

`phases.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deployPhase } from "./phases";

describe("deployPhase", () => {
  it("maps agent step labels to UI phases", () => {
    expect(deployPhase("Aktualny commit")).toBe("fetch");
    expect(deployPhase("Sprawdzenie lokalnych zmian")).toBe("fetch");
    expect(deployPhase("Git clone")).toBe("fetch");
    expect(deployPhase("Git fetch 7e1f0aa")).toBe("fetch");
    expect(deployPhase("Git checkout 7e1f0aa")).toBe("fetch");
    expect(deployPhase("Compose config")).toBe("config");
    expect(deployPhase("Sieć edge")).toBe("config");
    expect(deployPhase("Walidacja Compose")).toBe("config");
    expect(deployPhase("Zapis .env")).toBe("config");
    expect(deployPhase("Build")).toBe("build");
    expect(deployPhase("Uruchomienie")).toBe("start");
    expect(deployPhase("Bramka zdrowia")).toBe("health");
    expect(deployPhase("Rollback do 4c5d6e7")).toBe("rollback");
    expect(deployPhase("Przywracanie poprzedniego .env")).toBe("rollback");
  });

  it("returns null for missing or unknown steps", () => {
    expect(deployPhase(null)).toBeNull();
    expect(deployPhase(undefined)).toBeNull();
    expect(deployPhase("Something new")).toBeNull();
  });
});
```

`uptime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hourlyUptime } from "./uptime";

const now = new Date("2026-09-17T12:30:00.000Z");

describe("hourlyUptime", () => {
  it("returns 24 hour buckets ending with the current hour", () => {
    const buckets = hourlyUptime([], "p", true, now);
    expect(buckets).toHaveLength(24);
    expect(buckets[0].start).toBe("2026-09-16T13:00:00.000Z");
    expect(buckets[23].start).toBe("2026-09-17T12:00:00.000Z");
    expect(buckets.every((bucket) => bucket.state === "ok")).toBe(true);
  });

  it("marks hours overlapped by this project's incidents, down winning over warning", () => {
    const buckets = hourlyUptime(
      [
        { project_id: "p", severity: "warning", started_at: "2026-09-17T09:50:00.000Z", ended_at: "2026-09-17T10:05:00.000Z" },
        { project_id: "p", severity: "down", started_at: "2026-09-17T10:40:00.000Z", ended_at: "2026-09-17T10:45:00.000Z" },
        { project_id: "p", severity: "down", started_at: "2026-09-17T12:16:00.000Z", ended_at: null },
        { project_id: "other", severity: "down", started_at: "2026-09-17T05:00:00.000Z", ended_at: null },
      ],
      "p",
      true,
      now
    );
    const byHour = Object.fromEntries(buckets.map((bucket) => [bucket.start.slice(11, 13), bucket.state]));
    expect(byHour["09"]).toBe("warn");
    expect(byHour["10"]).toBe("down");
    expect(byHour["11"]).toBe("ok");
    expect(byHour["12"]).toBe("down");
    expect(byHour["05"]).toBe("ok");
  });

  it("shows no data for projects without monitor targets", () => {
    expect(hourlyUptime([], "p", false, now).every((bucket) => bucket.state === "none")).toBe(true);
  });
});
```

`fleet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { TargetState } from "@/server/monitoring/types";
import { attentionFor, rankFleet, toneFor } from "./fleet";
import type { FleetRow } from "./types";

const state = (partial: Partial<TargetState>): TargetState => ({
  key: "domain:x",
  kind: "domain",
  label: "x",
  projectId: "p",
  status: "ok",
  failCount: 0,
  since: "2026-09-17T12:00:00.000Z",
  lastCheckedAt: null,
  lastError: null,
  detail: {},
  ...partial,
});

const exited = { name: "mewbit-api-1", service: "api", status: "exited", exitCode: 137, restartCount: 0, health: null, oomKilled: false, startedAt: null, finishedAt: null };
const running = { ...exited, name: "mewbit-bot-1", service: "bot", status: "running", exitCode: 0 };

describe("attentionFor", () => {
  it("prefers an active deploy over any failure", () => {
    const attention = attentionFor({
      agent: { containers: [exited], activeJob: { id: "j", kind: "deploy", status: "running", step: "Build", sha: "abc", startedAt: "t" }, lastFinishedAt: null },
      states: [state({ status: "down", lastError: "502" })],
    });
    expect(attention).toEqual({ kind: "deploying", jobId: "j", phase: "build", startedAt: "t", sha: "abc" });
  });

  it("reports down before degraded, with the first stopped container", () => {
    const attention = attentionFor({
      agent: { containers: [running, exited], activeJob: null, lastFinishedAt: null },
      states: [state({ status: "warning", lastError: "slow" }), state({ key: "containers:mewbit", kind: "containers", status: "down", lastError: "api exited", since: "s" })],
    });
    expect(attention).toEqual({ kind: "down", reason: "api exited", since: "s", container: { name: "mewbit-api-1", service: "api", status: "exited", exitCode: 137 } });
  });

  it("reports degraded and returns null when healthy", () => {
    expect(attentionFor({ agent: null, states: [state({ status: "warning", lastError: null, since: "s" })] })).toEqual({ kind: "degraded", reason: "Degraded", since: "s", container: null });
    expect(attentionFor({ agent: { containers: [running], activeJob: null, lastFinishedAt: null }, states: [state({})] })).toBeNull();
  });
});

describe("toneFor", () => {
  it("maps attention to a tone", () => {
    expect(toneFor({ kind: "deploying", jobId: "j", phase: null, startedAt: null, sha: "a" }, true)).toBe("live");
    expect(toneFor({ kind: "down", reason: "", since: "", container: null }, true)).toBe("err");
    expect(toneFor({ kind: "degraded", reason: "", since: "", container: null }, true)).toBe("warn");
    expect(toneFor(null, true)).toBe("ok");
    expect(toneFor(null, false)).toBe("idle");
  });
});

describe("rankFleet", () => {
  const row = (name: string, attention: FleetRow["attention"]): FleetRow => ({
    projectId: name,
    name,
    slug: name,
    domain: null,
    composeProject: null,
    serviceId: null,
    tone: "ok",
    uptime: [],
    containers: null,
    lastDeploy: null,
    attention,
  });

  it("orders deploying, down, degraded, then the rest by name", () => {
    const ranked = rankFleet([
      row("Tools", null),
      row("MewBit", { kind: "degraded", reason: "", since: "", container: null }),
      row("AtlasHub", null),
      row("Portfolio", { kind: "down", reason: "", since: "", container: null }),
      row("Drive", { kind: "deploying", jobId: "j", phase: null, startedAt: null, sha: "a" }),
    ]);
    expect(ranked.map((item) => item.name)).toEqual(["Drive", "Portfolio", "MewBit", "AtlasHub", "Tools"]);
  });
});
```

- [ ] **Step 3: Run them** — `npx vitest run src/server/overview` — Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `phases.ts`**

```ts
import type { DeployPhase } from "./types";

export const DEPLOY_PHASES: DeployPhase[] = ["fetch", "config", "build", "start", "health"];

/** Agent step labels (agent/src/pipeline.ts, agent/src/git.ts) grouped into the phases the UI shows. */
const RULES: Array<[RegExp, DeployPhase]> = [
  [/^(Rollback do |Przywracanie )/, "rollback"],
  [/^(Aktualny commit|Sprawdzenie lokalnych zmian|Git )/, "fetch"],
  [/^(Compose config|Sieć edge|Walidacja Compose|Zapis )/, "config"],
  [/^Build$/, "build"],
  [/^Uruchomienie$/, "start"],
  [/^Bramka zdrowia$/, "health"],
];

export function deployPhase(step: string | null | undefined): DeployPhase | null {
  if (!step) return null;
  return RULES.find(([pattern]) => pattern.test(step))?.[1] ?? null;
}
```

- [ ] **Step 5: Implement `uptime.ts`**

```ts
import type { MonitorIncident } from "@/server/atlashub/monitor";
import type { HourBucket } from "./types";

const HOUR_MS = 60 * 60 * 1000;

type IncidentSpan = Pick<MonitorIncident, "project_id" | "severity" | "started_at" | "ended_at">;

/** Hour buckets (oldest first) coloured by the project's incidents; derived from incidents, not raw checks. */
export function hourlyUptime(incidents: IncidentSpan[], projectId: string, monitored: boolean, now: Date, hours = 24): HourBucket[] {
  const currentHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const own = incidents.filter((incident) => incident.project_id === projectId);
  return Array.from({ length: hours }, (_, index) => {
    const start = currentHour - (hours - 1 - index) * HOUR_MS;
    const end = start + HOUR_MS;
    if (!monitored) return { start: new Date(start).toISOString(), state: "none" };
    let state: HourBucket["state"] = "ok";
    for (const incident of own) {
      const from = Date.parse(incident.started_at);
      const to = incident.ended_at ? Date.parse(incident.ended_at) : now.getTime();
      if (from < end && to >= start) {
        if (incident.severity === "down") {
          state = "down";
          break;
        }
        state = "warn";
      }
    }
    return { start: new Date(start).toISOString(), state };
  });
}
```

- [ ] **Step 6: Implement `fleet.ts`**

```ts
import type { ProjectStatus } from "@agent/types";
import type { Tone } from "@/lib/tone";
import type { TargetState } from "@/server/monitoring/types";
import { deployPhase } from "./phases";
import type { Attention, FleetRow } from "./types";

export function attentionFor({ agent, states }: { agent: ProjectStatus | null; states: TargetState[] }): Attention | null {
  const job = agent?.activeJob;
  if (job) return { kind: "deploying", jobId: job.id, phase: deployPhase(job.step), startedAt: job.startedAt, sha: job.sha };

  const failing = states.find((target) => target.status === "down") ?? states.find((target) => target.status === "warning");
  if (!failing) return null;

  const stopped = agent?.containers.find((container) => container.status !== "running");
  return {
    kind: failing.status === "down" ? "down" : "degraded",
    reason: failing.lastError ?? (failing.status === "down" ? "Down" : "Degraded"),
    since: failing.since,
    container: stopped ? { name: stopped.name, service: stopped.service, status: stopped.status, exitCode: stopped.exitCode } : null,
  };
}

export function toneFor(attention: Attention | null, monitored: boolean): Tone {
  if (attention?.kind === "deploying") return "live";
  if (attention?.kind === "down") return "err";
  if (attention?.kind === "degraded") return "warn";
  return monitored ? "ok" : "idle";
}

const WEIGHT: Record<Attention["kind"] | "none", number> = { deploying: 0, down: 1, degraded: 2, none: 3 };

export function rankFleet(rows: FleetRow[]): FleetRow[] {
  return [...rows].sort((a, b) => WEIGHT[a.attention?.kind ?? "none"] - WEIGHT[b.attention?.kind ?? "none"] || a.name.localeCompare(b.name));
}
```

- [ ] **Step 7: Run the tests** — `npx vitest run src/server/overview` — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/overview
git commit -m "feat: fleet ranking, attention and uptime buckets for the overview"
```

---

### Task 14: Activity, tasks and overview assembly

**Files:**
- Create: `src/server/overview/activity.ts`, `activity.test.ts`, `tasks.ts`, `tasks.test.ts`, `assemble.ts`, `assemble.test.ts`
- Modify: `src/server/overview/types.ts` (append)

**Interfaces:**
- Consumes: Task 13 exports; `Project`, `Service`, `Deploy`, `AuditLog`, `WorkItem` from `@/types`; `GeneralTodo` from `@/server/atlashub/general-todos` (type); `DeploymentConfig` (type); `PiMetrics` from `@/server/pi/metrics` (type); `AgentStatus` from `@agent/types`.
- Produces (append to `types.ts`): `ActivityItem { id; at; tone: Tone; title; detail: string | null; href: string | null }`; `Task { id; source: "todo" | "work_item"; projectId: string | null; title; status: "open" | "in_progress" | "blocked" | "done"; priority: "low" | "medium" | "high" | "critical"; dueDate: string | null; updatedAt: string }`; `HostSummary { hostname; cpu: number; memory: number; disk: number; temperature: number | null }`; `Overview { generatedAt; domains: { up: number; total: number; checkedAt: string | null }; incidents: { open: number; newest: { label: string; since: string } | null }; deploys7d: { total: number; failed: number }; host: HostSummary | null; fleet: FleetRow[]; activity: ActivityItem[]; tasksDue: Task[] }`; `OverviewInputs { projects; services; configs: Pick<DeploymentConfig, "projectId" | "composeProject" | "tunnel">[]; states: TargetState[]; incidents: MonitorIncident[]; deploys: Deploy[]; audit: AuditLog[]; todos: GeneralTodo[]; workItems: WorkItem[]; agent: AgentStatus | null; host: Pick<PiMetrics, "hostname" | "cpu" | "memory" | "disk" | "temperature"> | null }`.
- Produces functions: `mergeActivity(input: Pick<OverviewInputs, "deploys" | "services" | "projects" | "audit" | "incidents">, limit?: number): ActivityItem[]`; `toTasks(todos: GeneralTodo[], workItems: WorkItem[]): Task[]`; `tasksDue(tasks: Task[], now: Date, limit?: number): Task[]`; `assembleOverview(inputs: OverviewInputs, now: Date): Overview`.

- [ ] **Step 1: Append to `types.ts`**

```ts
import type { AgentStatus } from "@agent/types";
import type { GeneralTodo } from "@/server/atlashub/general-todos";
import type { MonitorIncident } from "@/server/atlashub/monitor";
import type { DeploymentConfig } from "@/server/deployments/config";
import type { TargetState } from "@/server/monitoring/types";
import type { PiMetrics } from "@/server/pi/metrics";
import type { AuditLog, Deploy, Project, Service, WorkItem } from "@/types";

export interface ActivityItem {
  id: string;
  at: string;
  tone: Tone;
  title: string;
  detail: string | null;
  href: string | null;
}

export interface Task {
  id: string;
  source: "todo" | "work_item";
  projectId: string | null;
  title: string;
  status: "open" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "critical";
  dueDate: string | null;
  updatedAt: string;
}

export interface HostSummary {
  hostname: string;
  cpu: number;
  memory: number;
  disk: number;
  temperature: number | null;
}

export interface Overview {
  generatedAt: string;
  domains: { up: number; total: number; checkedAt: string | null };
  incidents: { open: number; newest: { label: string; since: string } | null };
  deploys7d: { total: number; failed: number };
  host: HostSummary | null;
  fleet: FleetRow[];
  activity: ActivityItem[];
  tasksDue: Task[];
}

export interface OverviewInputs {
  projects: Project[];
  services: Service[];
  configs: Array<Pick<DeploymentConfig, "projectId" | "composeProject" | "tunnel">>;
  states: TargetState[];
  incidents: MonitorIncident[];
  deploys: Deploy[];
  audit: AuditLog[];
  todos: GeneralTodo[];
  workItems: WorkItem[];
  agent: AgentStatus | null;
  host: Pick<PiMetrics, "hostname" | "cpu" | "memory" | "disk" | "temperature"> | null;
}
```

Move these imports to the top of the file next to the existing ones.

- [ ] **Step 2: Write the failing tests**

`tasks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { GeneralTodo } from "@/server/atlashub/general-todos";
import type { WorkItem } from "@/types";
import { tasksDue, toTasks } from "./tasks";

const todo = (partial: Partial<GeneralTodo>): GeneralTodo => ({
  id: "t",
  title: "Todo",
  description: null,
  priority: "medium",
  status: "pending",
  due_date: null,
  completed_at: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  ...partial,
});

const item = (partial: Partial<WorkItem>): WorkItem => ({
  id: "w",
  project_id: "p",
  type: "todo",
  title: "Item",
  description: null,
  status: "open",
  priority: "medium",
  labels: [],
  github_issue_number: null,
  github_pr_number: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-12T00:00:00.000Z",
  ...partial,
});

describe("toTasks", () => {
  it("maps both sources onto one shape", () => {
    const tasks = toTasks([todo({ id: "t1", status: "completed", due_date: "2026-09-20" })], [item({ id: "w1", status: "blocked" })]);
    expect(tasks).toEqual([
      { id: "todo:t1", source: "todo", projectId: null, title: "Todo", status: "done", priority: "medium", dueDate: "2026-09-20", updatedAt: "2026-09-10T00:00:00.000Z" },
      { id: "work_item:w1", source: "work_item", projectId: "p", title: "Item", status: "blocked", priority: "medium", dueDate: null, updatedAt: "2026-09-12T00:00:00.000Z" },
    ]);
  });
});

describe("tasksDue", () => {
  const now = new Date("2026-09-17T12:00:00.000Z");

  it("lists overdue, then due within three days, then blocked; skips done and far-off tasks", () => {
    const tasks = toTasks(
      [
        todo({ id: "soon", due_date: "2026-09-19" }),
        todo({ id: "late", due_date: "2026-09-15" }),
        todo({ id: "later", due_date: "2026-10-30" }),
        todo({ id: "done", due_date: "2026-09-10", status: "completed" }),
        todo({ id: "undated" }),
      ],
      [item({ id: "blocked", status: "blocked" })]
    );
    expect(tasksDue(tasks, now).map((task) => task.id)).toEqual(["todo:late", "todo:soon", "work_item:blocked"]);
  });

  it("respects the limit", () => {
    const tasks = toTasks([todo({ id: "a", due_date: "2026-09-16" }), todo({ id: "b", due_date: "2026-09-17" })], []);
    expect(tasksDue(tasks, now, 1)).toHaveLength(1);
  });
});
```

`activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mergeActivity } from "./activity";

const projects = [{ id: "p1", name: "Drive" }] as never[];
const services = [{ id: "s1", project_id: "p1", name: "web" }] as never[];

describe("mergeActivity", () => {
  it("merges deploys, incidents and notable audit entries newest first", () => {
    const items = mergeActivity({
      projects,
      services,
      deploys: [
        { id: "d1", service_id: "s1", started_at: "2026-09-17T12:00:00.000Z", finished_at: null, status: "running", commit_sha: "7e1f0aa1234", logs_object_key: null, triggered_by: "github-webhook", error_message: null },
        { id: "d2", service_id: "s1", started_at: "2026-09-17T09:00:00.000Z", finished_at: "x", status: "failed", commit_sha: "4c5d6e7890", logs_object_key: null, triggered_by: "me", error_message: "Health check failed" },
      ],
      incidents: [
        { id: "i1", target_key: "domain:drive", kind: "domain", label: "drive.marczelloo.dev", project_id: "p1", severity: "down", reason: "502", open: false, started_at: "2026-09-17T10:00:00.000Z", ended_at: "2026-09-17T10:20:00.000Z" },
      ],
      audit: [
        { id: "a1", at: "2026-09-17T11:00:00.000Z", actor_email: "me", action: "restart", entity_type: "service", entity_id: "s1", meta_json: { name: "web" } },
        { id: "a2", at: "2026-09-17T11:30:00.000Z", actor_email: "me", action: "login", entity_type: "project", entity_id: null, meta_json: null },
        { id: "a3", at: "2026-09-17T11:40:00.000Z", actor_email: "me", action: "deploy", entity_type: "project", entity_id: "p1", meta_json: null },
      ],
    } as never);

    expect(items.map((entry) => [entry.id, entry.tone, entry.title])).toEqual([
      ["deploy:d1", "live", "Deploying · Drive"],
      ["audit:a1", "idle", "Restart · web"],
      ["incident:i1:end", "ok", "drive.marczelloo.dev recovered"],
      ["incident:i1", "err", "drive.marczelloo.dev down"],
      ["deploy:d2", "err", "Deploy failed · Drive"],
    ]);
    expect(items[0]).toMatchObject({ detail: "7e1f0aa", href: "/projects/p1?tab=deployments" });
    expect(items.at(-1)?.detail).toBe("4c5d6e7 · Health check failed");
  });

  it("limits the list", () => {
    const deploys = Array.from({ length: 12 }, (_, index) => ({ id: `d${index}`, service_id: "s1", started_at: `2026-09-17T0${index % 10}:00:00.000Z`, finished_at: "x", status: "success", commit_sha: null, logs_object_key: null, triggered_by: "me", error_message: null }));
    expect(mergeActivity({ projects, services, deploys, incidents: [], audit: [] } as never, 8)).toHaveLength(8);
  });
});
```

`assemble.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assembleOverview } from "./assemble";
import type { OverviewInputs } from "./types";

const now = new Date("2026-09-17T12:00:00.000Z");

const inputs = (): OverviewInputs => ({
  projects: [
    { id: "p1", name: "Drive", slug: "drive", status: "active", prod_url: "https://drive.marczelloo.dev" },
    { id: "p2", name: "Tools", slug: "tools", status: "active", prod_url: null },
    { id: "p3", name: "Old", slug: "old", status: "archived", prod_url: null },
  ] as never,
  services: [{ id: "s1", project_id: "p1", type: "docker", compose_project: "drive" }, { id: "s2", project_id: "p2", type: "docker", compose_project: null }] as never,
  configs: [{ projectId: "p2", composeProject: "tools", tunnel: { hostname: "tools.marczelloo.dev" } }] as never,
  states: [
    { key: "domain:drive.marczelloo.dev", kind: "domain", label: "drive.marczelloo.dev", projectId: "p1", status: "ok", failCount: 0, since: "s", lastCheckedAt: "2026-09-17T11:59:00.000Z", lastError: null, detail: {} },
    { key: "domain:tools.marczelloo.dev", kind: "domain", label: "tools.marczelloo.dev", projectId: "p2", status: "down", failCount: 2, since: "2026-09-17T11:40:00.000Z", lastCheckedAt: "2026-09-17T11:59:30.000Z", lastError: "502", detail: {} },
  ],
  incidents: [{ id: "i1", target_key: "domain:tools.marczelloo.dev", kind: "domain", label: "tools.marczelloo.dev", project_id: "p2", severity: "down", reason: "502", open: true, started_at: "2026-09-17T11:40:00.000Z", ended_at: null }],
  deploys: [
    { id: "d1", service_id: "s1", started_at: "2026-09-17T11:00:00.000Z", finished_at: "x", status: "success", commit_sha: "abc1234", logs_object_key: null, triggered_by: "me", error_message: null },
    { id: "d0", service_id: "s1", started_at: "2026-09-01T11:00:00.000Z", finished_at: "x", status: "failed", commit_sha: "old", logs_object_key: null, triggered_by: "me", error_message: null },
  ] as never,
  audit: [],
  todos: [],
  workItems: [],
  agent: {
    generatedAt: "now",
    projects: { drive: { containers: [{ name: "drive-web-1", service: "web", status: "running", exitCode: 0, restartCount: 0, health: null, oomKilled: false, startedAt: null, finishedAt: null }], activeJob: { id: "j", kind: "deploy", status: "running", step: "Build", sha: "def5678", startedAt: "t" }, lastFinishedAt: null } },
    disk: null,
    buildCacheBytes: null,
  },
  host: { hostname: "raspberrypi", cpu: { usage: 23 } as never, memory: { usagePercent: 61 } as never, disk: { usagePercent: 48 } as never, temperature: 52 },
});

describe("assembleOverview", () => {
  it("summarises domains, incidents, deploys and host", () => {
    const overview = assembleOverview(inputs(), now);
    expect(overview.domains).toEqual({ up: 1, total: 2, checkedAt: "2026-09-17T11:59:30.000Z" });
    expect(overview.incidents).toEqual({ open: 1, newest: { label: "tools.marczelloo.dev", since: "2026-09-17T11:40:00.000Z" } });
    expect(overview.deploys7d).toEqual({ total: 1, failed: 0 });
    expect(overview.host).toEqual({ hostname: "raspberrypi", cpu: 23, memory: 61, disk: 48, temperature: 52 });
  });

  it("builds ranked fleet rows without archived projects", () => {
    const fleet = assembleOverview(inputs(), now).fleet;
    expect(fleet.map((row) => [row.name, row.tone, row.attention?.kind ?? null])).toEqual([
      ["Drive", "live", "deploying"],
      ["Tools", "err", "down"],
    ]);
    expect(fleet[0]).toMatchObject({ domain: "drive.marczelloo.dev", composeProject: "drive", serviceId: "s1", containers: { running: 1, total: 1 }, lastDeploy: { at: "2026-09-17T11:00:00.000Z", sha: "abc1234", status: "success" } });
    expect(fleet[1]).toMatchObject({ domain: "tools.marczelloo.dev", composeProject: "tools", serviceId: "s2", containers: null });
    expect(fleet[1].uptime.at(-1)?.state).toBe("down");
  });
});
```

- [ ] **Step 3: Run them** — `npx vitest run src/server/overview` — Expected: new files FAIL (modules missing), Task 13 tests still PASS.

- [ ] **Step 4: Implement `tasks.ts`**

```ts
import type { GeneralTodo } from "@/server/atlashub/general-todos";
import type { WorkItem } from "@/types";
import type { Task } from "./types";

const TODO_STATUS: Record<GeneralTodo["status"], Task["status"]> = { pending: "open", in_progress: "in_progress", completed: "done" };
const DAY_MS = 24 * 60 * 60 * 1000;
const SOON_DAYS = 3;

export function toTasks(todos: GeneralTodo[], workItems: WorkItem[]): Task[] {
  return [
    ...todos.map((todo): Task => ({ id: `todo:${todo.id}`, source: "todo", projectId: null, title: todo.title, status: TODO_STATUS[todo.status], priority: todo.priority, dueDate: todo.due_date, updatedAt: todo.updated_at })),
    ...workItems.map((item): Task => ({ id: `work_item:${item.id}`, source: "work_item", projectId: item.project_id, title: item.title, status: item.status, priority: item.priority, dueDate: null, updatedAt: item.updated_at })),
  ];
}

/** Overdue first (earliest due), then due within three days, then blocked (most recently touched). */
export function tasksDue(tasks: Task[], now: Date, limit = 5): Task[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const bucket = (task: Task): number | null => {
    if (task.status === "done") return null;
    if (task.dueDate) {
      const due = Date.parse(task.dueDate.slice(0, 10));
      if (due < today) return 0;
      if (due <= today + SOON_DAYS * DAY_MS) return 1;
    }
    return task.status === "blocked" ? 2 : null;
  };
  return tasks
    .map((task) => ({ task, rank: bucket(task) }))
    .filter((entry): entry is { task: Task; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || (a.task.dueDate ?? "").localeCompare(b.task.dueDate ?? "") || b.task.updatedAt.localeCompare(a.task.updatedAt))
    .slice(0, limit)
    .map((entry) => entry.task);
}
```

- [ ] **Step 5: Implement `activity.ts`**

```ts
import type { Tone } from "@/lib/tone";
import type { AuditAction, DeployStatus } from "@/types";
import type { ActivityItem, OverviewInputs } from "./types";

const DEPLOY: Record<DeployStatus, { tone: Tone; verb: string }> = {
  pending: { tone: "live", verb: "Deploy queued" },
  running: { tone: "live", verb: "Deploying" },
  success: { tone: "ok", verb: "Deployed" },
  failed: { tone: "err", verb: "Deploy failed" },
  cancelled: { tone: "idle", verb: "Deploy cancelled" },
};

/** Audit actions worth showing next to deploys; deploys themselves come from the deploys table. */
const AUDIT_ACTIONS = new Set<AuditAction>(["restart", "stop", "start", "rollback", "delete", "create", "link", "unlink", "import"]);

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function mergeActivity(input: Pick<OverviewInputs, "deploys" | "services" | "projects" | "audit" | "incidents">, limit = 8): ActivityItem[] {
  const projectName = new Map(input.projects.map((project) => [project.id, project.name]));
  const serviceProject = new Map(input.services.map((service) => [service.id, service.project_id]));
  const items: ActivityItem[] = [];

  for (const deploy of input.deploys) {
    const projectId = serviceProject.get(deploy.service_id) ?? null;
    const { tone, verb } = DEPLOY[deploy.status];
    const sha = deploy.commit_sha?.slice(0, 7) ?? null;
    const detail = [sha, deploy.status === "failed" ? deploy.error_message : null].filter(Boolean).join(" · ") || null;
    items.push({
      id: `deploy:${deploy.id}`,
      at: deploy.started_at,
      tone,
      title: `${verb} · ${(projectId && projectName.get(projectId)) ?? "Unknown project"}`,
      detail,
      href: projectId ? `/projects/${projectId}?tab=deployments` : null,
    });
  }

  for (const incident of input.incidents) {
    const href = incident.project_id ? `/projects/${incident.project_id}` : "/monitoring";
    items.push({
      id: `incident:${incident.id}`,
      at: incident.started_at,
      tone: incident.severity === "down" ? "err" : "warn",
      title: `${incident.label} ${incident.severity === "down" ? "down" : "degraded"}`,
      detail: incident.reason,
      href,
    });
    if (incident.ended_at) items.push({ id: `incident:${incident.id}:end`, at: incident.ended_at, tone: "ok", title: `${incident.label} recovered`, detail: null, href });
  }

  for (const entry of input.audit) {
    if (!AUDIT_ACTIONS.has(entry.action)) continue;
    const name = typeof entry.meta_json?.name === "string" ? entry.meta_json.name : entry.entity_type;
    items.push({ id: `audit:${entry.id}`, at: entry.at, tone: "idle", title: `${capitalize(entry.action)} · ${name}`, detail: null, href: null });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
```

- [ ] **Step 6: Implement `assemble.ts`**

```ts
import { hostOf } from "@/server/monitoring/targets";
import { mergeActivity } from "./activity";
import { attentionFor, rankFleet, toneFor } from "./fleet";
import { tasksDue, toTasks } from "./tasks";
import type { FleetRow, Overview, OverviewInputs } from "./types";
import { hourlyUptime } from "./uptime";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function assembleOverview(inputs: OverviewInputs, now: Date): Overview {
  const configByProject = new Map(inputs.configs.map((config) => [config.projectId, config]));

  const domains = inputs.states.filter((state) => state.kind === "domain");
  const checkedAt = domains.reduce<string | null>((latest, state) => (state.lastCheckedAt && (!latest || state.lastCheckedAt > latest) ? state.lastCheckedAt : latest), null);

  const open = inputs.incidents.filter((incident) => incident.open).sort((a, b) => b.started_at.localeCompare(a.started_at));

  const weekAgo = now.getTime() - WEEK_MS;
  const recent = inputs.deploys.filter((deploy) => Date.parse(deploy.started_at) >= weekAgo);

  const fleet: FleetRow[] = inputs.projects
    .filter((project) => project.status !== "archived")
    .map((project) => {
      const config = configByProject.get(project.id);
      const services = inputs.services.filter((service) => service.project_id === project.id);
      const docker = services.find((service) => service.type === "docker" && service.compose_project) ?? services.find((service) => service.type === "docker") ?? null;
      const composeProject = config?.composeProject ?? docker?.compose_project ?? null;
      const agent = composeProject ? inputs.agent?.projects[composeProject] ?? null : null;
      const states = inputs.states.filter((state) => state.projectId === project.id);
      const monitored = states.length > 0;
      const attention = attentionFor({ agent, states });
      const serviceIds = new Set(services.map((service) => service.id));
      const last = inputs.deploys.filter((deploy) => serviceIds.has(deploy.service_id)).sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
      return {
        projectId: project.id,
        name: project.name,
        slug: project.slug,
        domain: config?.tunnel?.hostname ?? hostOf(project.prod_url),
        composeProject,
        serviceId: docker?.id ?? null,
        tone: toneFor(attention, monitored),
        uptime: hourlyUptime(inputs.incidents, project.id, monitored, now),
        containers: agent ? { running: agent.containers.filter((container) => container.status === "running").length, total: agent.containers.length } : null,
        lastDeploy: last ? { at: last.started_at, sha: last.commit_sha, status: last.status } : null,
        attention,
      };
    });

  return {
    generatedAt: now.toISOString(),
    domains: { up: domains.filter((state) => state.status === "ok" || state.status === "warning").length, total: domains.length, checkedAt },
    incidents: { open: open.length, newest: open[0] ? { label: open[0].label, since: open[0].started_at } : null },
    deploys7d: { total: recent.length, failed: recent.filter((deploy) => deploy.status === "failed").length },
    host: inputs.host
      ? { hostname: inputs.host.hostname, cpu: inputs.host.cpu.usage, memory: inputs.host.memory.usagePercent, disk: inputs.host.disk.usagePercent, temperature: inputs.host.temperature }
      : null,
    fleet: rankFleet(fleet),
    activity: mergeActivity(inputs),
    tasksDue: tasksDue(toTasks(inputs.todos, inputs.workItems), now),
  };
}
```

`hostOf` is exported from `src/server/monitoring/targets.ts` and has no server-only imports, so it is safe here.

- [ ] **Step 7: Run the tests** — `npx vitest run src/server/overview` — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/overview
git commit -m "feat: overview activity feed, due tasks and assembly"
```

---

### Task 15: Overview data access, demo data and API

**Files:**
- Create: `src/server/overview/sources.ts`, `src/server/overview/demo.ts`, `src/server/overview/index.ts`, `src/app/api/overview/route.ts`

**Interfaces:**
- Consumes: `assembleOverview`, `OverviewInputs` (Task 14); `ttlCache` (Task 6); data layer `@/server/data`; `listDeploymentConfigs`; `monitor.listStates`, `monitor.listRecentIncidents`; `getAgentStatus`, `getAgentHost`, `isAgentConfigured`; `toPiMetrics`; mock data from `@/lib/mock-data`.
- Produces: `loadDatabaseInputs(): Promise<Omit<OverviewInputs, "agent" | "host">>`; `loadLiveInputs(): Promise<Pick<OverviewInputs, "agent" | "host">>`; `demoOverviewInputs(now: Date): OverviewInputs`; `getOverview(): Promise<Overview>`; `GET /api/overview` → `{ success: true, data: Overview }` or `{ success: false, error }`.

- [ ] **Step 1: Implement `sources.ts`**

```ts
import "server-only";

import { getAgentHost, getAgentStatus, isAgentConfigured } from "@/server/agent/client";
import * as monitor from "@/server/atlashub/monitor";
import { auditLogs, deploys, generalTodos, projects, services, workItems } from "@/server/data";
import { listDeploymentConfigs } from "@/server/deployments/config";
import { toPiMetrics } from "@/server/pi/metrics";
import type { OverviewInputs } from "./types";

/** Nine AtlasHub reads; cached for 30 s by the caller. */
export async function loadDatabaseInputs(): Promise<Omit<OverviewInputs, "agent" | "host">> {
  const [allProjects, allServices, configs, states, incidents, recentDeploys, audit, todos, items] = await Promise.all([
    projects.getProjects({ limit: 1000 }),
    services.getServices({ limit: 1000 }),
    listDeploymentConfigs(),
    monitor.listStates(),
    monitor.listRecentIncidents(100),
    deploys.getRecentDeploys(100),
    auditLogs.getRecentAuditLogs(30),
    generalTodos.getActiveTodos(),
    workItems.getOpenWorkItems(),
  ]);
  return {
    projects: allProjects,
    services: allServices,
    configs: configs.map(({ projectId, composeProject, tunnel }) => ({ projectId, composeProject, tunnel })),
    states,
    incidents,
    deploys: recentDeploys,
    audit,
    todos,
    workItems: items,
  };
}

/** Agent reads do not touch AtlasHub; a failing agent leaves the rest of the overview intact. */
export async function loadLiveInputs(): Promise<Pick<OverviewInputs, "agent" | "host">> {
  if (!isAgentConfigured()) return { agent: null, host: null };
  const [agent, host] = await Promise.all([getAgentStatus().catch(() => null), getAgentHost().then(toPiMetrics).catch(() => null)]);
  return { agent, host };
}
```

- [ ] **Step 2: Implement `demo.ts`**

```ts
import "server-only";

import type { ProjectStatus } from "@agent/types";
import { mockAuditLogs, mockDeploys, mockGeneralTodos, mockPiMetrics, mockProjects, mockServices, mockWorkItems } from "@/lib/mock-data";
import type { MonitorIncident } from "@/server/atlashub/monitor";
import type { TargetState } from "@/server/monitoring/types";
import type { OverviewInputs } from "./types";

const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

/**
 * Simulated live state for the public demo: the project with a running mock
 * deploy is mid-build, and the next docker project has a stopped container.
 */
export function demoOverviewInputs(now: Date): OverviewInputs {
  const docker = mockServices.filter((service) => service.type === "docker" && service.project_id);
  const composeOf = (projectId: string) => docker.find((service) => service.project_id === projectId)?.compose_project ?? mockProjects.find((project) => project.id === projectId)?.slug ?? projectId;

  const runningDeploy = mockDeploys.find((deploy) => deploy.status === "running");
  const deployingProject = runningDeploy ? mockServices.find((service) => service.id === runningDeploy.service_id)?.project_id ?? null : null;
  const degradedProject = docker.map((service) => service.project_id!).find((projectId) => projectId !== deployingProject) ?? null;

  const agentProjects: Record<string, ProjectStatus> = {};
  for (const service of docker) {
    const projectId = service.project_id!;
    const running = { name: `${composeOf(projectId)}-${service.name}-1`, service: service.name, status: "running", exitCode: 0, restartCount: 0, health: null, oomKilled: false, startedAt: null, finishedAt: null };
    const containers = projectId === degradedProject ? [running, { ...running, name: `${composeOf(projectId)}-api-1`, service: "api", status: "exited", exitCode: 137 }] : [running];
    agentProjects[composeOf(projectId)] = {
      containers,
      activeJob: projectId === deployingProject && runningDeploy ? { id: "demo-job", kind: "deploy", status: "running", step: "Build", sha: runningDeploy.commit_sha ?? "0000000", startedAt: runningDeploy.started_at } : null,
      lastFinishedAt: null,
    };
  }

  const states: TargetState[] = mockProjects
    .filter((project) => project.prod_url)
    .map((project) => ({
      key: `domain:${new URL(project.prod_url!).hostname}`,
      kind: "domain",
      label: new URL(project.prod_url!).hostname,
      projectId: project.id,
      status: "ok",
      failCount: 0,
      since: minutesAgo(now, 3 * 24 * 60),
      lastCheckedAt: minutesAgo(now, 0.2),
      lastError: null,
      detail: {},
    }));
  if (degradedProject) {
    states.push({ key: `containers:${composeOf(degradedProject)}`, kind: "containers", label: composeOf(degradedProject), projectId: degradedProject, status: "warning", failCount: 1, since: minutesAgo(now, 14), lastCheckedAt: minutesAgo(now, 0.5), lastError: "api exited (137)", detail: {} });
  }

  const incidents: MonitorIncident[] = degradedProject
    ? [{ id: "demo-incident", target_key: `containers:${composeOf(degradedProject)}`, kind: "containers", label: composeOf(degradedProject), project_id: degradedProject, severity: "warning", reason: "api exited (137)", open: true, started_at: minutesAgo(now, 14), ended_at: null }]
    : [];

  return {
    projects: mockProjects,
    services: mockServices,
    configs: [],
    states,
    incidents,
    deploys: mockDeploys,
    audit: mockAuditLogs,
    todos: mockGeneralTodos,
    workItems: mockWorkItems,
    agent: { generatedAt: now.toISOString(), projects: agentProjects, disk: null, buildCacheBytes: null },
    host: mockPiMetrics,
  };
}
```

- [ ] **Step 3: Implement `index.ts`**

```ts
import "server-only";

import { isDemoMode } from "@/lib/demo-mode";
import { ttlCache } from "@/server/lib/ttl-cache";
import { assembleOverview } from "./assemble";
import { demoOverviewInputs } from "./demo";
import { loadDatabaseInputs, loadLiveInputs } from "./sources";
import type { Overview } from "./types";

const databaseInputs = ttlCache(30_000, loadDatabaseInputs);
const liveInputs = ttlCache(5_000, loadLiveInputs);

export async function getOverview(): Promise<Overview> {
  const now = new Date();
  if (isDemoMode()) return assembleOverview(demoOverviewInputs(now), now);
  const [database, live] = await Promise.all([databaseInputs(), liveInputs()]);
  return assembleOverview({ ...database, ...live }, now);
}

export type { Overview } from "./types";
```

- [ ] **Step 4: Implement `src/app/api/overview/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getCurrentUser, isAllowedUser } from "@/server/lib/auth";
import { getOverview } from "@/server/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAllowedUser())) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: true, data: await getOverview() });
  } catch (error) {
    console.error("[overview] Failed to build overview:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load overview" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`, `npm test`.
Expected: pass. With `npm run dev:demo`, `curl http://localhost:3100/api/overview` returns `success: true`, a fleet whose first row has `attention.kind` `"deploying"` with `phase` `"build"`, a degraded row with a stopped `api` container, host metrics, activity and tasks.

- [ ] **Step 6: Commit**

```bash
git add src/server/overview src/app/api/overview
git commit -m "feat: cached overview aggregate with demo data and API route"
```

---

### Task 16: Overview UI

**Files:**
- Create (all in `src/app/(dashboard)/_overview/`): `use-overview.ts`, `status-bar.tsx`, `fleet-table.tsx`, `fleet-row.tsx`, `attention-detail.tsx`, `activity-list.tsx`, `tasks-due.tsx`, `overview-view.tsx`
- Modify: `src/app/(dashboard)/page.tsx` (replace)
- Move: `src/app/(dashboard)/dashboard/_components/deploy-logs-button.tsx` → `src/components/features/deploy-logs-button.tsx` (update its import in `src/app/(dashboard)/projects/[id]/_components/project-detail-tabs.tsx`)
- Delete: the rest of `src/app/(dashboard)/dashboard/` once `git grep -n "dashboard/_components" -- src` is empty

**Interfaces:**
- Consumes: `Overview`, `FleetRow`, `Attention`, `ActivityItem`, `Task` (Tasks 13–14), `DEPLOY_PHASES` (Task 13), `getOverview` (Task 15), UI primitives (Tasks 3–5), `usePinGuard` (Task 11), `deployProjectAction`, `PageHeader`/`PageBody` (Task 10), `formatRelativeTime` from `@/lib/utils`.
- Produces: `useOverview(initial: Overview | null): Overview | null`; `OverviewView({ initial: Overview | null })`.

- [ ] **Step 1: `use-overview.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import type { Overview } from "@/server/overview/types";

const POLL_MS = 15_000;

/** Refreshes the overview every 15 s while the tab is visible, and immediately when it becomes visible. */
export function useOverview(initial: Overview | null): Overview | null {
  const [overview, setOverview] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/overview", { cache: "no-store" });
        const result = (await response.json()) as { success: boolean; data?: Overview };
        if (!cancelled && result.success && result.data) setOverview(result.data);
      } catch {
        // Keep showing the last good overview.
      }
    };
    const interval = setInterval(refresh, POLL_MS);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return overview;
}
```

- [ ] **Step 2: `status-bar.tsx`**

```tsx
import { Meter } from "@/components/ui/meter";
import { Panel } from "@/components/ui/card";
import { StatusDot } from "@/components/status-dot";
import { formatRelativeTime } from "@/lib/utils";
import type { Overview } from "@/server/overview/types";

function Segment({ label, children, detail, dot }: { label: string; children: React.ReactNode; detail?: string; dot?: React.ReactNode }) {
  return (
    <div className="min-w-0 px-[18px] py-3.5">
      <p className="flex items-center gap-2 text-[11.5px] text-fg-3">
        {dot}
        {label}
      </p>
      <div className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{children}</div>
      {detail && <p className="mt-0.5 truncate text-[11.5px] text-fg-3">{detail}</p>}
    </div>
  );
}

export function StatusBar({ overview }: { overview: Overview }) {
  const { domains, incidents, deploys7d, host } = overview;
  const allUp = domains.total > 0 && domains.up === domains.total;
  return (
    <Panel className="grid grid-cols-2 divide-line-subtle md:grid-cols-[1.1fr_1fr_1fr_1.6fr] md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line-subtle md:[&>*:nth-child(n+3)]:border-t-0">
      <Segment
        label="Domains"
        dot={<StatusDot status={domains.total === 0 ? "idle" : allUp ? "ok" : "err"} size="sm" />}
        detail={domains.checkedAt ? `checked ${formatRelativeTime(domains.checkedAt)}` : "not checked yet"}
      >
        {domains.up}
        <span className="text-[13px] font-medium tracking-normal text-fg-4"> / {domains.total} up</span>
      </Segment>
      <Segment label="Incidents" detail={incidents.newest ? `${incidents.newest.label} · ${formatRelativeTime(incidents.newest.since)}` : "none open"}>
        <span className={incidents.open > 0 ? "text-err" : undefined}>{incidents.open}</span>
      </Segment>
      <Segment label="Deploys · 7 days" detail={deploys7d.failed ? `${deploys7d.failed} failed` : "no failures"}>
        {deploys7d.total}
      </Segment>
      <div className="col-span-2 min-w-0 px-[18px] py-3.5 md:col-span-1">
        <p className="truncate text-[11.5px] text-fg-3">Host{host ? ` · ${host.hostname}` : ""}</p>
        {host ? (
          <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Meter label="CPU" value={host.cpu} />
            <Meter label="RAM" value={host.memory} />
            <Meter label="Disk" value={host.disk} tone={host.disk >= 85 ? "warn" : "neutral"} />
            {host.temperature !== null && <Meter label="Temp" value={Math.min(100, (host.temperature / 85) * 100)} display={`${Math.round(host.temperature)}°`} tone={host.temperature >= 70 ? "warn" : "neutral"} />}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-fg-3">Agent unavailable</p>
        )}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 3: `attention-detail.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Check, FileText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { usePinGuard } from "@/components/features/use-pin-guard";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/status-dot";
import { cn, formatRelativeTime } from "@/lib/utils";
import { DEPLOY_PHASES } from "@/server/overview/phases";
import type { DeployPhase, FleetRow } from "@/server/overview/types";

const PHASE_LABEL: Record<DeployPhase, string> = { fetch: "Fetch", config: "Config", build: "Build", start: "Start", health: "Health", rollback: "Rolling back" };

function Elapsed({ since }: { since: string | null }) {
  if (!since) return null;
  return <span className="font-mono text-xs text-fg-3">started {formatRelativeTime(since)}</span>;
}

export function AttentionDetail({ row }: { row: FleetRow }) {
  const guard = usePinGuard();
  const attention = row.attention;
  if (!attention) return null;

  if (attention.kind === "deploying") {
    const current = attention.phase === "rollback" ? -1 : attention.phase ? DEPLOY_PHASES.indexOf(attention.phase) : -1;
    const progress = attention.phase === "rollback" ? 100 : current < 0 ? 8 : ((current + 0.5) / DEPLOY_PHASES.length) * 100;
    return (
      <div className="pb-3.5 pl-[31px] pr-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {attention.phase === "rollback" ? (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-warn/30 bg-warn/10 px-2 text-xs text-warn">
              <RotateCcw className="size-3" strokeWidth={1.75} /> Rolling back
            </span>
          ) : (
            DEPLOY_PHASES.map((phase, index) => (
              <span key={phase} className="flex items-center gap-1.5">
                {index > 0 && <span aria-hidden className="h-px w-2.5 bg-line-strong" />}
                <span
                  className={cn(
                    "inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-xs",
                    index < current && "border-line text-fg-2",
                    index === current && "border-accent/40 bg-accent/10 text-white",
                    index > current && "border-line-subtle text-fg-4"
                  )}
                >
                  {index < current && <Check className="size-3 text-ok" strokeWidth={2} />}
                  {index === current && <StatusDot status="live" size="sm" />}
                  {PHASE_LABEL[phase]}
                </span>
              </span>
            ))
          )}
          <span className="ml-auto flex items-center gap-3">
            <code className="text-xs text-fg-2">{attention.sha.slice(0, 7)}</code>
            <Elapsed since={attention.startedAt} />
          </span>
        </div>
        <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/[.06]">
          <div className="h-full rounded-full bg-accent shadow-[0_0_12px_rgb(var(--accent)/.7)] transition-[width] duration-1000 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  const restart = async () => {
    if (!row.serviceId) return;
    const result = await guard.run(async () => {
      const response = await fetch(`/api/services/${row.serviceId}/restart`, { method: "POST" });
      return (await response.json()) as { success: boolean; error?: string; requirePin?: boolean; message?: string };
    });
    if (!result) return;
    if (result.success) toast.success(`Restarting ${row.name}`, { description: result.message });
    else toast.error(`Could not restart ${row.name}`, { description: result.error });
  };

  return (
    <div className="flex flex-wrap items-end gap-x-7 gap-y-3 pb-3.5 pl-[31px] pr-3.5">
      {attention.container && (
        <div className="text-[11.5px] text-fg-3">
          Container
          <code className="mt-0.5 block text-[13px] text-fg">{attention.container.name}</code>
        </div>
      )}
      <div className="min-w-0 text-[11.5px] text-fg-3">
        {attention.kind === "down" ? "Failing" : "Degraded"}
        <span className="mt-0.5 block truncate text-[13px] font-medium text-fg">{attention.reason}</span>
      </div>
      <div className="text-[11.5px] text-fg-3">
        Since
        <span className="mt-0.5 block font-mono text-[13px] text-fg">{formatRelativeTime(attention.since)}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {row.serviceId && (
          <Button size="sm" onClick={() => void restart()}>
            <RotateCcw strokeWidth={1.75} />
            Restart {attention.container?.service ?? row.name}
          </Button>
        )}
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/projects/${row.projectId}?tab=deployments`}>
            <FileText strokeWidth={1.75} />
            Logs
          </Link>
        </Button>
      </div>
      {guard.dialog}
    </div>
  );
}
```

- [ ] **Step 4: `fleet-row.tsx`**

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, FileText, Rocket } from "lucide-react";
import { toast } from "sonner";
import { deployProjectAction } from "@/app/actions/projects";
import { usePinGuard } from "@/components/features/use-pin-guard";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { UptimeStrip } from "@/components/ui/uptime-strip";
import { StatusDot } from "@/components/status-dot";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { FleetRow as Row } from "@/server/overview/types";
import { AttentionDetail } from "./attention-detail";

const EDGE = { deploying: "before:bg-accent bg-[linear-gradient(90deg,rgb(var(--accent)/.06),transparent_55%)]", down: "before:bg-err bg-[linear-gradient(90deg,rgb(var(--err)/.06),transparent_55%)]", degraded: "before:bg-warn bg-[linear-gradient(90deg,rgb(var(--warn)/.05),transparent_55%)]" } as const;

export const FLEET_COLUMNS = "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(170px,1.3fr)_minmax(140px,1.3fr)_90px_minmax(120px,1fr)_160px]";

/** `enterDelay` staggers rows on the first render of the table only (30 ms per row, capped at 8). */
export function FleetRow({ row, enterDelay = 0 }: { row: Row; enterDelay?: number }) {
  const guard = usePinGuard();
  const attention = row.attention;

  const deploy = async () => {
    const result = await guard.run(() => deployProjectAction(row.projectId));
    if (!result) return;
    if (result.success) toast.success(`Deploying ${row.name}`, { description: "It will rise to the top while it runs." });
    else toast.error(`Could not deploy ${row.name}`, { description: result.error });
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: enterDelay, ease: [0.16, 1, 0.3, 1], layout: { duration: 0.42, ease: [0.65, 0, 0.35, 1] } }}
      className={cn(
        "group relative border-t border-line-subtle transition-colors duration-quick hover:bg-white/[.022]",
        attention && ["before:absolute before:inset-y-0 before:left-0 before:w-0.5", EDGE[attention.kind]]
      )}
    >
      <div className={cn("grid min-h-[52px] items-center gap-4 px-3.5", FLEET_COLUMNS)}>
        <Link href={`/projects/${row.projectId}`} className="flex min-w-0 items-center gap-2.5 rounded-sm">
          <StatusDot status={row.tone} label={attention ? attention.kind : row.tone === "idle" ? "not monitored" : "healthy"} />
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-medium text-fg">{row.name}</span>
            <span className="block truncate font-mono text-[11.5px] text-fg-3">{row.domain ?? "no domain"}</span>
          </span>
        </Link>
        <UptimeStrip buckets={row.uptime} className="hidden md:flex" />
        <div className="hidden md:block">
          {row.containers ? (
            <Chip tone={row.containers.running < row.containers.total ? "warn" : "neutral"}>
              {row.containers.running} / {row.containers.total}
            </Chip>
          ) : (
            <span className="text-xs text-fg-4">—</span>
          )}
        </div>
        <div className="hidden truncate text-[12.5px] text-fg-3 md:block">
          {attention?.kind === "deploying" ? (
            <span className="text-[#ff9fa2]">deploying…</span>
          ) : row.lastDeploy ? (
            <>
              {formatRelativeTime(row.lastDeploy.at)}
              {row.lastDeploy.sha && <code className="ml-1.5 text-fg-2">{row.lastDeploy.sha.slice(0, 7)}</code>}
            </>
          ) : (
            "never"
          )}
        </div>
        <div className={cn("flex justify-end gap-1.5 transition-[opacity,transform] duration-base ease-out md:translate-x-1.5 md:opacity-0 md:group-focus-within:translate-x-0 md:group-focus-within:opacity-100 md:group-hover:translate-x-0 md:group-hover:opacity-100", attention && "md:translate-x-0 md:opacity-100")}>
          {attention?.kind === "deploying" ? (
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/projects/${row.projectId}?tab=deployments`}>
                <FileText strokeWidth={1.75} />
                Live logs
              </Link>
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => void deploy()} aria-label={`Deploy ${row.name}`}>
                <Rocket strokeWidth={1.75} />
                <span className="hidden sm:inline">Deploy</span>
              </Button>
              {row.domain && (
                <Button size="icon-sm" variant="ghost" asChild>
                  <a href={`https://${row.domain}`} target="_blank" rel="noreferrer" aria-label={`Open ${row.domain}`}>
                    <ExternalLink strokeWidth={1.75} />
                  </a>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <div className={cn("grid transition-[grid-template-rows] duration-panel ease-out", attention ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className={cn("transition-[opacity,transform] duration-base ease-out", attention ? "translate-y-0 opacity-100 delay-75" : "-translate-y-1 opacity-0")}>
            <AttentionDetail row={row} />
          </div>
        </div>
      </div>
      {guard.dialog}
    </motion.div>
  );
}
```

- [ ] **Step 5: `fleet-table.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Overview } from "@/server/overview/types";
import { FLEET_COLUMNS, FleetRow } from "./fleet-row";

type Filter = "all" | "issues";

export function FleetTable({ overview }: { overview: Overview }) {
  const [filter, setFilter] = useState<Filter>("all");
  const issues = overview.fleet.filter((row) => row.attention);
  const rows = filter === "issues" ? issues : overview.fleet;
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-3.5 py-3">
        <h2 className="text-[13.5px] font-semibold">Projects</h2>
        <SegmentedControl
          aria-label="Filter projects"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: overview.fleet.length },
            { value: "issues", label: "Issues", count: issues.length },
          ]}
        />
      </div>
      <div className={cn("hidden min-h-[34px] items-center gap-4 px-3.5 text-[11px] font-medium text-fg-4 md:grid", FLEET_COLUMNS)}>
        <span>Project</span>
        <span>Uptime · 24 h</span>
        <span>Containers</span>
        <span>Last deploy</span>
        <span />
      </div>
      {issues.length === 0 && overview.fleet.length > 0 && (
        <div className="flex min-h-[44px] items-center gap-2.5 border-t border-line-subtle px-3.5 text-[13px] text-fg-2">
          <StatusDot status="ok" />
          <span>
            <span className="font-medium text-fg">All systems normal</span> · {overview.domains.up} domains up
          </span>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={filter === "issues" ? "Nothing needs attention" : "No projects yet"}
          description={filter === "issues" ? "Deploying or failing projects appear here." : "Create a project to deploy it from GitHub."}
          action={filter === "all" ? <Button size="sm" variant="secondary" asChild><Link href="/projects/new">New project</Link></Button> : undefined}
          className="border-t border-line-subtle"
        />
      ) : (
        <LayoutGroup>
          {rows.map((row, index) => (
            <FleetRow key={row.projectId} row={row} enterDelay={firstRender.current ? Math.min(index, 8) * 0.03 : 0} />
          ))}
        </LayoutGroup>
      )}
    </Panel>
  );
}
```

- [ ] **Step 6: `activity-list.tsx` and `tasks-due.tsx`**

`activity-list.tsx`:

```tsx
import Link from "next/link";
import { Activity } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusDot } from "@/components/status-dot";
import { formatRelativeTime } from "@/lib/utils";
import type { ActivityItem } from "@/server/overview/types";

export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-line-subtle px-3.5 py-3">
        <h2 className="text-[13.5px] font-semibold">Activity</h2>
        <Link href="/audit-log" className="text-xs text-fg-3 hover:text-fg">Audit log</Link>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" description="Deploys, incidents and restarts show up here." />
      ) : (
        <ul className="divide-y divide-line-subtle px-3.5">
          {items.map((item) => {
            const body = (
              <>
                <StatusDot status={item.tone} className="mt-1.5" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-fg">{item.title}</span>
                  {item.detail && <span className="block truncate font-mono text-xs text-fg-3">{item.detail}</span>}
                </span>
                <time dateTime={item.at} className="mt-0.5 whitespace-nowrap font-mono text-[11.5px] text-fg-4">{formatRelativeTime(item.at)}</time>
              </>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link href={item.href} className="-mx-1.5 grid grid-cols-[16px_1fr_auto] items-start gap-2.5 rounded-sm px-1.5 py-2.5 transition-colors duration-quick hover:bg-white/[.03]">{body}</Link>
                ) : (
                  <div className="grid grid-cols-[16px_1fr_auto] items-start gap-2.5 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
```

`tasks-due.tsx`:

```tsx
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { Task } from "@/server/overview/types";

const PRIORITY_TONE = { low: "idle", medium: "neutral", high: "warn", critical: "err" } as const;

export function TasksDue({ tasks, now }: { tasks: Task[]; now: string }) {
  const today = now.slice(0, 10);
  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-line-subtle px-3.5 py-3">
        <h2 className="text-[13.5px] font-semibold">Tasks due</h2>
        <Link href="/tasks" className="text-xs text-fg-3 hover:text-fg">All tasks</Link>
      </div>
      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="Nothing due" description="Overdue, soon-due and blocked tasks from every project land here." />
      ) : (
        <ul className="divide-y divide-line-subtle px-3.5">
          {tasks.map((task) => {
            const overdue = task.dueDate !== null && task.dueDate.slice(0, 10) < today;
            return (
              <li key={task.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-fg">{task.title}</span>
                  <span className={overdue ? "text-xs text-err" : "text-xs text-fg-3"}>
                    {task.status === "blocked" ? "Blocked" : task.dueDate ? `${overdue ? "Overdue · " : "Due "}${formatDate(task.dueDate)}` : "No due date"}
                  </span>
                </span>
                <Chip tone={PRIORITY_TONE[task.priority]}>{task.priority}</Chip>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
```

- [ ] **Step 7: `overview-view.tsx` and the page**

`overview-view.tsx`:

```tsx
"use client";

import { RefreshCw } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Overview } from "@/server/overview/types";
import { ActivityList } from "./activity-list";
import { FleetTable } from "./fleet-table";
import { StatusBar } from "./status-bar";
import { TasksDue } from "./tasks-due";
import { useOverview } from "./use-overview";

export function OverviewView({ initial }: { initial: Overview | null }) {
  const overview = useOverview(initial);
  return (
    <>
      <PageHeader title="Overview" />
      <PageBody className="flex flex-col gap-4">
        {overview ? (
          <>
            <StatusBar overview={overview} />
            <FleetTable overview={overview} />
            <div className="grid gap-4 lg:grid-cols-2">
              <ActivityList items={overview.activity} />
              <TasksDue tasks={overview.tasksDue} now={overview.generatedAt} />
            </div>
          </>
        ) : (
          <EmptyState
            icon={RefreshCw}
            title="Overview is unavailable"
            description="The database or the agent did not answer. The page retries every 15 seconds."
            action={<Button size="sm" variant="secondary" onClick={() => window.location.reload()}>Reload now</Button>}
          />
        )}
      </PageBody>
    </>
  );
}
```

Replace `src/app/(dashboard)/page.tsx`:

```tsx
import { getOverview } from "@/server/overview";
import { OverviewView } from "./_overview/overview-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const overview = await getOverview().catch((error) => {
    console.error("[overview] Initial load failed:", error);
    return null;
  });
  return <OverviewView initial={overview} />;
}
```

- [ ] **Step 8: Remove the old dashboard components**

```bash
git mv "src/app/(dashboard)/dashboard/_components/deploy-logs-button.tsx" src/components/features/deploy-logs-button.tsx
```

Update the import in `project-detail-tabs.tsx` to `@/components/features/deploy-logs-button`. Run `git grep -n "dashboard/_components" -- src`; expected: no output. Then `git rm -r "src/app/(dashboard)/dashboard"`.

- [ ] **Step 9: Verify**

Run: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
Expected: pass.
In `npm run dev:demo`:
- 1440 px, http://localhost:3100/: status bar in one panel; the deploying project first with Fetch/Config done, Build live and a glowing progress line; the degraded project second with container, reason and **Restart api**; the rest below with 24-hour strips; actions slide in on hover; Activity and Tasks due side by side.
- Switch the filter to Issues and back: rows animate into place (420 ms), no jump of the page below.
- 1024 px: rail sidebar, table still has all columns.
- 375 px: status bar 2 × 2 with host meters full width; rows show name, domain and actions only; attention details wrap.
- Emulate `prefers-reduced-motion: reduce`: no row movement, no pulsing dots.
- Keyboard: Tab reaches each row's link and its actions (actions become visible on focus).

- [ ] **Step 10: Commit**

```bash
git add -A src
git commit -m "feat: overview with status bar, attention-first fleet table, activity and due tasks"
```

---

### Task 17: Verify, review and merge phase 1–3

**Files:** none new.

- [ ] **Step 1: Full local check**

With `marczelloo-drive/` moved aside: `npm run typecheck && npm run lint && npm test && npm run build`. Expected: all pass. Move the folder back.

- [ ] **Step 2: Visual pass**

In `npm run dev:demo` capture 1440×900 and 375×812 screenshots of `/`, `/projects`, `/services`, `/host`, `/settings` into `.impeccable/review/phase3-desktop-*.png` and `phase3-mobile-*.png`. Check against `docs/brand/brandboard.html`: crimson only on active nav, primary actions, focus and live states; no horizontal scroll at 375 px; focus rings visible.

- [ ] **Step 3: Code review**

Review the branch diff against `main` (`git diff main...redesign --stat`, then file by file) for: token use instead of raw colours, no new per-widget AtlasHub reads, reduced-motion handling, demo mode blocks every mutation, English copy. Fix findings in one commit.

- [ ] **Step 4: Ship the agent change first**

```bash
git checkout main
git cherry-pick <sha of "feat(agent): report the running pipeline step…">
git push origin main
```

Wait for the dashboard deploy of that commit to finish, then on the Pi:

```bash
ssh -i ~/.ssh/nadstrona_pi_ed25519 Marczelloo_pi@192.168.100.12 "cd ~/projects/Marczelloo-dashboard/agent && git log --oneline -1 && docker compose build -q && docker compose up -d && sleep 15 && docker ps --filter name=marczelloo-agent --format '{{.Status}}'"
```

Expected: the agent commit is checked out and the container is `Up … (healthy)`.

- [ ] **Step 5: Merge the rest**

```bash
git checkout redesign
git rebase main
git checkout main
git merge --ff-only redesign
git push origin main
```

- [ ] **Step 6: Production checks**

- The dashboard deploy job succeeds; `https://dashboard.marczelloo.dev/` renders the new Overview; `/dashboard`, `/pi`, `/todos` redirect.
- `https://demo-dashboard.marczelloo.dev/` renders the Overview with the simulated deploy and degraded project.
- Trigger a deploy of a small project (e.g. Tools) and watch its row rise, show Fetch → Build → Health, then fold back.
- With the Overview open for 10 minutes, `docker logs marczelloo-dashboard --since 10m | grep -ci "429\|rate limit"` prints `0`.

- [ ] **Step 7: Record the state**

Update `docs/superpowers/specs/2026-09-17-dashboard-redesign-design.md` status line to "Phases 1–3 shipped (<date>)" and commit it with the next phase's work.

---

## Roadmap: phases 4–8

Each phase gets its own detailed plan (same format as above) once the previous phase is merged. Scope per spec sections 1, 7 and 8:

| Phase | Scope | Key units |
|---|---|---|
| 4 · Projects | Projects list in fleet-table style with All / Issues filter and search; project page header (status, domain, last deploy, Deploy, overflow menu); tabs `overview · deployments · environment · domains · github · code · tasks · settings` driven by `?tab=`; `/projects/[id]/edit` → `?tab=settings`; emoji maps replaced by Lucide/text | `projects/_components/*`, `projects/[id]/_components/project-header.tsx`, `project-tabs.tsx`, tab modules reusing existing GitHub/env/tunnel/deploy-engine components |
| 5 · Tasks | Unified Tasks page over `toTasks` (Task 14) with project, status and priority filters; create/edit for both sources; project Tasks tab; redirects `/projects/:id/work-items*` → `/tasks?…`; `/tasks` alias replaced | `src/server/tasks.ts` (`listTasks`), `tasks/_components/*`, actions wrapping todo and work-item actions |
| 6 · Infrastructure | Host page moved from `/pi` into `/host` on Meter/Panel; Containers, Services and Monitoring pages rebuilt on the primitives; monitoring incidents timeline uses `UptimeStrip` | `host/_components/*`, restyles of `containers`, `services`, `monitoring` |
| 7 · Activity & system | New `/deployments` page (`listDeployments` with project/status filters and cursor) and nav entry; Audit log restyle; Settings, Docs, Features restyled on primitives and translated to English | `src/server/deployments/list.ts`, `deployments/_components/*` |
| 8 · Finish | Impeccable finish review (desktop + mobile captures vs brandboard), fixes; `DESIGN.md` rewritten by the Impeccable documenter from the built app; `docs/brand/README.md` updated; `scripts/generate-brandboard.mjs` and `docs/brand/icon-inventory.json` removed; legacy colour aliases and legacy Button/Badge variants removed after `git grep` shows no users | — |

Mechanical page restyles in phases 6–7 are good candidates for Codex in an isolated worktree, reviewed before merge.
