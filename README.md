# remarkable-templates

A browser-based editor and viewer for reMarkable tablet `.template` files.

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
├── public/templates/ ← static .template files served to the browser
└── remarkable_official_templates/ ← unmodified device originals (git-ignored)
```

## Project status

### In progress
- **Dark mode** — fleshing out dark theme support; adding `background` and `foreground`
  sentinel constants so templates can declare their intended background color (fills the
  canvas) and default foreground stroke color (the default color a user draws with on that
  template). These drive the dark-mode rendering path.

### Planned — near term
- **Delete custom templates from the UI** — custom templates can be created and edited but
  not yet deleted through the interface.

### Planned — future
- **Device sync** — instructions and tooling for pulling/pushing templates to/from the
  reMarkable device, including:
  - Backup and rollback of device template states
  - Automation via SSH/SCP/rsync (exact tooling TBD once work begins)

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
| `RepeatValue` | `0` (once), `N` (exact), `"down"`, `"infinite"`, `"up"`, `"right"` |
| `TemplateRegistry` | List of `TemplateRegistryEntry` from `templates.json` |

### Device constants

| Device | Portrait W×H | `paperOriginX` (portrait) |
|--------|-------------|--------------------------|
| rm1, rm2 | 1404×1872 | −234 |
| rmPP (Paper Pro) | 954×1696 | −371 |

`paperOriginX = templateWidth/2 − templateHeight/2`

### Expression evaluation

Constants are a `{key: value}[]` array evaluated in declaration order — later entries may reference earlier ones. Device builtins are injected first. Expressions support arithmetic, comparisons, `&&`/`||`, and ternary (`a > b ? x : y`). Evaluation uses `Function()` after identifier substitution.

### Custom templates

New templates are created with a starter JSON containing common sentinel constants (`mobileMaxWidth`, `offsetX`, `offsetY`, `mobileOffsetY`) so that expressions referencing those names work immediately. Custom templates are stored in `localStorage` and their `.template` files are written to `public/templates/custom/`.

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
