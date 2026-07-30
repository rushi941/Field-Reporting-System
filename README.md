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

## Neon (production) — migrate + full seed on push to `main`

GitHub Actions runs **migrations and the full demo seed** on every push to `main` (`.github/workflows/neon-migrate.yml`):

- **540 clients**, **516 bid masters**, **demo users** (lead01–lead15, division managers, admins), and demo project **JOB-2026-DEMO**

**Required one-time setup:** GitHub → **Settings → Secrets and variables → Actions** → add:

| Secret | Value |
|--------|--------|
| `DATABASE_URL` | Neon connection string with `?sslmode=require` (direct or pooler URL both work) |

If this secret is missing, every Neon workflow run fails in ~30s and **no users/clients/bid data is loaded**.

**Manual re-seed:** Actions → **Neon seed** → **Run workflow** (same migrate + seed + count verification).

**Local seed against Neon:**

```bash
DATABASE_URL="postgresql://..." npm run db:seed:neon
```

Manual migrate only:

```bash
DATABASE_URL="postgresql://..." node scripts/migrate-deploy.mjs
```
