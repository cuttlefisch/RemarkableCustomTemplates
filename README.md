# remarkable-templates

[![CI](https://github.com/cuttlefisch/RemarkableCustomTemplates/actions/workflows/ci.yml/badge.svg)](https://github.com/cuttlefisch/RemarkableCustomTemplates/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen)](#)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-20%2B-brightgreen)](https://nodejs.org/)

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
│   ├── lib/         ← expression.ts, parser.ts, registry.ts, renderer.ts, customTemplates.ts, color.ts
│   ├── components/  ← TemplateCanvas.tsx, TemplateEditor.tsx
│   └── __tests__/   ← Vitest test suite
├── public/
│   └── templates/
│       ├── custom/  ← custom .template files + custom-registry.json (git-ignored)
│       ├── debug/   ← debug templates served in dev mode only
│       └── ...      ← official .template files (git-ignored)
├── scripts/
│   └── merge-templates.mjs  ← merges official + custom into dist-deploy/
├── docs/
│   ├── quickstart.md        ← clone-to-deploy walkthrough
│   └── device-sync.md       ← SSH setup + deploy workflow
├── .github/
│   ├── workflows/ci.yml     ← GitHub Actions: lint, type-check, test, build
│   └── CONTRIBUTING.md
├── dist-deploy/     ← staging dir for device deployment (git-ignored)
├── remarkable_official_templates/ ← unmodified device originals (git-ignored)
├── LICENSE
└── Makefile         ← pull / backup / deploy / rollback targets
```

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

- **Template browser** — sidebar lists all templates, filterable by category
- **Multi-device preview** — toggle between reMarkable 1/2 (1404×1872) and Paper Pro (954×1696)
- **SVG canvas renderer** — faithfully renders groups, paths, and text items with full expression evaluation and tile repetition
- **Monaco editor** — full JSON editor with syntax highlighting for editing template files
- **Custom templates** — create from scratch or fork any existing template; saved as `.template` files via the dev server API
- **Color defaults** — `foreground`/`background` sentinel constants set the canvas background color and default stroke color; the invert button swaps them (useful for previewing dark-paper or inverted themes)
- **Expression validation** — catches undefined constant references at Apply time, before the canvas errors
- **Delete custom templates** — remove custom templates from the UI, clearing the file and registry entry
- **Debug templates** — `public/templates/debug/` contains responsive developer templates served in dev mode; included when deploying

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

Templates that need to adapt layout across devices can use either approach:
- **Ternary branching** — `"templateWidth > mobileMaxWidth ? bigValue : smallValue"` (common in official templates)
- **Scale factors** — `{ "scaleX": "templateWidth / 1404" }`, then `{ "margin": "scaleX * 60" }` etc. (proportional scaling, fits all devices without branching)

### Expression evaluation

Constants are a `{key: value}[]` array evaluated in declaration order — later entries may reference earlier ones. Device builtins are injected first. Expressions support arithmetic, comparisons, `&&`/`||`, and ternary (`a > b ? x : y`). Evaluation uses `Function()` after identifier substitution.

### Custom templates

New templates are created with a starter JSON that includes `foreground`/`background` color constants and a full-page `bg` rectangle item, plus common layout sentinels (`mobileMaxWidth`, `offsetX`, `offsetY`, `mobileOffsetY`). Saving calls the dev server API, which writes `.template` files to `public/templates/custom/` and updates `custom-registry.json`.

**Forking official templates** — clicking **Save as New Template** on an official template does the following automatically before saving:

1. Any path `strokeColor: "#000000"` is replaced with the `foreground` sentinel.
2. Any path with no `strokeColor` defined gets `strokeColor: "foreground"` injected (the device renders undefined stroke as black, so this preserves the visual while making it invertible).
3. Any path `fillColor: "#000000"` is replaced with `foreground`. Paths with no `fillColor` are left alone (undefined fill = transparent on the device).
4. `foreground`/`background` constants are appended if absent, and the `bg` item is prepended if absent.

The result is a fully invertible custom template: hitting **Invert** swaps `foreground` ↔ `background` throughout.

## Adding templates

The primary workflow is through the web app: click **New template** in the sidebar to create one from scratch, or select any existing template and click **Save as New Template** to fork it. The dev server API handles file writes automatically.

To add a template manually (advanced):
1. Place the `.template` JSON file in `public/templates/custom/`
2. Add a registry entry to `public/templates/custom/custom-registry.json` with `"isCustom": true` and a `"custom/"` filename prefix
3. Restart the dev server to pick up the new file

## Template file format

```json
{
  "name": "My Template",
  "author": "Custom",
  "orientation": "portrait",
  "constants": [
    { "foreground": "#000000" },
    { "background": "#ffffff" },
    { "mobileMaxWidth": 1000 },
    { "offsetY": 100 }
  ],
  "items": [
    {
      "id": "bg",
      "type": "group",
      "boundingBox": { "x": 0, "y": 0, "width": "templateWidth", "height": "templateHeight" },
      "repeat": { "rows": "infinite", "columns": "infinite" },
      "children": [
        {
          "type": "path",
          "strokeColor": "background",
          "fillColor": "background",
          "antialiasing": false,
          "data": ["M", 0, 0, "L", "parentWidth", 0, "L", "parentWidth", "parentHeight", "L", 0, "parentHeight", "Z"]
        }
      ]
    },
    {
      "type": "group",
      "boundingBox": { "x": 0, "y": "offsetY", "width": "templateWidth", "height": 50 },
      "repeat": { "rows": "down" },
      "children": [
        {
          "type": "path",
          "data": ["M", 0, 0, "L", "templateWidth", 0],
          "strokeColor": "foreground",
          "strokeWidth": 1
        }
      ]
    }
  ]
}
```

The `foreground` and `background` constants are sentinel values recognized by the editor:

| Constant | Default | Role |
|----------|---------|------|
| `foreground` | `#000000` | Default stroke color; referenced by path items to stay invertible |
| `background` | `#ffffff` | Canvas fill color; referenced by the `bg` item |

The **Invert** button swaps their values, letting you preview any color scheme. The `bg` item (full-page filled rectangle referencing `background`) renders the canvas background color on the device. Omit both if your template is always light-on-white with no color customization needed.
