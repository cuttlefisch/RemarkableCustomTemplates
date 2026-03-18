# Contributing to remarkable-templates

## Prerequisites

- Node.js 20+
- pnpm 9+

## Setup

```bash
pnpm install
```

## Development

`pnpm dev` starts both the Fastify API server (port 3001) and Vite dev server (port 5173) concurrently. Vite proxies `/api/*` and `/templates/*` requests to Fastify.

To test with Docker: `docker compose up --build -d` serves everything on port 3000.

## TDD Workflow

This project follows test-driven development. Write tests first, then implement.

```bash
pnpm test          # run all tests once
pnpm test:watch    # watch mode (re-runs on file changes)
pnpm test:coverage # with v8 coverage report
pnpm lint          # ESLint
pnpm build         # tsc -b + vite build (catches type errors)
```

Run a single test file:
```bash
pnpm vitest run src/__tests__/renderer.test.ts
```

Run tests matching a name pattern:
```bash
pnpm vitest run -t "test name pattern"
```

## Adding a Test

Add tests to the appropriate file in `src/__tests__/`. Each test file mirrors a source file:

| Test file | Source file |
|-----------|-------------|
| `expression.test.ts` | `lib/expression.ts` |
| `parser.test.ts` | `lib/parser.ts` |
| `registry.test.ts` | `lib/registry.ts` |
| `renderer.test.ts` | `lib/renderer.ts` |
| `color.test.ts` | `lib/color.ts` |
| `customTemplates.test.ts` | `lib/customTemplates.ts` |
| `debugTemplate.test.ts` | test-only helpers (no direct source counterpart) |
| `backup.test.ts` | `lib/backup.ts` |
| `rmMethods.test.ts` | `lib/rmMethods.ts` |
| `methodsTemplates.test.ts` | `lib/methodsTemplates.ts` |
| `iconGenerator.test.ts` | `lib/iconGenerator.ts` |
| `TemplateCanvas.test.tsx` | `components/TemplateCanvas.tsx` |
| `TemplateEditor.test.tsx` | `components/TemplateEditor.tsx` |
| `server/__tests__/routes.test.ts` | `server/routes/*.ts` |
| `server/__tests__/config.test.ts` | `server/config.ts` |
| `server/__tests__/pathSecurity.test.ts` | `server/lib/pathSecurity.ts` |
| `server/__tests__/manifestUuids.test.ts` | `server/lib/manifestUuids.ts` |
| `server/__tests__/buildMethodsRegistry.test.ts` | `server/lib/buildMethodsRegistry.ts` |

## Adding a Template File

The easiest way is through the web UI (`pnpm dev`): click **New template** to create one from scratch, or select any existing template and click **Save as New Template** to fork it. The dev server handles file writes and registry updates automatically.

To add a template manually (advanced):
1. Place the `.template` JSON file in `public/templates/custom/`
2. Add an entry to `public/templates/custom/custom-registry.json` with `"isCustom": true` and a `"custom/"` filename prefix
3. Restart the dev server to pick up the new file

## Pull Request Checklist

- [ ] All tests pass: `pnpm test`
- [ ] Lint is clean: `pnpm lint`
- [ ] Build succeeds: `pnpm build`
- [ ] New behavior has a test
- [ ] No test mocks that could mask real failures
