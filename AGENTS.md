# Field Reporting System (FRS) — Agent Guide

Mobile-first field quantity reporting and approval platform for specialty contracting (pavement marking, traffic control, permanent signs).

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16+, Prisma ORM |
| Validation | Zod (shared schemas) |
| Auth | JWT + role-based access control |
| Testing | Vitest, React Testing Library, Supertest |
| Tooling | ESLint, Prettier, Husky (optional) |

## Monorepo layout

```
source/
├── AGENTS.md
├── .cursor/
│   ├── agents/         # Roster + invocation prompts
│   ├── rules/          # Persistent agent rules
│   └── skills/         # Specialist agent skills
├── apps/
│   ├── web/            # React + shadcn frontend
│   └── api/            # Node + Express API
├── packages/
│   ├── shared/         # Zod schemas, types, constants
│   └── db/             # Prisma schema + client
└── docs/
    ├── packages.md
    └── architecture.md
```

## Product roles (FRD)

Do **not** dump role lists or permission essays into UI copy. Keep screens minimal (labels, actions, errors). Role behavior lives here and in code.

| Role | Home route | Does |
|------|------------|------|
| Field Lead | `/field` | Submit/lock daily reports; correct returned reports |
| Division Manager / Senior Supervisor | `/approvals` | Approve, approve with notes, return; pending queue with age; project history |
| Project Admin | `/office` | Projects, masters, approved rollup/export (pending = summary count only) |
| System Admin | `/system` | Same masters + users, permission matrix |

### Project masters (`projects.manage`)

Shared UI under `/office/*` and `/system/*`: **Projects** (CRUD with PM + divisions; open for **bids** + map route), **Project types**, **Bid master** (master + sub-bids by division, CSV import). Field leads see pinned route + job bids at `/field/jobs` (`projects.search`).

Login is shared; redirect with `getHomePathForRoles()` from `@frs/shared`. Enforce permissions **from DB matrix** via `requirePermission(key)` (not hard-coded role checks for feature gates).

### Dynamic permissions (FRD §7.2)

- Tables: `Permission`, `RolePermission` — matrix cells are **Yes / No** only (admin UI)
- Defaults seeded from `packages/shared` catalog (FRD features mapped to Yes/No)
- System Admin UI: `/system/users`, `/system/permissions`
- Login/`/me` returns effective `permissions` map for the client `can(key)` helper
- Toast (sonner) for login, logout, user CRUD, and permission save success/errors

## Core workflow

```
Field work → Daily report submitted (locked) → Manager approve/return
→ Project admin billing rollup → CSV export for pay-app backup
```

## Specialist agents

Full roster: [.cursor/agents/README.md](.cursor/agents/README.md)  
Copy-paste prompts: [.cursor/agents/PROMPTS.md](.cursor/agents/PROMPTS.md)

| Agent | Skill | Use for |
|-------|-------|---------|
| Lead | [lead-agent](.cursor/skills/lead-agent/SKILL.md) | Orchestration, plans, routing |
| PM | [pm-agent](.cursor/skills/pm-agent/SKILL.md) | Scope, MVP, timeline, priorities |
| Architecture | [architecture-agent](.cursor/skills/architecture-agent/SKILL.md) | APIs, data model, ADRs |
| BA | [ba-agent](.cursor/skills/ba-agent/SKILL.md) | FRD → stories & acceptance |
| Prompt | [prompt-agent](.cursor/skills/prompt-agent/SKILL.md) | Task briefs for other agents |
| Frontend | [frontend-agent](.cursor/skills/frontend-agent/SKILL.md) | React + shadcn UI |
| Backend | [backend-agent](.cursor/skills/backend-agent/SKILL.md) | Node API, services |
| Database | [database-agent](.cursor/skills/database-agent/SKILL.md) | Prisma / PostgreSQL |
| Validation | [validation](.cursor/skills/validation/SKILL.md) | Zod, STA, business rules |
| Security | [security-agent](.cursor/skills/security-agent/SKILL.md) | Auth, RBAC, hardening |
| Testing | [testing-agent](.cursor/skills/testing-agent/SKILL.md) | Test strategy & coverage |
| Test cases | [test-cases](.cursor/skills/test-cases/SKILL.md) | Concrete automated tests |
| QA / UAT | [qa-uat-agent](.cursor/skills/qa-uat-agent/SKILL.md) | Acceptance scripts, sign-off |
| Code reviewer | [code-reviewer](.cursor/skills/code-reviewer/SKILL.md) | PR review |
| Code standardizer | [code-standardizer](.cursor/skills/code-standardizer/SKILL.md) | Style & structure |
| UX | [ux-agent](.cursor/skills/ux-agent/SKILL.md) | Mobile flows & UX |
| DevOps | [devops-agent](.cursor/skills/devops-agent/SKILL.md) | CI, env, deploy |
| Documentation | [documentation-agent](.cursor/skills/documentation-agent/SKILL.md) | Docs & training |
| Packages | [frs-packages](.cursor/skills/frs-packages/SKILL.md) | Dependencies |

### Default routing

```
Ask → prompt-agent (optional) → lead-agent
  → pm / ba / architecture (planning)
  → frontend | backend | database | validation | security (build)
  → testing → code-reviewer → qa-uat → devops / documentation (ship)
```

## Non-negotiable rules

1. Shared Zod schemas live in `packages/shared` — never duplicate validation in UI and API.
2. Enforce RBAC **server-side**; never trust client role flags alone.
3. Submitted reports are **locked**; edits only after manager return.
4. Project Admin sees **approved / approved-with-notes** report details only.
5. Phase 1 Foundation integration = **CSV import**, not live API write-back.
6. Prefer shadcn/ui primitives; do not invent parallel component systems.
7. All report lifecycle actions must write an **audit log** entry.

## FRD reference

Business/functional source: `FRD-Field Reporting System` (v1.0 Draft). Map features to requirement IDs (`FR-FLD-*`, `FR-MGR-*`, `FR-ADM-*`, etc.).
