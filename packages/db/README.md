# packages/db

PostgreSQL access via Prisma for the Field Reporting System.

## Contents

- `prisma/schema.prisma` — full FRD-aligned schema
- `prisma/seed.ts` — demo users + sample project
- `src/index.ts` — shared `PrismaClient` export
- See [docs/database.md](../../docs/database.md) for ER overview

## Commands

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run db:studio
```
