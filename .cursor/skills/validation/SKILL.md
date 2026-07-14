---
name: validation
description: >-
  Define and apply Zod validation for FRS APIs and forms (STA, reports, CSV
  import). Use when adding schemas, validating requests, station formats,
  business rules, or fixing validation errors.
---

# FRS Validation

## Rules

1. Put schemas in `packages/shared` — reuse in `apps/api` and `apps/web`.
2. Validate on the **server** for every mutating endpoint; client validation is UX only.
3. Map Zod errors to consistent API shape: `{ error: { code, message, details[] } }`.
4. Never trust client-sent `role`, `approvedQuantity`, or `status` transitions outside allowed actions.

## Schema locations

```
packages/shared/src/
  schemas/
    auth.ts
    project.ts
    bid-item.ts
    report.ts
    attachment.ts
    csv-import.ts
  lib/
    sta.ts          # normalize + parse station values
  index.ts
```

## STA validation (FR-FLD-005)

Accept both formats; store/display plus-sign:

| Input | Normalized |
|-------|------------|
| `142+50` | `142+50` |
| `142.50` | `142+50` |

Reject invalid strings with a clear message. Physical LF from Begin/End STA; final quantity = physical LF × conversion factor (BR-005).

## Manual footage (FR-FLD-006)

When `entryType === "MANUAL_FOOTAGE"`:

- Begin/End STA optional / not required
- `manualLf` required
- Tag line source as manual

## Report submit checks

- Project active
- Bid items belong to project
- Required fields per form type
- At least one line item
- Status transition: Draft/Returned → Submitted only via submit action

## Manager return (BR-004)

Return payload **must** include non-empty `comment`.

## CSV import

- Validate required columns before upsert
- Collect row-level errors; do not partially apply invalid batches unless explicitly designed
- Record last import timestamp + audit event

## API middleware pattern

```ts
import { reportSubmitSchema } from "@frs/shared";

export function validateBody(schema: ZodType) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parsed.error.flatten(),
        },
      });
    }
    req.body = parsed.data;
    next();
  };
}
```

## Checklist before merge

- [ ] Schema in `packages/shared`
- [ ] Server uses same schema
- [ ] Client form uses same schema via `@hookform/resolvers/zod`
- [ ] Edge cases covered (empty notes OK, empty return comment NOT OK)
- [ ] Tests in skill [test-cases](../test-cases/SKILL.md)

## More

- Package list: [docs/packages.md](../../../docs/packages.md)
- Domain rules: `.cursor/rules/frs-domain.mdc`
