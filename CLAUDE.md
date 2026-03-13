# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from project root:

```bash
pnpm test              # run all tests once (Vitest)
pnpm test:watch        # watch mode
pnpm test:coverage     # with v8 coverage
pnpm dev               # dev server
pnpm build             # tsc + vite build
pnpm lint              # ESLint
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

This is a React 19 + TypeScript app. Workflow is TDD: write tests first, then implement.

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
| rm1, rm2 | 1404×1872 | same pixel dimensions |
| rmPP (Paper Pro) | 954×1696 | |

`paperOriginX = templateWidth/2 - templateHeight/2` (negative in portrait, positive in landscape).

### Registry (`lib/registry.ts`, `types/registry.ts`)

`templates.json` is the registry: a list of `TemplateRegistryEntry` with `name`, `filename`, `iconCode`, `landscape`, `categories`. Parsed with `parseRegistry()`; mutated with `addEntry()`, `removeEntry()`, `updateEntry()`, `filterByCategory()`.

### Template files

`.template` files are served from `public/templates/`. The `vite-plugin-static-copy` plugin handles this. `remarkable_official_templates/` is for unmodified originals from the device and is not tracked in git (only the `.gitkeep` is tracked).
