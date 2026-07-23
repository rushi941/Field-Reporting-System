# Field Reporting System — Advance Traffic

## Run (frontend + backend together)

```bash
npm install
npm run dev
```

- API: http://localhost:4000  
- Web: http://localhost:5174/login  

Stop everything from this repo:

```bash
npm run stop
```

## Sign in

- Field Lead: `lead@frs.local` / `ChangeMe123!`
- Manager: `manager@frs.local` / `ChangeMe123!`
- Project Admin: `padmin@frs.local` / `ChangeMe123!`
- System Admin: `admin@frs.local` / `ChangeMe123!`

After login you open to a role-based home (`/field`, `/approvals`, `/office`, or `/system`).

## Database (local PostgreSQL)

```bash
npm run db:migrate
npm run db:seed
```

Uses DB `frs_advance_dev` (see `packages/db/.env`).

## Neon (production) — auto migrate on push to `main`

GitHub Actions runs `prisma migrate deploy` on every push to `main` (`.github/workflows/neon-migrate.yml`).

**One-time setup:** In GitHub → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|--------|
| `DATABASE_URL` | Neon connection string with `?sslmode=require` (direct or pooler URL both work) |

Manual migrate (local or CI script):

```bash
DATABASE_URL="postgresql://..." node scripts/migrate-deploy.mjs
```
