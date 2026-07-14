# FRS Agent Roster

Invoke an agent by name in chat (e.g. “Act as **lead-agent**” or “Use the **pm-agent** skill”). Each agent lives under `.cursor/skills/<name>/SKILL.md`.

## How to use

1. Pick the agent that owns the task (see matrix below).
2. Optionally ask **prompt-agent** to turn a vague ask into a tight brief.
3. **lead-agent** coordinates multi-agent work and resolves conflicts.
4. Hand off using the “Handoff” section in each skill.

## Roster

| Agent | Skill folder | Owns |
|-------|--------------|------|
| Lead | `lead-agent` | Orchestration, tech decisions, conflict resolution |
| PM | `pm-agent` | Scope, phases, FRD priorities, timelines, open questions |
| Architecture | `architecture-agent` | System design, APIs, data model, integrations |
| BA / Requirements | `ba-agent` | FRD → stories, acceptance criteria, gap analysis |
| Prompt | `prompt-agent` | Task briefs, agent prompts, subagent instructions |
| Frontend | `frontend-agent` | React, shadcn, mobile UX implementation |
| Backend | `backend-agent` | Node/Express APIs, services, auth middleware |
| Database | `database-agent` | Prisma, PostgreSQL, migrations, queries |
| Validation | `validation` | Zod schemas, STA/business rules |
| Security | `security-agent` | RBAC, JWT, uploads, threat checks |
| Testing | `testing-agent` | Test strategy, suites, coverage vs FRD |
| Test Cases | `test-cases` | Concrete Vitest/RTL/Supertest cases |
| QA / UAT | `qa-uat-agent` | UAT scripts, acceptance sign-off checklist |
| Code Reviewer | `code-reviewer` | PR review, severity findings |
| Code Standardizer | `code-standardizer` | Style, naming, structure |
| UX | `ux-agent` | Flows, wireframe guidance, mobile-first UX |
| DevOps | `devops-agent` | Env, CI, deploy, backups |
| Documentation | `documentation-agent` | README, API docs, training notes |
| Packages | `frs-packages` | Dependencies and install choices |

## Suggested workflow

```
User request
    → prompt-agent (optional: clarify brief)
    → lead-agent (route + plan)
        → pm-agent / ba-agent / architecture-agent (as needed)
        → frontend-agent | backend-agent | database-agent | …
        → validation + testing-agent
        → code-reviewer
        → qa-uat-agent
    → documentation-agent (if shipping)
```

## Phase ownership (FRD delivery)

| Phase | Primary agents |
|-------|----------------|
| Discovery & UX | pm-agent, ba-agent, ux-agent, architecture-agent |
| Auth & roles | backend-agent, security-agent, database-agent |
| Projects / bid items / CSV | backend-agent, database-agent, validation |
| Field submission | frontend-agent, backend-agent, validation, ux-agent |
| Manager approval | frontend-agent, backend-agent, security-agent |
| Admin dashboard & export | frontend-agent, backend-agent |
| Notifications | backend-agent, devops-agent |
| QA / UAT / deploy | testing-agent, qa-uat-agent, devops-agent, lead-agent |
