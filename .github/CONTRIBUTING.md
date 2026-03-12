# Contributing to remarkable-templates

## Prerequisites

- Node.js 20+
- pnpm 9+

## Setup

```bash
cd web
pnpm install
```

## TDD Workflow

This project follows test-driven development. Write tests first, then implement.

```bash
cd web
pnpm test          # run all tests once
pnpm test:watch    # watch mode (re-runs on file changes)
pnpm lint          # ESLint
pnpm build         # tsc -b + vite build (catches type errors)
```

Run a single test file:
```bash
cd web && pnpm vitest run src/__tests__/renderer.test.ts
```

Run tests matching a name pattern:
```bash
cd web && pnpm vitest run -t "test name pattern"
```

## Adding a Test

Add tests to the appropriate file in `web/src/__tests__/`. Each test file mirrors a source file:

| Test file | Source file |
|-----------|-------------|
| `expression.test.ts` | `lib/expression.ts` |
| `parser.test.ts` | `lib/parser.ts` |
| `registry.test.ts` | `lib/registry.ts` |
| `renderer.test.ts` | `lib/renderer.ts` |
| `TemplateCanvas.test.tsx` | `components/TemplateCanvas.tsx` |
| `TemplateEditor.test.tsx` | `components/TemplateEditor.tsx` |

## Adding a Template File

1. Place the `.template` JSON file in `web/public/templates/`
2. Add an entry to `web/public/templates/templates.json` with `name`, `filename`, `iconCode`, `landscape`, and `categories`
3. Verify it renders correctly in the dev server: `pnpm dev`

## Pull Request Checklist

- [ ] All tests pass: `pnpm test`
- [ ] Lint is clean: `pnpm lint`
- [ ] Build succeeds: `pnpm build`
- [ ] New behavior has a test
- [ ] No test mocks that could mask real failures
