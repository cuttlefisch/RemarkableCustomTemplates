# Architecture

Developer reference for the remarkable-templates codebase. For user-facing docs, see the [README](../README.md).

## Project structure

```
remarkable_templates/
├── server/
│   ├── index.ts         ← entry point (listen on PORT)
│   ├── app.ts           ← createApp() factory (testable via Fastify inject)
│   ├── config.ts        ← DATA_DIR-based path resolution
│   ├── routes/          ← API route handlers
│   │   └── device/      ← SSH device operations (config, pull, deploy, rollback)
│   ├── lib/             ← ssh.ts, sftp.ts, pathSecurity.ts, manifestUuids.ts, buildMethodsRegistry.ts,
│   │                       deviceStore.ts, deviceManifest.ts, ndjsonStream.ts, sshErrors.ts
│   └── __tests__/       ← server tests
├── src/
│   ├── types/       ← template.ts, registry.ts
│   ├── lib/         ← expression.ts, parser.ts, registry.ts, renderer.ts, customTemplates.ts, color.ts,
│   │                   backup.ts, methodsTemplates.ts, rmMethods.ts, iconGenerator.ts
│   ├── components/  ← TemplateCanvas.tsx, TemplateEditor.tsx, NavBar.tsx, CanvasErrorBoundary.tsx
│   │   └── device/  ← DeviceConnectionCard.tsx, DeviceSyncCard.tsx, DeviceBackupsCard.tsx
│   ├── pages/       ← TemplatesPage.tsx, DevicePage.tsx
│   ├── hooks/       ← useRegistry.ts, useDevices.ts, useTheme.ts
│   ├── themes/      ← themes.ts, tokens.css, palettes/ (10 theme palette files)
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

## Server

The API is a standalone Fastify server (`server/`). In development, Vite proxies `/api/*` and `/templates/*` to Fastify on port 3001. In production (Docker), Fastify serves both API routes and the static frontend build on port 3000.

### Route structure

```
server/routes/
├── templates.ts         ← GET /templates/* (merged registry)
├── customTemplates.ts   ← CRUD /api/custom-templates
├── officialTemplates.ts ← POST /api/save-official-templates
├── export.ts            ← GET /api/export-templates, /api/export-rm-methods
├── backup.ts            ← GET /api/backup, POST /api/restore
└── device/
    ├── config.ts        ← CRUD /api/devices, /api/devices/:id, /api/devices/active, test-connection, setup-keys
    ├── pull.ts          ← POST /api/devices/:id/pull-official, pull-methods
    ├── deploy.ts        ← POST /api/devices/:id/deploy-methods, deploy-classic
    ├── rollback.ts      ← POST /api/devices/:id/rollback-methods, rollback-original, rollback-classic
    ├── backups.ts       ← GET /api/devices/:id/backups
    ├── syncStatus.ts    ← POST /api/devices/:id/sync-status
    └── removeAll.ts     ← POST /api/devices/:id/remove-all-preview, remove-all-execute
```

## Data flow

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

## Key types

| Type | Location | Description |
|------|----------|-------------|
| `RemarkableTemplate` | `src/types/template.ts` | Root object: name/author/orientation + `constants[]` + `items[]` |
| `TemplateItem` | `src/types/template.ts` | Discriminated union: `GroupItem \| PathItem \| TextItem` |
| `ScalarValue` | `src/types/template.ts` | `number \| string` — strings are arithmetic/ternary expressions |
| `PathData` | `src/types/template.ts` | Flat token array: `["M", x, y, "L", x2, y2, "C", ...]` |
| `RepeatValue` | `src/types/template.ts` | `0` (once), `N` (exact), `"down"`, `"up"`, `"right"`, `"infinite"`, or expression string |
| `TemplateRegistry` | `src/types/registry.ts` | List of `TemplateRegistryEntry` from `templates.json` |

## Registry system

The template registry (`templates.json`) lists available templates with metadata: `name`, `filename`, `iconCode`, `landscape`, `categories`, optional `rmMethodsId` (UUID), and optional `origin`.

In development, the server merges three registries into the served `GET /templates/templates.json`:
- `debug-registry.json` — debug templates (dev mode only)
- `methods-registry.json` — rm_methods templates pulled from device
- official `templates.json` — shipped templates

Custom templates use a separate `custom-registry.json` loaded independently by the frontend.

### Origin tags

| `origin` | Meaning |
|----------|---------|
| `"official-methods"` | Shipped by reMarkable as methods content |
| `"custom-methods"` | User templates previously deployed via rm_methods |
| *(absent)* | Classic/official templates |

## UI structure

Two pages:

- **Templates** (`/`) — sidebar with source filter chips (Classic / Methods), category, orientation, and name search. Main area shows SVG canvas preview with Monaco JSON editor.
- **Device & Sync** (`/device`) — Multi-device management with tab selector, SSH connection/key setup, pull/deploy/rollback controls, sync status comparison, selective deploy, remove-all with backup, and backup/restore.

## Dev commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Fastify + Vite dev servers (localhost:5173) |
| `pnpm server:dev` | Fastify API server only (localhost:3001) |
| `pnpm test` | Run all tests once |
| `pnpm test:watch` | Watch mode |
| `pnpm test:coverage` | With v8 coverage |
| `pnpm build` | tsc + vite build |
| `pnpm lint` | ESLint |
| `docker compose up` | Production build (localhost:3000) |
