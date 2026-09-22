# Marczelloo Dashboard brand

The dashboard's look is called **Obsidian Console**: near-black surfaces, one crimson accent, status in green, amber and red, Geist Sans and Geist Mono.

- `brandboard.html` — the brandboard the redesign was built from: colour tokens, type ramp, the Frame ring M mark, components and page patterns. It is hand-authored; open it in a browser.
- `DESIGN.md` (repository root) — the design system as built, recorded from the running app. When the board and the app disagree, the app and `DESIGN.md` win.
- `.impeccable/design.json` — machine-readable extensions of `DESIGN.md` for the Impeccable tooling.

Where the system lives in code:

- Tokens: `src/app/globals.css` (CSS variables) and `tailwind.config.ts` (Tailwind names: `canvas`, `surface`, `fg`–`fg-4`, `accent`, `ok`, `warn`, `err`, `line`).
- Components: `src/components/ui` (Button, Chip, Panel, SegmentedControl, Meter, Switch, …) and `src/components/layout` (shell, page header, form layout).
- Site mark: `src/app/icon.svg`; `src/app/apple-icon.png` is its 180 × 180 touch icon.
