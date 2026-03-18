# remarkable-templates

[![CI](https://github.com/cuttlefisch/RemarkableCustomTemplates/actions/workflows/ci.yml/badge.svg)](https://github.com/cuttlefisch/RemarkableCustomTemplates/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-94%25-brightgreen)](#)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-20%2B-brightgreen)](https://nodejs.org/)

A browser-based tool for browsing, previewing, editing, and deploying custom page templates on reMarkable tablets. Create templates from scratch or fork existing ones, preview them across all device resolutions, and deploy to your device with cloud sync across paired tablets.

**New here?** See the [Quickstart guide](docs/quickstart.md) to get up and running.

## Overview

reMarkable templates are JSON files that describe page layouts using a tree of groups, paths, and text items. Values throughout the tree can be numeric literals or arithmetic expression strings that reference named constants (e.g. `"templateWidth / 2 - offsetX"`). The device evaluates these at render time, injecting built-in constants like `templateWidth` and `templateHeight`.

This project provides:

- **Web editor** — browse, preview, and edit templates with a live SVG canvas and Monaco JSON editor, with multi-device resolution switching (RM 1&2, Paper Pro, Paper Pro Move)
- **Deploy to device** — push templates via SSH in the rm_methods format so they sync across paired devices through the reMarkable cloud, with manifest-tracked deploys, automatic orphan cleanup, and one-command rollback
- **Backup/restore** — export and import your custom templates as a ZIP, preserving UUIDs for deploy continuity
- **Pull from device** — fetch official and custom rm_methods templates from your device to browse or fork into new designs

## Docker quickstart

```bash
git clone https://github.com/cuttlefisch/RemarkableCustomTemplates
cd remarkable_templates
docker compose up --build -d
```

Open `http://localhost:3000` in your browser. To set up device sync, navigate to the **Device & Sync** page — the SSH setup wizard handles key generation, connection testing, and device configuration in-browser.

To use a different port (e.g. if 3000 is taken): `PORT=3001 docker compose up --build -d`

Stop with `docker compose down`. Data (templates, device config, SSH keys) is stored in a Docker volume and persists across restarts. To start fresh, use `docker compose down -v` to remove the volume.

## Project structure

```
remarkable_templates/
├── server/
│   ├── index.ts         ← entry point (listen on PORT)
│   ├── app.ts           ← createApp() factory (testable via Fastify inject)
│   ├── config.ts        ← DATA_DIR-based path resolution
│   ├── routes/          ← API route handlers
│   │   └── device/      ← SSH device operations (config, pull, deploy, rollback)
│   ├── lib/             ← ssh.ts, sftp.ts, pathSecurity.ts, manifestUuids.ts, buildMethodsRegistry.ts
│   └── __tests__/       ← server tests
├── src/
│   ├── types/       ← template.ts, registry.ts
│   ├── lib/         ← expression.ts, parser.ts, registry.ts, renderer.ts, customTemplates.ts, color.ts,
│   │                   backup.ts, methodsTemplates.ts, rmMethods.ts, iconGenerator.ts
│   ├── components/  ← TemplateCanvas.tsx, TemplateEditor.tsx, NavBar.tsx, CanvasErrorBoundary.tsx
│   ├── pages/       ← TemplatesPage.tsx, DevicePage.tsx
│   ├── hooks/       ← useRegistry.ts
│   └── __tests__/   ← Vitest test suite
├── public/
│   └── templates/
│       ├── custom/  ← custom .template files + custom-registry.json (git-ignored)
│       ├── debug/   ← debug templates served in dev mode only
│       ├── methods/ ← rm_methods templates pulled from device (git-ignored)
│       └── ...      ← official .template files (git-ignored)
├── scripts/
│   └── merge-templates.mjs  ← merges official + custom into dist-deploy/
├── docs/
│   ├── quickstart.md        ← clone-to-deploy walkthrough
│   └── device-sync.md       ← SSH setup + deploy workflow
├── .github/
│   ├── workflows/ci.yml     ← GitHub Actions: lint, type-check, test, build
│   └── CONTRIBUTING.md
├── Dockerfile       ← multi-stage build (production)
├── docker-compose.yml ← single-service with volume mount
├── dist-deploy/     ← staging dir for classic device deployment (git-ignored)
├── rm-methods-dist/ ← staging dir for rm_methods deploy (git-ignored)
├── rm-methods-backups/ ← device backups + deployed manifest (git-ignored)
├── remarkable_official_templates/ ← unmodified device originals (git-ignored)
├── LICENSE
└── Makefile         ← pull / backup / deploy / rollback targets
```

## Device sync

For browser-based device operations (recommended), see the **Device & Sync** page at `/device`. The make targets below are the CLI alternative.

### rm_methods deploy (recommended — syncs across devices)

Deploys templates in the same format as official reMarkable methods content, so xochitl syncs them across paired devices via the cloud:

```bash
pnpm dev                        # dev server must be running
make build-rm-methods-dist      # export ZIP → rm-methods-dist/
make deploy-rm-methods          # back up, deploy, restart xochitl
make rollback-rm-methods        # revert to previous deploy
make rollback-rm-methods-original  # remove all custom templates
```

Deploys are tracked with a manifest file — removed templates are automatically cleaned up from the device, and rollbacks precisely restore previous state.

### Pull rm_methods templates from the device

```bash
make pull-rm-methods    # pull official + custom rm_methods templates to browse/fork
```

### Backup and restore

Click **↓ Backup** on the **Device & Sync** page to download a ZIP of all custom and debug templates (preserves `rmMethodsId` UUIDs). The filename includes a timestamp (e.g. `remarkable-backup-2026-03-17_143022.zip`). Click **↑ Restore** to merge a backup ZIP back in. See [docs/device-sync.md](docs/device-sync.md) for details.

### Classic deploy (alternative — no sync)

Pushes templates directly to `/usr/share/remarkable/templates/`. Simpler, but templates only exist on the device you push to:

```bash
make pull         # fetch current templates from device → remarkable_official_templates/
# edit templates in the web app
make deploy       # backup on device, merge, rsync, restart xochitl
make rollback     # restore most recent backup if something goes wrong
make list-backups # see all backups stored on the device
```

See [docs/device-sync.md](docs/device-sync.md) for SSH setup, prerequisites, and full details on both workflows.

## Web app

### Commands (run from project root)

```bash
pnpm dev           # start Fastify + Vite dev servers (localhost:5173)
pnpm server:dev    # Fastify API server only (localhost:3001)
pnpm test          # run all tests once
pnpm test:watch    # watch mode
pnpm build         # tsc + vite build
pnpm lint          # ESLint
docker compose up  # production build (localhost:3000)
```

### Features

- **Template browser** — sidebar lists all templates, filterable by category, orientation, source (Official/Methods), and name search
- **Multi-device preview** — toggle between reMarkable 1/2 (1404×1872), Paper Pro (1620×2160), and Paper Pro Move (954×1696)
- **SVG canvas renderer** — faithfully renders groups, paths, and text items with full expression evaluation and tile repetition
- **Monaco editor** — full JSON editor with syntax highlighting for editing template files
- **Custom templates** — create from scratch or fork any existing template; saved as `.template` files via the dev server API
- **Color defaults** — `foreground`/`background` sentinel constants set the canvas background color and default stroke color; the invert button swaps them (useful for previewing dark-paper or inverted themes)
- **Expression validation** — catches undefined constant references at Apply time, before the canvas errors
- **Delete custom templates** — remove custom templates from the UI, clearing the file and registry entry
- **Debug templates** — `public/templates/debug/` contains responsive developer templates served in dev mode; included when deploying. Debug templates include orientation labels in the title and a filled pentagon icon for easy identification

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
| rm (RM 1 & 2) | 1404×1872 | 1872×1404 | −234 |
| rmPP (Paper Pro) | 1620×2160 | 2160×1620 | −270 |
| rmPPM (Paper Pro Move) | 954×1696 | 1696×954 | −371 |

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
