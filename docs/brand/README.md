# Marczelloo Dashboard brand assets

This directory documents the visual system already implemented by the application. It is not imported by the Next.js runtime and does not alter production styling.

- `brandboard.html` — standalone, searchable visual brandboard.
- `icon-inventory.json` — source-backed inventory of every icon component used by the application.

The production site mark lives at `src/app/icon.svg`; `src/app/apple-icon.png` is its generated 180 × 180 touch-icon variant.

Regenerate both artifacts after visual or icon changes:

```powershell
node scripts/generate-brandboard.mjs
```

The canonical written rules and token definitions live in the repository root at `DESIGN.md`. Machine-readable design extensions live at `.impeccable/design.json`.
