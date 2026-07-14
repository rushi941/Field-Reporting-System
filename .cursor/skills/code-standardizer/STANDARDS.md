# FRS Coding Standards (Detail)

## Error handling (API)

```ts
// Prefer
throw new AppError("FORBIDDEN", "Not allowed", 403);

// Error middleware maps AppError → JSON envelope
```

Envelope:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Not allowed",
    "details": null
  }
}
```

## Auth middleware

```ts
requireAuth → requireRole("DIVISION_MANAGER" | "PROJECT_ADMIN" | …)
```

Always check resource scope (manager’s division/crew) after role check.

## React Query keys

```ts
queryKeys.reports.pending()
queryKeys.reports.detail(id)
queryKeys.projects.search(term)
```

## shadcn

- Generate with CLI into `components/ui`
- Do not hand-edit `components/ui` unless necessary; wrap instead
- Use `cn()` from `lib/utils` for class merging

## Commits (suggested)

`feat(reports): …`, `fix(sta): …`, `test(api): …`, `chore(deps): …`

## Accessibility

- Labels on all inputs
- Keyboard access for dialogs/sheets
- Do not rely on color alone for overdue flags
