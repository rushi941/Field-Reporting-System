---
name: frs-packages
description: >-
  Install and choose FRS dependencies for React, Node, PostgreSQL, Prisma, and
  shadcn/ui. Use when adding packages, scaffolding apps, or asking which library
  to use.
---

# FRS Packages

## Source of truth

Full list: [docs/packages.md](../../../docs/packages.md)

## Defaults (do not substitute without reason)

| Need | Use |
|------|-----|
| Validation | `zod` |
| ORM | `prisma` + `@prisma/client` |
| HTTP API | `express` |
| Auth | `jsonwebtoken` + `bcryptjs` |
| Forms | `react-hook-form` + `@hookform/resolvers` |
| Server state | `@tanstack/react-query` |
| UI | shadcn/ui + Tailwind |
| Icons | `lucide-react` |
| Unit tests | `vitest` |
| API tests | `supertest` |
| Component tests | `@testing-library/react` |
| CSV | `csv-parse` / `csv-stringify` |
| Uploads | `multer` |

## Scaffold commands (reference)

```bash
# workspace root (npm workspaces example)
npm init -w apps/web -w apps/api -w packages/shared -w packages/db

# web
npm create vite@latest apps/web -- --template react-ts
cd apps/web && npx shadcn@latest init

# api
# express + tsx + vitest + prisma (via packages/db)

# db package
npx prisma init
```

## Phase 1 exclusions

Do not add: Foundation live SDKs, React Native/Expo, Twilio SMS, full offline sync stacks — unless product explicitly expands scope.

## Checklist when adding a dependency

- [ ] Listed in or justified vs [docs/packages.md](../../../docs/packages.md)
- [ ] License OK for commercial use
- [ ] Types available or bundled
- [ ] Not duplicating an existing default
