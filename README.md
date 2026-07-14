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
