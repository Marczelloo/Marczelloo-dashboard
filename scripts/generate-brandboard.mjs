import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as Lucide from "lucide-react";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const sourceRoot = path.join(root, "src");
const outputRoot = path.join(root, "docs", "brand");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const sourceFiles = walk(sourceRoot).filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file));
const sourcesByIcon = new Map();

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  const importPattern = /import\s*\{([^;]*?)\}\s*from\s*["']lucide-react["']\s*;/gs;
  for (const match of source.matchAll(importPattern)) {
    for (const rawPart of match[1].split(",")) {
      const normalized = rawPart.trim().replace(/^type\s+/, "").replace(/\s+as\s+\w+$/, "");
      if (!normalized || normalized === "LucideIcon") continue;
      const relativeSource = path.relative(root, file).replaceAll("\\", "/");
      const current = sourcesByIcon.get(normalized) ?? new Set();
      current.add(relativeSource);
      sourcesByIcon.set(normalized, current);
    }
  }
}

const lucideIcons = [...sourcesByIcon.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, sources]) => {
    const Icon = Lucide[name];
    if (!Icon) throw new Error(`Lucide export not found: ${name}`);
    const svg = renderToStaticMarkup(
      React.createElement(Icon, {
        width: 24,
        height: 24,
        strokeWidth: 2,
        "aria-hidden": "true",
        focusable: "false",
      }),
    );
    return { name, library: "Lucide", sources: [...sources].sort(), svg };
  });

const customIcons = [
  {
    name: "SiteIcon",
    library: "Local",
    sources: ["src/app/icon.svg"],
    svg: fs.readFileSync(path.join(root, "src", "app", "icon.svg"), "utf8").replace(/<svg\s/, '<svg aria-hidden="true" focusable="false" '),
  },
  {
    name: "ContainerGrid",
    library: "Local",
    sources: ["src/app/(dashboard)/dashboard/_components/quick-actions.tsx"],
    svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  },
  {
    name: "LoadingSpinner",
    library: "Local",
    sources: ["src/components/ui/button.tsx"],
    svg: '<svg class="spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><circle opacity=".25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path opacity=".75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647Z"/></svg>',
  },
];

const icons = [...lucideIcons, ...customIcons];
const lucideVersion = JSON.parse(fs.readFileSync(path.join(root, "node_modules", "lucide-react", "package.json"), "utf8")).version;
const generatedAt = new Date().toISOString();

const inventory = {
  generatedAt,
  scope: "Every icon component imported or defined by the application source. Data visualizations such as the Raspberry Pi progress gauge are excluded.",
  totals: { all: icons.length, lucide: lucideIcons.length, local: customIcons.length },
  libraries: { lucideReact: lucideVersion },
  rules: {
    grid: "24 × 24",
    defaultRenderedSize: "16px",
    strokeWidth: 2,
    color: "currentColor",
    defaultStyle: "outline",
  },
  icons: icons.map(({ name, library, sources }) => ({ name, library, sources })),
};

const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const iconCards = icons
  .map(
    ({ name, library, sources, svg }) => `
      <button class="icon-card" type="button" data-name="${name.toLowerCase()}" data-library="${library.toLowerCase()}" aria-label="Copy icon name ${escapeHtml(name)}" title="Used in ${sources.length} source file${sources.length === 1 ? "" : "s"}">
        <span class="icon-stage">${svg}</span>
        <span class="icon-name">${escapeHtml(name)}</span>
        <span class="icon-meta">${library} · ${sources.length} ${sources.length === 1 ? "file" : "files"}</span>
      </button>`,
  )
  .join("");

