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
│   │   ├── notebook.ts          ← export/deploy/check-notebook endpoints
│   │   ├── notebookDrafts.ts    ← CRUD /api/notebook-drafts
│   │   ├── builtinNotebooks.ts  ← virtual built-in notebooks (GET/hide/restore)
│   │   ├── sampleTemplates.ts   ← sample template hide/restore API
│   │   └── device/              ← SSH device operations (config, pull, deploy, rollback)
│   ├── lib/             ← ssh.ts, sftp.ts, pathSecurity.ts, manifestUuids.ts, buildMethodsRegistry.ts,
│   │                       deviceStore.ts, deviceManifest.ts, ndjsonStream.ts, sshErrors.ts,
│   │                       notebookDraftStore.ts, builtinNotebooks.ts
│   └── __tests__/       ← server tests
├── src/
│   ├── types/       ← template.ts, registry.ts, notebook.ts
│   ├── lib/         ← expression.ts, parser.ts, registry.ts, renderer.ts, customTemplates.ts, color.ts,
│   │                   backup.ts, methodsTemplates.ts, rmMethods.ts, iconGenerator.ts,
│   │                   notebookGenerator.ts, notebookDraftApi.ts,
│   │                   drawingShapes.ts, drawingCoords.ts, drawingViewport.ts
│   ├── components/  ← TemplateCanvas.tsx, TemplateEditor.tsx, NavBar.tsx, CanvasErrorBoundary.tsx
│   │   └── device/  ← DeviceConnectionCard.tsx, DeviceSyncCard.tsx, DeviceBackupsCard.tsx
│   ├── pages/       ← TemplatesPage.tsx, DevicePage.tsx, NotebookPage.tsx
│   ├── hooks/       ← useRegistry.ts, useDevices.ts, useTheme.ts,
│   │                   useDrawingEditor.ts, useNotebookEditor.ts, useNotebookList.ts
│   ├── themes/      ← themes.ts, tokens.css, palettes/ (10 theme palette files)
│   └── __tests__/   ← Vitest test suite
├── electron/
│   ├── main.ts      ← Electron main process (Fastify on random localhost port + BrowserWindow)
│   ├── preload.ts   ← IPC bridge (CJS output required by Electron sandbox)
│   └── seed.ts      ← seed data directories on first packaged run
├── e2e/             ← Playwright end-to-end tests
│   ├── helpers.ts   ← shared helpers (waitForSidebarLoaded, createNotebook, addPageGroup)
│   └── *.spec.ts    ← test suites (templates, device, notebook, theme, regressions, etc.)
├── scripts/
│   ├── merge-templates.mjs  ← merges official + custom into dist-deploy/
│   └── build-electron.mjs   ← esbuild bundler for Electron main + preload
├── public/
│   └── templates/
│       ├── custom/  ← custom .template files + custom-registry.json (git-ignored)
│       ├── debug/   ← debug templates served in dev mode only
│       ├── samples/ ← sample templates bundled with app
│       ├── methods/ ← rm_methods templates pulled from device (git-ignored)
│       └── ...      ← official .template files (git-ignored)
├── docs/
├── .github/
│   ├── workflows/ci.yml     ← GitHub Actions: lint, type-check, test, build
│   └── CONTRIBUTING.md
├── Dockerfile       ← multi-stage build (production)
├── docker-compose.yml ← single-service with volume mount
├── electron-builder.yml ← Electron packaging config (AppImage/deb/rpm, dmg, exe)
├── playwright.config.ts ← Playwright E2E config (Docker-backed test server)
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
├── sampleTemplates.ts   ← GET/POST /api/sample-templates (hide/restore)
├── export.ts            ← GET /api/export-templates, /api/export-rm-methods
├── backup.ts            ← GET /api/backup, POST /api/restore
├── notebook.ts          ← POST /api/notebooks/export, /api/devices/:id/deploy-notebook, check-notebook
├── notebookDrafts.ts    ← CRUD /api/notebook-drafts, /api/notebook-drafts/:id, fork
├── builtinNotebooks.ts  ← GET /api/builtin-notebooks, hide, restore-all
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
| `NotebookDraft` | `src/types/notebook.ts` | Saved notebook draft (id, name, pageGroups, deviceId, orientation, lastModified) |
| `PageGroup` | `src/types/notebook.ts` | A group of pages sharing the same template (templateRef, count, iconData) |
| `NotebookDefinition` | `src/types/notebook.ts` | Complete notebook definition for export/deploy |
| `NotebookContent` | `src/types/notebook.ts` | Full `.content` file structure (cPages v2 format) |

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

Three pages:

- **Templates** (`/`) — sidebar with source filter chips (Classic / Methods), category, orientation, and name search. Main area shows SVG canvas preview with Monaco JSON editor. Custom templates support a visual drawing editor and a JSON editor, with resizable panel boundaries.
- **Device & Sync** (`/device`) — Multi-device management with tab selector, SSH connection/key setup, pull/deploy/rollback controls, sync status comparison, selective deploy, remove-all with backup, and backup/restore.
- **Notebook Builder** (`/notebook`) — Multipage notebook builder with draft management, template picker, page group editor, and export/deploy to device.

