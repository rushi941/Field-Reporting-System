# Required Packages — Field Reporting System

Canonical dependency list for Phase 1. Prefer these versions ranges unless a security advisory requires otherwise.

## Root / workspace

```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": {
    "typescript": "^5.8.0",
    "prettier": "^3.5.0",
    "eslint": "^9.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "turbo": "^2.0.0"
  }
}
```

## `packages/shared`

| Package | Purpose |
|---------|---------|
| `zod` | Shared runtime validation schemas |
| `typescript` | Types |

## `packages/db`

| Package | Purpose |
|---------|---------|
| `prisma` | Schema, migrations, generate |
| `@prisma/client` | Query client |
| `zod` | Optional Prisma ↔ Zod helpers |

## `apps/api` (Node)

### Runtime

| Package | Purpose |
|---------|---------|
| `express` | HTTP API |
| `cors` | CORS |
| `helmet` | Security headers |
| `morgan` / `pino-http` | Request logging |
| `dotenv` | Env config |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | JWT auth |
| `multer` | Multipart uploads (photos/docs) |
| `zod` | Request validation |
| `@prisma/client` | DB (via `packages/db`) |
| `csv-parse` / `csv-stringify` | Foundation import + billing export |
| `uuid` | IDs if not DB-generated |
| `express-rate-limit` | Auth/bruteforce protection |
| `cookie-parser` | Optional cookie sessions |

### Dev

| Package | Purpose |
|---------|---------|
| `vitest` | Unit/integration tests |
| `supertest` | HTTP assertions |
| `@types/express` | Types |
| `@types/cors` | Types |
| `@types/bcryptjs` | Types |
| `@types/jsonwebtoken` | Types |
| `@types/multer` | Types |
| `@types/supertest` | Types |
| `tsx` | Dev runner |
| `typescript` | Compile |

## `apps/web` (React + shadcn)

### Runtime

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI |
| `react-router-dom` | Routing |
| `@tanstack/react-query` | Server state |
| `zod` | Form/API validation |
| `react-hook-form` | Forms |
| `@hookform/resolvers` | Zod ↔ RHF |
| `axios` or `ky` | HTTP client |
| `clsx` / `tailwind-merge` | className helpers |
| `class-variance-authority` | shadcn variants |
| `lucide-react` | Icons (shadcn default) |
| `date-fns` | Dates |
| `sonner` | Toasts (optional shadcn pattern) |

### shadcn / UI primitives (typical)

Install via `npx shadcn@latest add …` as needed:

`button`, `input`, `label`, `form`, `card`, `table`, `dialog`, `sheet`, `select`, `textarea`, `badge`, `tabs`, `dropdown-menu`, `separator`, `skeleton`, `alert`, `checkbox`, `scroll-area`, `sonner`

### Dev / tooling

| Package | Purpose |
|---------|---------|
| `vite` | Bundler |
| `@vitejs/plugin-react` | React plugin |
| `typescript` | Types |
| `tailwindcss` | Styles |
| `@tailwindcss/vite` | Tailwind v4 + Vite |
| `vitest` | Unit tests |
| `@testing-library/react` | Component tests |
| `@testing-library/jest-dom` | Matchers |
| `@testing-library/user-event` | Interactions |
| `jsdom` | DOM env |
| `eslint` + `typescript-eslint` | Lint |
| `eslint-plugin-react-hooks` | Hooks rules |
| `prettier` / `prettier-plugin-tailwindcss` | Format |

## Explicitly out of Phase 1 (do not add unless approved)

- Foundation SDK / live API clients
- Native Expo / React Native
- Full offline PWA sync libraries as hard dependency
- SMS providers (Twilio, etc.)
- Heavy BI chart suites beyond simple admin charts
