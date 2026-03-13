# remarkable-templates

A browser-based editor and viewer for reMarkable tablet `.template` files.

**New here?** See the [Quickstart guide](docs/quickstart.md) to get up and running.

## Overview

reMarkable templates are JSON files that describe page layouts using a tree of groups, paths, and text items. Values throughout the tree can be numeric literals or arithmetic expression strings that reference named constants (e.g. `"templateWidth / 2 - offsetX"`). The device evaluates these at render time, injecting built-in constants like `templateWidth` and `templateHeight`.

This project lets you browse, preview, and edit those templates without a device.

## Project structure

```
remarkable_templates/
├── src/
│   ├── types/       ← template.ts, registry.ts
│   ├── lib/         ← expression.ts, parser.ts, registry.ts, renderer.ts, customTemplates.ts
│   ├── components/  ← TemplateCanvas.tsx, TemplateEditor.tsx
│   └── __tests__/   ← Vitest test suite
├── public/
│   └── templates/
│       ├── custom/  ← custom .template files + custom-registry.json (git-ignored)
│       └── ...      ← official .template files (git-ignored)
├── scripts/
│   └── merge-templates.mjs  ← merges official + custom into dist-deploy/
├── docs/
│   └── device-sync.md       ← SSH setup + deploy workflow
├── dist-deploy/     ← staging dir for device deployment (git-ignored)
├── remarkable_official_templates/ ← unmodified device originals (git-ignored)
└── Makefile         ← pull / backup / deploy / rollback targets
```

## Project status

### In progress
- **Dark mode** — fleshing out dark theme support; adding `background` and `foreground`
  sentinel constants so templates can declare their intended background color (fills the
  canvas) and default foreground stroke color (the default color a user draws with on that
  template). These drive the dark-mode rendering path.

## Device sync

```bash
make pull         # fetch current templates from device → remarkable_official_templates/
# edit templates in the web app
make deploy       # backup on device, merge, rsync, restart xochitl
make rollback     # restore most recent backup if something goes wrong
make list-backups # see all backups stored on the device
```

See [docs/device-sync.md](docs/device-sync.md) for SSH setup, prerequisites, and caveats.

## Web app

### Commands (run from project root)

```bash
pnpm dev           # start dev server
pnpm test          # run all tests once
pnpm test:watch    # watch mode
pnpm build         # tsc + vite build
pnpm lint          # ESLint
```

### Features

- **Template browser** — sidebar lists all built-in and custom templates, filterable by category
- **Multi-device preview** — toggle between reMarkable 1/2 (1404×1872) and Paper Pro (954×1696)
- **SVG canvas renderer** — faithfully renders groups, paths, and text items with full expression evaluation and tile repetition
- **Monaco editor** — full JSON editor with syntax highlighting for editing template files
- **Custom templates** — create new templates from scratch or fork existing ones; saves to `localStorage`
- **Expression validation** — catches undefined constant references at Apply time, before the canvas errors
- **Delete custom templates** — remove custom templates from the UI, clearing the file and registry entry

### Architecture

```
templates.json (registry)
  → parseRegistry()          [lib/registry.ts]

.template JSON file
  → parseTemplate()          [lib/parser.ts]       — validates + deserializes to RemarkableTemplate
  → collectMissingConstants() [lib/renderer.ts]     — validates all expression identifiers are defined
  → resolveConstants()       [lib/expression.ts]    — evaluates constants in order
  → TemplateCanvas           [components/]          — renders SVG
      → GroupView / PathView / TextView
          → computeTileRange()   [lib/renderer.ts]  — tile repetition grid
          → pathDataToSvgD()     [lib/renderer.ts]  — PathData tokens → SVG d string
```

### Key types

| Type | Description |
|------|-------------|
| `RemarkableTemplate` | Root object: name/author/orientation + `constants[]` + `items[]` |
| `TemplateItem` | Discriminated union: `GroupItem \| PathItem \| TextItem` |
| `ScalarValue` | `number \| string` — strings are arithmetic/ternary expressions |
| `PathData` | Flat token array: `["M", x, y, "L", x2, y2, "C", ...]` |
| `RepeatValue` | `0` (once), `N` (exact), `"down"`, `"up"`, `"right"`, `"infinite"`, or any expression string |
| `TemplateRegistry` | List of `TemplateRegistryEntry` from `templates.json` |

### Repeat values

| Value | Behaviour |
|-------|-----------|
| `0` | Render once at tile origin (no repeat) |
| `N` | Render exactly N tiles |
| `"down"` | Fill downward from tile origin to viewport bottom |
| `"up"` | Fill upward from tile origin to viewport top |
| `"right"` | Fill rightward from tile origin to viewport right edge |
| `"infinite"` | Fill in both directions to cover the full viewport |
| `"expr"` | Any constant expression resolving to a number (e.g. `"columns"`) |

### Device constants

| Device | Portrait W×H | Landscape W×H | `paperOriginX` (portrait) |
|--------|-------------|---------------|--------------------------|
| rm1, rm2 | 1404×1872 | 1872×1404 | −234 |
| rmPP (Paper Pro) | 954×1696 | 1696×954 | −371 |

`paperOriginX = templateWidth/2 − templateHeight/2`

Templates that behave differently on smaller screens use `mobileMaxWidth` (typically 1000 px) in ternary constant expressions to branch between layouts.

### Expression evaluation

Constants are a `{key: value}[]` array evaluated in declaration order — later entries may reference earlier ones. Device builtins are injected first. Expressions support arithmetic, comparisons, `&&`/`||`, and ternary (`a > b ? x : y`). Evaluation uses `Function()` after identifier substitution.

### Custom templates

New templates are created with a starter JSON containing common sentinel constants (`mobileMaxWidth`, `offsetX`, `offsetY`, `mobileOffsetY`) so that expressions referencing those names work immediately. Custom templates are stored in `localStorage` and their `.template` files are written to `public/templates/custom/`.

## Adding templates

1. Place the `.template` JSON file in `public/templates/`
2. Add a registry entry to `public/templates/templates.json`
3. The browser will pick it up on next page load — no rebuild required

## Template file format

```json
{
  "name": "My Template",
  "author": "Custom",
  "orientation": "portrait",
  "constants": [
    { "mobileMaxWidth": 1000 },
    { "offsetY": 100 }
  ],
  "items": [
    {
      "type": "group",
      "boundingBox": { "x": 0, "y": "offsetY", "width": "templateWidth", "height": 50 },
      "repeat": { "rows": "down" },
      "children": [
        {
          "type": "path",
          "data": ["M", 0, 0, "L", "templateWidth", 0],
          "strokeColor": "#000000",
          "strokeWidth": 1
        }
      ]
    }
  ]
}
```
