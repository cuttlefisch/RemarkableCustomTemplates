# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from project root:

```bash
pnpm test              # run all tests once (Vitest)
pnpm test:watch        # watch mode
pnpm test:coverage     # with v8 coverage
pnpm dev               # Fastify server + Vite dev server (concurrently)
pnpm server:dev        # Fastify server only (port 3001)
pnpm build             # tsc + vite build (frontend)
pnpm lint              # ESLint
make pull-rm-methods   # pull rm_methods templates from device
docker compose up      # run via Docker (port 3000)
```

Run a single test file:
```bash
pnpm vitest run src/__tests__/renderer.test.ts
```

Run a single test by name:
```bash
pnpm vitest run -t "test name pattern"
```

## Architecture

This is a React 19 + TypeScript app with a standalone Fastify API server. Workflow is TDD: write tests first, then implement.

### Server (`server/`)

API routes live in a standalone Fastify server (extracted from the former Vite plugin). In dev, Vite proxies `/api/*` and `/templates/*` to Fastify on port 3001. In production (Docker), Fastify serves both API and static frontend on port 3000.

```
server/
  index.ts           — entry point (listen on PORT)
  app.ts             — createApp() factory (testable via Fastify inject)
  config.ts          — resolve paths from DATA_DIR env var
  routes/
    templates.ts     — GET /templates/* (merged registry)
    customTemplates.ts — CRUD /api/custom-templates
    officialTemplates.ts — POST /api/save-official-templates
    export.ts        — GET /api/export-templates, /api/export-rm-methods
    backup.ts        — GET /api/backup, POST /api/restore
    device/
      config.ts      — GET/POST /api/device/config, test-connection, setup-keys
      pull.ts        — POST /api/device/pull-official, pull-methods
      deploy.ts      — POST /api/device/deploy-methods, deploy-classic
      rollback.ts    — POST /api/device/rollback-methods, rollback-original, rollback-classic
      backups.ts     — GET /api/device/backups
  lib/
    pathSecurity.ts  — assertWithin() path traversal guard
    ssh.ts           — programmatic SSH via ssh2 (no ~/.ssh/config needed)
    sftp.ts          — SFTP file transfer helpers
    manifestUuids.ts — manifest UUID utilities (replaces Python script)
    buildMethodsRegistry.ts — build methods registry (replaces Python script)
```

### Data flow

```
.template JSON file
  → parseTemplate()        [lib/parser.ts]    — deserializes to RemarkableTemplate
  → resolveConstants()     [lib/expression.ts] — evaluates constant expressions in order
  → TemplateCanvas         [components/]       — React component, renders SVG
      → GroupView / PathView / TextView        — item renderers
          → computeTileRange()  [lib/renderer.ts] — calculates tile repetition grid
          → pathDataToSvgD()    [lib/renderer.ts] — converts PathData tokens to SVG d string
```

### Key types (`src/types/`)

- `RemarkableTemplate` — root object: name/author/orientation + `constants[]` + `items[]`
- `TemplateItem` — discriminated union: `GroupItem | PathItem | TextItem`
- `ScalarValue = number | string` — string values are arithmetic/ternary expressions
- `PathData` — flat token array: `["M", x, y, "L", x2, y2, "C", ...]`
- `RepeatValue` — `0` (once), `N` (exact), `"down"` (fill forward), `"infinite"` (fill viewport both ways)

### Expression evaluation (`lib/expression.ts`)

Constants are a `{key: value}[]` array evaluated in order — later entries may reference earlier ones. Device builtins (`templateWidth`, `templateHeight`, `paperOriginX`, `paperOriginY`) are injected before user constants. Expressions support arithmetic, comparisons, `&&`/`||`, and ternary. Evaluation uses `Function()` after substituting identifiers.

### Rendering (`lib/renderer.ts` + `components/TemplateCanvas.tsx`)

Groups use `boundingBox` as the tile size. The `repeat` config drives `computeTileRange()` to build a 2D grid of `<g transform="translate(...)">` elements. Children receive `parentWidth`/`parentHeight` in their constants (= the tile's resolved bounding box). Text positions inject `textWidth` (estimated as `fontSize * 0.6 * charCount`) before resolving `x`/`y`.

### Device constants

| Device | Portrait W×H | Notes |
|--------|-------------|-------|
| rm (RM 1 & 2) | 1404×1872 | same pixel dimensions |
| rmPP (Paper Pro) | 1620×2160 | |
| rmPPM (Paper Pro Move) | 954×1696 | |

`paperOriginX = templateWidth/2 - templateHeight/2` (negative in portrait, positive in landscape).

### Registry (`lib/registry.ts`, `types/registry.ts`)

`templates.json` is the registry: a list of `TemplateRegistryEntry` with `name`, `filename`, `iconCode`, `landscape`, `categories`, optional `rmMethodsId` (UUID), and optional `origin` (`"official-methods"` or `"custom-methods"` for pulled methods templates). Parsed with `parseRegistry()`; mutated with `addEntry()`, `removeEntry()`, `updateEntry()`, `filterByCategory()`.

The dev server merges `debug-registry.json` + `methods-registry.json` + official `templates.json` into the served `GET /templates/templates.json`. The frontend loads `custom-registry.json` separately.

### UI structure

Two pages: **Templates** (`/`) and **Device & Sync** (`/device`). The Templates page has a sidebar listing all templates with source filter chips (Classic / Methods) that filter by `origin` / `isCustom`, plus category, orientation, and name search filters.

### Template files

`.template` files are served from `public/templates/`. In dev, Vite serves them from `public/` directly. The Fastify server handles `/templates/*` routes (merged registry, etc.). In production (Docker), Fastify serves both API routes and the static frontend build. `remarkable_official_templates/` is for unmodified originals from the device and is not tracked in git (only the `.gitkeep` is tracked). `public/templates/methods/` stores rm_methods templates pulled from the device via `make pull-rm-methods` (git-ignored).

### rm_methods deploy (preferred)

rm_methods is the recommended deployment format — it syncs templates across paired devices via the reMarkable cloud. Build generates `rm-methods-dist/` with UUID-named file triplets (`.template`, `.metadata`, `.content`) plus a `.manifest` file (JSON with name, version, hash, createdTime per UUID). `rm-methods-backups/.deployed-manifest` tracks what's currently on the device, enabling orphan cleanup on deploy and precise rollbacks. See `docs/device-sync.md` for full details.

### Backup/restore (`lib/backup.ts`)

`GET /api/backup` exports a ZIP of custom + debug templates with registries and a `backup-manifest.json`. Backup filename includes a timestamp with HHMMSS (e.g. `remarkable-backup-2026-03-17_143022.zip`). `POST /api/restore?mode=merge` imports a backup ZIP, merging new entries (matched by `rmMethodsId` then `filename`). Validation uses `parseRegistry()` and `parseTemplate()` on every file. Methods templates are excluded from backups. Backup and restore controls are on the **Device & Sync** page (`/device`).
