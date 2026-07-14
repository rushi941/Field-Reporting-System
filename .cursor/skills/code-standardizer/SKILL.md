---
name: code-standardizer
description: >-
  Enforce FRS code style, naming, folder structure, and React/Node patterns.
  Use when scaffolding modules, renaming, refactoring for consistency, or when
  the user asks to standardize code.
---

# FRS Code Standardizer

## Language & style

- TypeScript **strict**; prefer `unknown` over `any`
- Prettier for formatting; ESLint flat config
- Named exports preferred for domain modules; default export OK for pages
- Early returns over deep nesting
- No dead code or commented-out blocks in PRs

## Naming

| Kind | Convention | Example |
|------|------------|---------|
| React component | PascalCase | `StaRangeForm.tsx` |
| Hooks | `use` + camelCase | `usePendingReports.ts` |
| API routes | kebab-case paths | `/api/v1/bid-items` |
| DB models (Prisma) | PascalCase model, camelCase fields | `ReportLineItem` |
| Zod schemas | camelCase + `Schema` | `reportSubmitSchema` |
| Enums | SCREAMING_SNAKE values | `APPROVED_WITH_NOTES` |
| Test files | `*.test.ts(x)` | `sta.test.ts` |
| Env vars | SCREAMING_SNAKE | `DATABASE_URL` |

## Folder conventions

### `apps/web/src`

```
components/ui/          # shadcn only
components/reports/     # domain UI
features/<feature>/     # pages + hooks colocated when cohesive
hooks/
lib/                    # api client, utils
pages/ or routes/
```

### `apps/api/src`

```
routes/
controllers/ or handlers/
middleware/
services/
lib/
```

### `packages/shared/src`

```
schemas/
lib/
types/
constants/
```

## Patterns

### React

- Function components only
- Prefer React Query mutations/queries over ad-hoc `useEffect` fetch
- Forms: `react-hook-form` + Zod resolver
- Use shadcn primitives; wrap in domain components when needed
- Mobile-first: touch targets, minimal fields on field forms

### API

- Thin routes → service layer → Prisma
- `asyncHandler` or consistent try/catch + central error middleware
- Return consistent error envelope
- Never return password hashes or internal secrets

### Prisma

- Migrations for all schema changes
- Transactions for submit + audit, approve + audit
- Soft constraints via enums for status/form type

## Import order

1. External packages
2. `@frs/shared`, `@frs/db`
3. App aliases (`@/…`)
4. Relative

## When standardizing existing code

1. Match nearby files first (local consistency)
2. Apply naming + folder moves without behavior change
3. Run lint/tests
4. Do not mix drive-by refactors with feature PRs unless asked

## Full standards

See [STANDARDS.md](STANDARDS.md)
