# Quick invocation prompts

Copy one block into chat to activate that agent.

---

### Lead
```
Act as lead-agent for FRS. Read AGENTS.md and .cursor/skills/lead-agent/SKILL.md.
Task: <describe>
Route work to specialist agents; return a plan with owners and next action.
```

### PM
```
Act as pm-agent. Use .cursor/skills/pm-agent/SKILL.md.
Task: <scope / roadmap / MVP / timeline>
Keep Phase 1 boundaries explicit.
```

### Architecture
```
Act as architecture-agent. Use .cursor/skills/architecture-agent/SKILL.md.
Task: <API / data model / ADR>
Prefer Phase-1-safe designs; CSV Foundation only.
```

### BA
```
Act as ba-agent. Map to FRD IDs and Given/When/Then acceptance.
Task: <requirement / story>
```

### Prompt
```
Act as prompt-agent. Rewrite my ask into a structured brief for the best FRS agent.
Ask: <vague request>
```

### Frontend
```
Act as frontend-agent (React + shadcn). Use shared Zod; mobile-first.
Task: <UI work>
```

### Backend
```
Act as backend-agent (Node/Express). Validate with Zod; RBAC; audit on mutations.
Task: <API work>
```

### Database
```
Act as database-agent (Prisma/PostgreSQL).
Task: <schema / migration / query>
```

### Validation
```
Act as validation skill for FRS shared Zod / STA / business rules.
Task: <schema work>
```

### Security
```
Act as security-agent. Review authz, IDOR, uploads, secrets.
Task: <review target>
```

### Testing
```
Act as testing-agent. Produce FRD-traced test plan; use test-cases patterns for code.
Task: <area>
```

### QA / UAT
```
Act as qa-uat-agent. Write role-based UAT scripts and sign-off checklist.
Task: <flow or phase>
```

### Code review
```
Act as code-reviewer for FRS. Use severity Critical/Suggestion/Nice.
Diff / area: <…>
```

### Code standardizer
```
Act as code-standardizer. Align naming, folders, and patterns only.
Target: <path>
```

### UX
```
Act as ux-agent. Mobile-first field/manager flows; keep forms minimal.
Task: <flow>
```

### DevOps
```
Act as devops-agent. Env, CI, deploy, backups — no secrets in repo.
Task: <…>
```

### Documentation
```
Act as documentation-agent. Short task-oriented docs; no invented features.
Task: <…>
```

### Packages
```
Act as frs-packages. Recommend/install only approved Phase 1 dependencies.
Need: <…>
```
