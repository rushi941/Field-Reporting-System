# Architecture Overview

## High-level

```
┌─────────────┐     HTTPS/JSON      ┌─────────────┐      Prisma      ┌────────────┐
│  apps/web   │ ──────────────────► │  apps/api   │ ───────────────► │ PostgreSQL │
│ React+shadcn│ ◄────────────────── │ Node+Express│ ◄─────────────── │            │
└─────────────┘                     └──────┬──────┘                  └────────────┘
                                           │
                     packages/shared (Zod) ┤
                     packages/db (Prisma)  ┘
```

## Apps

### `apps/web`

- Role-based routes: Field Lead, Manager, Project Admin, System Admin
- Mobile-first report forms (STA Range, Single Location, Manual Footage)
- React Query for server state; RHF + Zod for forms
- shadcn/ui only for primitives

### `apps/api`

- REST JSON API under `/api/v1`
- Auth middleware (JWT) + RBAC guards
- Multipart upload endpoints for attachments
- CSV import (Foundation) and CSV export (billing backup)
- Audit log writes on lifecycle events

## Shared packages

| Package | Responsibility |
|---------|----------------|
| `packages/shared` | Zod schemas, enums (roles, report status, form types), STA helpers |
| `packages/db` | Prisma schema, migrations, client export |

## Report status machine

```
Draft --submit--> Submitted --approve--> Approved
                      |                      ^
                      +--approveWithNotes--> ApprovedWithNotes
                      |
                      +--return--> Returned --resubmit--> Submitted
```

## Storage

- Relational data: PostgreSQL — see [database.md](database.md) and `packages/db/prisma/schema.prisma`
- Attachments: object storage or local disk behind signed URLs (configure via env); never public without auth
