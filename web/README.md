# reMarkable Templates — Web App

A React + TypeScript browser for previewing and validating reMarkable tablet page
templates rendered as SVG.

## Getting Started

```bash
pnpm install
pnpm dev        # dev server → http://localhost:5173
pnpm test       # run unit tests (Vitest)
pnpm build      # production build
```

## Architecture

```
src/
├── types/
│   ├── template.ts      # Core data types (RemarkableTemplate, items, expressions)
│   └── registry.ts      # Template registry (templates.json shape)
├── lib/
│   ├── expression.ts    # Constant resolver & expression evaluator (arithmetic, ternary, ||/&&)
│   ├── parser.ts        # JSON → RemarkableTemplate (validates and normalises raw data)
│   ├── registry.ts      # Registry CRUD helpers
│   └── renderer.ts      # Pure SVG utilities: device builtins, path→d, tile range, DEVICES map
├── components/
│   └── TemplateCanvas.tsx  # React SVG renderer (resolves constants, tiles groups, renders items)
└── App.tsx              # Two-panel shell: sidebar template list + preview stage
```

## Template Files

Templates live in `public/templates/` and are served as static assets.

- `templates.json` — registry listing all available templates
- `*.template` — individual template JSON files

To add a template, drop the `.template` file into `public/templates/` and add an
entry to `templates.json`. No rebuild required.

## Device Selector

The sidebar includes a device selector (RM1 / RM2 / Paper Pro). Switching device
re-renders the selected template with the correct viewport dimensions and
`paperOriginX` offset for that hardware.

| Device     | Portrait       | `paperOriginX` (portrait) |
|------------|----------------|--------------------------|
| RM1 / RM2  | 1404 × 1872 px | −234                     |
| Paper Pro  |  954 × 1696 px | −371                     |

## Expression System

Template constants support:

- **Arithmetic** — `"templateWidth / 2 - totalWidth / 2"`
- **Ternary** — `"templateWidth > mobileMaxWidth ? 0 : mobileOffsetY"`
- **Logical operators** — `"templateWidth < mobileMaxWidth || templateHeight < mobileMaxWidth ? 50 : 100"`
- **Forward references** — constants resolve in declaration order; later entries can reference earlier ones

## Repeat Modes

Groups tile their children across the page using a `repeat` config:

| Value        | Behaviour                                              |
|--------------|--------------------------------------------------------|
| `0`          | Render once (no tiling)                                |
| `N`          | Exactly N tiles                                        |
| `"down"`     | Fill downward to viewport bottom                       |
| `"right"`    | Fill rightward to viewport right edge                  |
| `"up"`       | Fill upward to viewport top                            |
| `"infinite"` | Fill both directions to cover the full viewport        |
| `"expr"`     | Expression resolving to a count (e.g. `"columns"`)     |

## Testing

Tests use Vitest + React Testing Library with jsdom. All tests are written
test-first (TDD).

```
src/__tests__/
├── expression.test.ts      # evaluateExpression, resolveConstants
├── parser.test.ts          # parseTemplate, serializeTemplate
├── registry.test.ts        # parseRegistry, CRUD helpers
├── renderer.test.ts        # formatNum, pathDataToSvgD, computeTileRange, DEVICES, deviceBuiltins
└── TemplateCanvas.test.tsx # SVG output tests including debug template calibration page
```

Run with coverage:

```bash
pnpm test:coverage
```