## Notebook builder

The notebook builder (`/notebook`) lets users compose multipage notebooks from existing templates and deploy them to a reMarkable device.

### Types (`src/types/notebook.ts`)

- `PageGroup` — a group of pages sharing the same template, with `templateRef`, `templateName`, `count`, and optional `iconData` (Base64 SVG thumbnail)
- `NotebookDraft` — a saved draft with `id`, `name`, `pageGroups`, `deviceId`, `orientation`, `lastModified`, and optional `deployedUuid` (for update-in-place detection)
- `NotebookDefinition` — the complete definition sent to export/deploy endpoints, including optional `reuseUuid`
- `NotebookContent` — the full `.content` file structure using cPages v2 format with CRDT timestamps and fractional indexing
- `NotebookMetadata`, `NotebookLocal` — companion file structures

### State management (`src/hooks/useNotebookEditor.ts`)

The editor uses `useReducer` with a typed action discriminated union (`NotebookEditorAction`). 12 action types: `SET_NAME`, `ADD_GROUP`, `REMOVE_GROUP`, `SET_GROUP_COUNT`, `REORDER_GROUP`, `SELECT_GROUP`, `SET_DEVICE_ID`, `SET_GROUP_TEMPLATE`, `SET_ORIENTATION`, `SET_DEPLOYED_UUID`, `LOAD`, `RESET`.

Auto-save is built into the `useNotebookEditor` hook via a 500ms debounced `useEffect` that calls an `onAutoSave` callback whenever state changes.

### Server-side draft storage (`server/lib/notebookDraftStore.ts`)

Drafts are persisted in `data/notebooks.json` via `notebookDraftStore.ts`. The store supports `readNotebookStore`, `upsertDraft`, `removeDraft`, and `forkDraft` (duplicate with new UUID).

### API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/notebook-drafts` | GET | List all drafts |
| `/api/notebook-drafts` | POST | Create draft or batch-import `{ drafts: [...] }` |
| `/api/notebook-drafts/:id` | PUT | Update draft |
| `/api/notebook-drafts/:id` | DELETE | Delete draft |
| `/api/notebook-drafts/:id/fork` | POST | Fork (duplicate) a draft |
| `/api/notebooks/export` | POST | Generate notebook ZIP for download |
| `/api/devices/:id/deploy-notebook` | POST | Deploy notebook to device via SFTP (NDJSON progress stream) |
| `/api/devices/:id/check-notebook` | POST | Check if a previously deployed notebook exists on device |

### Notebook file generation (`src/lib/notebookGenerator.ts`)

`expandPageGroups()` expands page groups into individual `NotebookPage` entries with UUIDs. `generateNotebookContent()` produces cPages v2 format with CRDT timestamps. All devices share the **1404x1872** coordinate system for `.content` files regardless of device model.

### Per-device .rm file strategy

- **rmPPM (Paper Pro Move)**: MUST deploy 423-byte `.rm` stubs — without them, broken zoom/dimensions
- **rm (RM1/RM2)**: Do NOT deploy `.rm` files — device creates native 408-byte files on first page access
- **rmPP (Paper Pro)**: Do NOT deploy `.rm` files — **UNTESTED**, assumed like RM1

`generateEmptyRmFile(deviceId)` returns the PPM blob for `'rmPPM'` and `null` for all other devices. Deploy and export routes use this to conditionally include `.rm` files.

## Drawing editor

Custom templates can be edited visually via the **Draw** button. The editor uses a state-machine reducer (`useDrawingEditor`) with ~45 action types. Side effects (auto-save, item moves) use an **intent pattern**: the reducer sets an intent field (e.g. `moveItemIntent`), and `useEffect` in `TemplatesPage` executes the mutation and clears the intent.

### Component architecture

```
TemplatesPage (orchestrator)
  ├── DrawingToolbar        — tool/property controls, adaptive overflow
  │     └── useToolbarOverflow  — ResizeObserver progressive disclosure
  ├── DrawingOverlay        — SVG interaction layer (click/drag/rotate/scale)
  │     └── useViewport     — pan/zoom state
  └── TemplateCanvas        — pure SVG render (shared with preview)
```

### Supporting modules

| File | Purpose |
|------|---------|
| `src/lib/drawingShapes.ts` | Shape builders, Hobby spline, path transforms |
| `src/lib/drawingCoords.ts` | Screen-to-template coordinate conversion |
| `src/lib/drawingViewport.ts` | Viewport math (zoom-to-fit, pan bounds) |
| `src/hooks/useDrawingEditor.ts` | State machine reducer (~45 actions) |

### Tools

7 tools: **select**, **point**, **line**, **polygon**, **regular polygon**, **circle**, **bezier** (Catmull-Rom / Hobby spline).