const colorTokens = [
  ["Console Black", "--background", "0 0% 4%"],
  ["Panel Charcoal", "--card", "0 0% 7%"],
  ["Raised Charcoal", "--popover", "0 0% 9%"],
  ["Control Graphite", "--secondary", "0 0% 12%"],
  ["Hairline Graphite", "--border", "0 0% 14%"],
  ["Muted Graphite", "--muted", "0 0% 15%"],
  ["Muted Silver", "--muted-foreground", "0 0% 60%"],
  ["Signal White", "--foreground", "0 0% 95%"],
  ["Crimson Action", "--primary", "0 72% 51%"],
  ["Operational Green", "--success", "142 71% 45%"],
  ["Attention Amber", "--warning", "38 92% 50%"],
  ["Failure Crimson", "--danger", "0 72% 51%"],
];

const swatches = colorTokens
  .map(
    ([name, token, value]) => `
      <article class="swatch">
        <div class="swatch-color" style="background:hsl(${value})"></div>
        <div class="swatch-copy"><strong>${name}</strong><code>${token}</code><span>hsl(${value})</span></div>
      </article>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Marczelloo Dashboard — Brandboard</title>
  <style>
    :root{--background:0 0% 4%;--foreground:0 0% 95%;--card:0 0% 7%;--card-foreground:0 0% 95%;--popover:0 0% 9%;--primary:0 72% 51%;--primary-foreground:0 0% 100%;--secondary:0 0% 12%;--muted:0 0% 15%;--muted-foreground:0 0% 60%;--border:0 0% 14%;--success:142 71% 45%;--warning:38 92% 50%;--danger:0 72% 51%;--radius:8px}
    *{box-sizing:border-box}
    html{scroll-behavior:smooth;background:hsl(var(--background))}
    body{margin:0;background:hsl(var(--background));color:hsl(var(--foreground));font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-feature-settings:"rlig" 1,"calt" 1;-webkit-font-smoothing:antialiased}
    button,input{font:inherit}a{color:inherit}.shell{display:grid;grid-template-columns:256px minmax(0,1fr);min-height:100vh}.rail{position:sticky;top:0;height:100vh;padding:20px 16px;border-right:1px solid hsl(var(--border)/.5);background:hsl(var(--card)/.95);backdrop-filter:blur(8px)}
    .brand{display:flex;align-items:center;gap:12px;padding:0 4px 20px;border-bottom:1px solid hsl(var(--border)/.5)}.mark{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/.8));box-shadow:0 8px 22px hsl(var(--primary)/.2);font-size:18px;font-weight:700;color:white}.wordmark{display:flex;flex-direction:column}.wordmark strong{font-size:16px;line-height:1.1;letter-spacing:-.025em}.wordmark small{margin-top:3px;color:hsl(var(--muted-foreground)/.6);font-size:10px;text-transform:uppercase;letter-spacing:.12em}
    .rail-label{margin:24px 12px 8px;color:hsl(var(--muted-foreground)/.7);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em}.rail nav{display:grid;gap:4px}.rail a{padding:9px 12px;border-radius:8px;color:hsl(var(--muted-foreground));font-size:13px;font-weight:500;text-decoration:none}.rail a:hover,.rail a:focus-visible{background:hsl(var(--secondary));color:hsl(var(--foreground));outline:none}.rail-note{position:absolute;right:16px;bottom:20px;left:16px;padding:12px;border:1px solid hsl(var(--border));border-radius:8px;background:hsl(var(--background)/.55);color:hsl(var(--muted-foreground));font-size:11px;line-height:1.55}.rail-note strong{display:block;margin-bottom:4px;color:hsl(var(--foreground));font-size:12px}
    main{min-width:0}.hero{position:relative;overflow:hidden;padding:72px clamp(28px,6vw,88px) 64px;border-bottom:1px solid hsl(var(--border))}.hero:after{content:"M";position:absolute;right:4vw;bottom:-.24em;color:hsl(var(--primary)/.045);font-size:min(36vw,480px);font-weight:800;line-height:1;pointer-events:none}.eyebrow{display:flex;align-items:center;gap:8px;margin:0 0 18px;color:hsl(var(--primary));font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.16em}.eyebrow:before{content:"";width:24px;height:1px;background:currentColor}.hero h1{max-width:780px;margin:0;font-size:clamp(42px,6vw,78px);line-height:.98;letter-spacing:-.055em}.hero h1 span{color:hsl(var(--primary))}.hero p{max-width:680px;margin:24px 0 0;color:hsl(var(--muted-foreground));font-size:16px;line-height:1.7}.hero-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:32px}.badge{display:inline-flex;align-items:center;gap:7px;padding:5px 10px;border:1px solid hsl(var(--border));border-radius:6px;background:hsl(var(--secondary));font-size:12px;font-weight:600}.dot{width:7px;height:7px;border-radius:50%;background:hsl(var(--success));box-shadow:0 0 8px hsl(var(--success)/.5)}
    section{padding:64px clamp(28px,6vw,88px);border-bottom:1px solid hsl(var(--border))}.section-head{display:grid;grid-template-columns:minmax(220px,.55fr) minmax(280px,1fr);gap:40px;margin-bottom:32px}.section-kicker{color:hsl(var(--primary));font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em}.section-head h2{margin:8px 0 0;font-size:28px;line-height:1.1;letter-spacing:-.035em}.section-head p{margin:0;max-width:620px;color:hsl(var(--muted-foreground));font-size:14px;line-height:1.65}
    .swatch-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.swatch{overflow:hidden;border:1px solid hsl(var(--border));border-radius:8px;background:hsl(var(--card));box-shadow:0 1px 3px rgb(0 0 0/.1)}.swatch-color{height:88px;border-bottom:1px solid hsl(var(--border))}.swatch-copy{display:grid;gap:5px;padding:14px}.swatch strong{font-size:13px}.swatch code,.swatch span{color:hsl(var(--muted-foreground));font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace}
    .type-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:16px}.panel{border:1px solid hsl(var(--border));border-radius:8px;background:hsl(var(--card));box-shadow:0 1px 3px rgb(0 0 0/.1)}.type-specimen{display:grid;gap:0;padding:8px 24px}.type-row{display:grid;grid-template-columns:112px 1fr;align-items:baseline;gap:24px;padding:22px 0;border-bottom:1px solid hsl(var(--border))}.type-row:last-child{border:0}.type-row code{color:hsl(var(--muted-foreground));font-size:11px}.headline-sample{font-size:20px;font-weight:600;letter-spacing:-.025em}.title-sample{font-size:18px;font-weight:600;line-height:1;letter-spacing:-.025em}.body-sample{font-size:14px;line-height:20px}.label-sample{font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}.mono-sample{font:12px/16px ui-monospace,SFMono-Regular,Menlo,monospace;color:hsl(var(--primary))}.rhythm{padding:24px}.rhythm h3,.components h3{margin:0 0 20px;font-size:14px}.space-row{display:flex;align-items:center;gap:12px;margin:12px 0;color:hsl(var(--muted-foreground));font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.space-block{height:12px;border-radius:3px;background:hsl(var(--primary)/.75)}
    .components{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.component-panel{padding:24px}.component-panel>small{display:block;margin-bottom:18px;color:hsl(var(--muted-foreground));font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.component-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px}.btn{display:inline-flex;height:36px;align-items:center;justify-content:center;gap:8px;padding:8px 16px;border-radius:6px;border:0;color:hsl(var(--foreground));font-size:14px;font-weight:500}.btn svg{width:16px;height:16px}.btn-primary{background:hsl(var(--primary));color:white;box-shadow:0 1px 3px rgb(0 0 0/.1)}.btn-outline{border:1px solid hsl(var(--border));background:transparent;box-shadow:0 1px 2px rgb(0 0 0/.05)}.btn-secondary{background:hsl(var(--secondary))}.btn-ghost{background:transparent}.field{height:36px;width:220px;padding:4px 12px;border:1px solid hsl(var(--border));border-radius:6px;background:hsl(var(--background));color:hsl(var(--foreground));outline:2px solid transparent;outline-offset:2px;box-shadow:0 1px 2px rgb(0 0 0/.05)}.field:focus{outline-color:hsl(var(--primary))}.status{padding:2px 10px;border-radius:6px;font-size:12px;font-weight:600}.status.success{background:hsl(var(--success)/.2);color:hsl(var(--success))}.status.warning{background:hsl(var(--warning)/.2);color:hsl(var(--warning))}.status.danger{background:hsl(var(--danger)/.2);color:hsl(var(--danger))}.mini-card{padding:18px;border:1px solid hsl(var(--border));border-radius:8px;background:hsl(var(--card));box-shadow:0 1px 3px rgb(0 0 0/.1)}.mini-card strong{display:block;font-size:14px}.mini-card span{display:block;margin-top:6px;color:hsl(var(--muted-foreground));font-size:12px}
    .icon-toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;margin:0 -12px 18px;padding:12px;border:1px solid hsl(var(--border));border-radius:8px;background:hsl(var(--background)/.88);backdrop-filter:blur(10px)}.search-wrap{position:relative;flex:1}.search-wrap svg{position:absolute;top:10px;left:11px;width:16px;height:16px;color:hsl(var(--muted-foreground))}.search{width:100%;height:36px;padding:4px 12px 4px 36px;border:1px solid hsl(var(--border));border-radius:6px;background:hsl(var(--card));color:hsl(var(--foreground));outline:none}.search:focus{box-shadow:0 0 0 2px hsl(var(--background)),0 0 0 4px hsl(var(--primary))}.count{white-space:nowrap;color:hsl(var(--muted-foreground));font:12px ui-monospace,SFMono-Regular,Menlo,monospace}.icon-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.icon-card{min-width:0;padding:18px 12px 14px;border:1px solid hsl(var(--border));border-radius:8px;background:hsl(var(--card));color:hsl(var(--foreground));text-align:left;cursor:pointer;transition:border-color .2s,background .2s,transform .2s}.icon-card:hover,.icon-card:focus-visible{border-color:hsl(var(--primary)/.45);background:hsl(var(--secondary));outline:none;transform:translateY(-1px)}.icon-stage{display:grid;place-items:center;width:40px;height:40px;margin-bottom:14px;border-radius:8px;background:hsl(var(--secondary));color:hsl(var(--foreground))}.icon-stage svg{width:20px;height:20px;stroke-linecap:round;stroke-linejoin:round}.icon-name{display:block;overflow:hidden;color:hsl(var(--foreground));font:500 12px/16px ui-monospace,SFMono-Regular,Menlo,monospace;text-overflow:ellipsis;white-space:nowrap}.icon-meta{display:block;margin-top:4px;color:hsl(var(--muted-foreground));font-size:10px}.icon-card.hidden{display:none}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
    .rules{display:grid;grid-template-columns:1fr 1fr;gap:16px}.rule{padding:24px}.rule h3{margin:0 0 16px;font-size:14px}.rule ul{display:grid;gap:12px;margin:0;padding:0;list-style:none}.rule li{position:relative;padding-left:20px;color:hsl(var(--muted-foreground));font-size:13px;line-height:1.55}.rule li:before{position:absolute;left:0;font-weight:700}.rule.do li:before{content:"+";color:hsl(var(--success))}.rule.dont li:before{content:"−";color:hsl(var(--danger))}.footer{display:flex;justify-content:space-between;gap:24px;padding:28px clamp(28px,6vw,88px);color:hsl(var(--muted-foreground));font-size:11px}.toast{position:fixed;right:20px;bottom:20px;padding:10px 14px;border:1px solid hsl(var(--border));border-radius:6px;background:hsl(var(--popover));box-shadow:0 16px 40px rgb(0 0 0/.35);font-size:12px;opacity:0;transform:translateY(8px);transition:.2s;pointer-events:none}.toast.show{opacity:1;transform:translateY(0)}
    @media(max-width:1100px){.swatch-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.icon-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
    @media(max-width:820px){.shell{display:block}.rail{position:relative;width:auto;height:auto;border-right:0;border-bottom:1px solid hsl(var(--border))}.rail nav,.rail-label,.rail-note{display:none}.brand{padding-bottom:0;border:0}.section-head,.type-grid{grid-template-columns:1fr}.swatch-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.components,.rules{grid-template-columns:1fr}.icon-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:520px){.hero,section{padding-right:20px;padding-left:20px}.hero{padding-top:48px}.swatch-grid,.icon-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.icon-toolbar{align-items:stretch;flex-direction:column}.type-row{grid-template-columns:1fr;gap:8px}.footer{padding-right:20px;padding-left:20px;flex-direction:column}}
    @media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
  </style>
</head>
<body>
  <div class="shell">
    <aside class="rail">
      <div class="brand"><div class="mark" aria-hidden="true">M</div><div class="wordmark"><strong>Marczelloo</strong><small>Dashboard</small></div></div>
      <p class="rail-label">Brandboard</p>
      <nav aria-label="Brandboard sections"><a href="#foundation">Foundation</a><a href="#type">Typography & rhythm</a><a href="#components">Components</a><a href="#icons">Iconography</a><a href="#rules">Usage rules</a></nav>
      <div class="rail-note"><strong>Documentation only</strong>This file mirrors the current product. It is not loaded by the application and changes no production styling.</div>
    </aside>
    <main>
      <header class="hero"><p class="eyebrow">Visual system inventory · 2026</p><h1>Crimson<br><span>Control Room</span></h1><p>Brandboard istniejącego Marczelloo Dashboard: kolory, typografia, rytm, komponenty i kompletny zestaw ikon faktycznie używanych przez aplikację.</p><div class="hero-meta"><span class="badge"><i class="dot"></i>Existing system</span><span class="badge">${lucideIcons.length} Lucide icons</span><span class="badge">${customIcons.length} local icons</span><span class="badge">No app changes</span></div></header>
      <section id="foundation"><div class="section-head"><div><span class="section-kicker">01 / FOUNDATION</span><h2>Color system</h2></div><p>Neutralne powierzchnie budują głębię, karmazyn prowadzi akcje, a kolory semantyczne opisują rzeczywisty stan systemu. Wartości są pobrane bezpośrednio z <code>globals.css</code>.</p></div><div class="swatch-grid">${swatches}</div></section>
      <section id="type"><div class="section-head"><div><span class="section-kicker">02 / TYPE & RHYTHM</span><h2>Operational hierarchy</h2></div><p>Inter/system UI utrzymuje czytelność i kompaktową gęstość. Monospace jest zarezerwowany dla danych maszynowych. Skala odstępów opiera się na kroku 4 px.</p></div><div class="type-grid"><div class="panel type-specimen"><div class="type-row"><code>20 / 600</code><span class="headline-sample">Deployment overview</span></div><div class="type-row"><code>18 / 600</code><span class="title-sample">Service status</span></div><div class="type-row"><code>14 / 400</code><span class="body-sample">Track projects, services and infrastructure from one control surface.</span></div><div class="type-row"><code>12 / 600</code><span class="label-sample">Infrastructure</span></div><div class="type-row"><code>12 / mono</code><span class="mono-sample">46a4a7b · port 3000 · /opt/dashboard</span></div></div><div class="panel rhythm"><h3>Spacing scale</h3>${[4,8,12,16,24,32].map((size)=>`<div class="space-row"><span>${String(size).padStart(2,"0")} px</span><i class="space-block" style="width:${size*2}px"></i></div>`).join("")}<h3 style="margin-top:30px">Shape scale</h3><div class="component-row"><span class="badge" style="border-radius:4px">4 px</span><span class="badge" style="border-radius:6px">6 px</span><span class="badge" style="border-radius:8px">8 px</span></div></div></div></section>
      <section id="components"><div class="section-head"><div><span class="section-kicker">03 / COMPONENTS</span><h2>Incumbent primitives</h2></div><p>Próbki odtwarzają warianty z <code>src/components/ui</code>. Nie są propozycją redesignu — dokumentują aktualne wymiary, kolory, promienie i stany.</p></div><div class="components"><div class="panel component-panel"><small>BUTTONS / DEFAULT, OUTLINE, SECONDARY, GHOST</small><div class="component-row"><button class="btn btn-primary">Deploy</button><button class="btn btn-outline">Refresh</button><button class="btn btn-secondary">Settings</button><button class="btn btn-ghost">Cancel</button></div></div><div class="panel component-panel"><small>INPUT / DEFAULT & FOCUS</small><div class="component-row"><input class="field" value="main" aria-label="Branch name"><input class="field" value="3000" aria-label="Port"></div></div><div class="panel component-panel"><small>BADGES / SEMANTIC STATES</small><div class="component-row"><span class="status success">Deployed</span><span class="status warning">Pending</span><span class="status danger">Failed</span><span class="badge">Secondary</span></div></div><div class="panel component-panel"><small>CARD / TONAL SURFACE</small><div class="mini-card"><strong>Dashboard runner</strong><span>Online · last deploy 2 minutes ago</span></div></div></div></section>
      <section id="icons"><div class="section-head"><div><span class="section-kicker">04 / ICONOGRAPHY</span><h2>Complete application set</h2></div><p>Pełny zestaw ${icons.length} ikon znalezionych w źródłach: ${lucideIcons.length} importów Lucide oraz ${customIcons.length} lokalne SVG. Kliknij kafelek, aby skopiować nazwę. Wykres kołowy Raspberry Pi jest wizualizacją danych, nie ikoną, dlatego nie należy do zestawu.</p></div><div class="icon-toolbar"><label class="search-wrap"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="icon-search" class="search" type="search" placeholder="Filter icons…" aria-label="Filter icons"></label><span id="icon-count" class="count">${icons.length} / ${icons.length}</span></div><div id="icon-grid" class="icon-grid">${iconCards}</div></section>
      <section id="rules"><div class="section-head"><div><span class="section-kicker">05 / GUARDRAILS</span><h2>Keep it consistent</h2></div><p>Te zasady wynikają z obecnego kodu i chronią system przed przypadkowym mieszaniem stylów. Pełna specyfikacja znajduje się w <code>DESIGN.md</code>.</p></div><div class="rules"><article class="panel rule do"><h3>Do</h3><ul><li>Use existing CSS tokens and UI primitives.</li><li>Render Lucide at 16 px with a 2 px stroke.</li><li>Combine status color with icon and text.</li><li>Keep spacing on the 4 px rhythm.</li></ul></article><article class="panel rule dont"><h3>Don’t</h3><ul><li>Introduce another brand accent.</li><li>Mix icon libraries on one surface.</li><li>Use emoji as interface icons.</li><li>Replace tonal depth with heavy shadows.</li></ul></article></div></section>
      <footer class="footer"><span>Marczelloo Dashboard visual inventory</span><span>Generated from source · Lucide ${lucideVersion} · ${generatedAt.slice(0,10)}</span></footer>
    </main>
  </div>
  <div id="toast" class="toast" role="status" aria-live="polite">Icon name copied</div>
  <script>
    const search=document.getElementById('icon-search');const cards=[...document.querySelectorAll('.icon-card')];const count=document.getElementById('icon-count');const toast=document.getElementById('toast');let timer;
    search.addEventListener('input',()=>{const query=search.value.trim().toLowerCase();let visible=0;cards.forEach(card=>{const match=card.dataset.name.includes(query)||card.dataset.library.includes(query);card.classList.toggle('hidden',!match);if(match)visible+=1});count.textContent=visible+' / '+cards.length});
    cards.forEach(card=>card.addEventListener('click',async()=>{const name=card.querySelector('.icon-name').textContent;try{await navigator.clipboard.writeText(name);toast.textContent=name+' copied'}catch{toast.textContent=name}toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),1400)}));
  </script>
</body>
</html>`;

fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, "icon-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
fs.writeFileSync(path.join(outputRoot, "brandboard.html"), html);

console.log(`Generated brandboard with ${icons.length} icons (${lucideIcons.length} Lucide + ${customIcons.length} local).`);
