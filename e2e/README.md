# FRS E2E tests (Playwright)

Browser tests for login, admin workspace, field lead, manager approvals, and office billing.

## Prerequisites

- Node 20.x (recommended)
- Database migrated and seeded: `npm run db:migrate && npm run db:seed`
- Playwright browsers (first time only):

```bash
npx playwright install chromium
```

## Run tests

From `source/`:

```bash
# All E2E tests (starts dev servers if not already running)
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# See the browser
npm run test:e2e:headed

# Single file
npx playwright test e2e/auth/login.spec.ts

# HTML report after a run
npm run test:e2e:report
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `FRS_WEB_URL` | `http://localhost:5174` | Web app base URL |
| `CI` | — | When set, retries tests and does not reuse running servers |

## Test users (seed)

| Role | Email | Password |
|------|--------|----------|
| System Admin | `admin@frs.local` | `ChangeMe123!` |
| Project Admin | `padmin@frs.local` | `ChangeMe123!` |
| Division Manager | `manager@frs.local` | `ChangeMe123!` |
| Field Lead | `lead@frs.local` | `ChangeMe123!` |

## Layout

```
e2e/
  helpers/       auth + role fixtures
  auth/          login & routing
  admin/         bid master, projects, units
  field/         field lead flows
  manager/       approval queue
  office/        project admin / billing
```

## Legacy smoke script

Quick one-off check (no Playwright Test runner):

```bash
npm run smoke
```
