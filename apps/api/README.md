# @frs/api

Express API for Field Reporting System.

## Auth endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/login` | No | Sign in (any assigned role) |
| GET | `/api/v1/auth/me` | Bearer | Current user |
| POST | `/api/v1/auth/logout` | Bearer | Logout (client clears JWT) |

## Run

```bash
# from repo root — requires Postgres + migrated/seeded DB
npm run dev:api
```
