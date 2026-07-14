---
name: code-reviewer
description: >-
  Review FRS code changes for bugs, security, RBAC, FRD compliance, and stack
  standards. Use when reviewing PRs, diffs, or when the user asks for a code
  review.
---

# FRS Code Reviewer

## Process

1. Read the diff and related schemas/routes.
2. Check domain rules (lock, RBAC, approved-only admin).
3. Check security (authz, uploads, injection).
4. Check tests and validation coverage.
5. Report findings with severity.

## Severity

| Level | Meaning |
|-------|---------|
| Critical | Must fix before merge (security, data integrity, wrong billing visibility) |
| Suggestion | Should improve soon |
| Nice to have | Optional polish |

## Checklist

Copy and fill:

```
Review Progress:
- [ ] Correctness / edge cases
- [ ] RBAC enforced server-side
- [ ] Report lock / return workflow respected
- [ ] Project Admin cannot see pending/returned detail
- [ ] Zod schema shared; no duplicate rules
- [ ] Prisma queries scoped (no cross-tenant leaks)
- [ ] Attachments not publicly readable
- [ ] Audit events written for lifecycle actions
- [ ] STA / quantity math correct
- [ ] No Foundation API/write-back sneaked in
- [ ] Tests added/updated for FRD IDs
- [ ] Naming / structure matches code-standardizer
```

## High-risk areas

- Status transitions on reports
- Quantity calculations and overrides
- CSV import upserts (partial failure, duplicates)
- File upload MIME/size limits
- JWT secret handling and password hashing
- Manager assignment / approval routing scope

## Output format

```markdown
## Summary
One paragraph.

## Findings
### Critical
- file:line — issue — why — fix hint

### Suggestions
- ...

### Nice to have
- ...

## FRD coverage
- FR-xxx: covered / gap
```

## Related

- Detailed standards: [../code-standardizer/SKILL.md](../code-standardizer/SKILL.md)
- Review examples: [examples.md](examples.md)