### Scaling modes

- **Adaptive** — coordinates scale proportionally via expressions; templates render correctly across device sizes
- **Fixed** — pixel-exact for one device; coordinates are literal numbers

### Toolbar overflow

The toolbar uses `ResizeObserver` to progressively hide groups into an overflow menu in priority order (P0: undo/tools, P1: shape properties, P2: transform/precision, P3: zoom/coords). Panels (sidebar, preview, JSON editor) are resizable via drag dividers with localStorage persistence.

## Theme system

10 themes in `src/themes/palettes/`, split across 4 light and 6 dark variants:

| Light | Dark |
|-------|------|
| GitHub Light | One Dark |
| One Light | Dracula |
| Gruvbox Light | Gruvbox Dark |
| Solarized Light | Nord |
| | Solarized Dark |
| | Tokyo Night |

Each theme defines ~130 CSS custom properties in `src/themes/tokens.css` plus a custom Monaco `IStandaloneThemeData` for the JSON editor. Monaco `defineTheme` only accepts hex/hex8 color format — never use `rgba()` in `monacoTheme.colors`.

Theme selection persists via localStorage. The `useTheme` hook manages theme loading and switching.

## Electron packaging

The app can be packaged as a standalone desktop application using Electron.

### Files

| File | Purpose |
|------|---------|
| `electron/main.ts` | Main process: starts Fastify on random localhost port, opens BrowserWindow |
| `electron/preload.ts` | IPC bridge (built to CJS format required by Electron sandbox) |
| `electron/seed.ts` | Seeds data directories on first packaged run |
| `scripts/build-electron.mjs` | esbuild bundler for main + preload |
| `electron-builder.yml` | Packaging config for all platforms |

### Platform targets

| Platform | Formats |
|----------|---------|
| Linux | AppImage, deb, rpm (x64 + arm64) |
| macOS | dmg, zip (universal) |
| Windows | NSIS installer (x64 + arm64) |

### IPC bridge

The preload script exposes `window.electronAPI` with:
- `refreshDeviceMenu()` — renderer signals main process to rebuild native menus after device changes
- `onNavigate(callback)` — receive navigation commands from native menu
- `onDeviceAction(callback)` — receive device actions (set-active, deploy, sync-status) from native menu

### Native menu

The main process builds a native menu with:
- **Navigate** submenu — Templates (`Cmd+1`), Device & Sync (`Cmd+2`), Notebook Builder (`Cmd+3`)
- **Device** submenu — radio-style device selection, test connection, deploy templates, sync status
- **View** submenu — standard view controls plus show/hide menu bar (non-macOS)

### Build commands

```bash
pnpm electron:dev           # build electron + run in dev mode
pnpm electron:build         # build all platforms
pnpm electron:build:mac     # macOS only
pnpm electron:build:win     # Windows only
pnpm electron:build:linux   # Linux only
```

## E2E testing

End-to-end tests use Playwright with a Docker-backed test server.

### Configuration (`playwright.config.ts`)

- Test directory: `e2e/`
- Base URL: `http://localhost:3000` (Docker production build)
- Web server command: `make docker-up` (auto-started, reuses existing)
- Browser: Chromium (headless)
- Screenshots on failure

### Test suites

| File | Coverage |
|------|----------|
| `e2e/templates.spec.ts` | Template loading and preview |
| `e2e/templates-sidebar.spec.ts` | Sidebar list/card views, search |
| `e2e/templates-filters.spec.ts` | Category, orientation, source filters |
| `e2e/templates-editors.spec.ts` | JSON editor, drawing editor |
| `e2e/templates-custom.spec.ts` | Custom template CRUD |
| `e2e/templates-bulk.spec.ts` | Bulk operations |
| `e2e/device.spec.ts` | Device management UI |
| `e2e/notebook.spec.ts` | Notebook builder flows |
| `e2e/notebook-cards.spec.ts` | Notebook card interactions |
| `e2e/theme.spec.ts` | Theme switching |
| `e2e/navigation.spec.ts` | Page navigation |
| `e2e/responsive.spec.ts` | Responsive layout |
| `e2e/regressions.spec.ts` | Regression tests for bug fixes |

### Helpers (`e2e/helpers.ts`)

Shared functions: `waitForSidebarLoaded`, `selectFirstTemplate`, `copySelectedTemplate`, `createNotebook`, `addPageGroup`.

### Running

```bash
pnpm e2e                    # run all E2E tests
pnpm playwright test <file> # run a specific suite
```

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
| `pnpm e2e` | Playwright E2E tests (requires Docker) |
| `pnpm electron:dev` | Electron dev mode |
| `pnpm electron:build` | Package Electron app (all platforms) |
| `pnpm electron:build:linux` | Package for Linux (AppImage/deb/rpm) |
| `pnpm electron:build:mac` | Package for macOS (dmg/zip) |
| `pnpm electron:build:win` | Package for Windows (NSIS) |
| `docker compose up` | Production build (localhost:3000) |
