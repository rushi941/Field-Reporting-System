---
name: test-cases
description: >-
  Write and organize Vitest, Supertest, and React Testing Library tests for FRS
  acceptance criteria. Use when adding features, fixing bugs, mapping FRD
  requirements to tests, or when the user asks for test cases.
---

# FRS Test Cases

## Stack

| Layer | Tool |
|-------|------|
| Unit / shared | Vitest |
| API | Vitest + Supertest |
| UI | Vitest + Testing Library + user-event |
| Env | jsdom (web), node (api) |

## Naming

- File: `*.test.ts` / `*.test.tsx`
- Describe: requirement ID when known — `FR-FLD-005 STA normalization`
- Prefer Arrange–Act–Assert

## Map FRD → tests

| Area | Must cover |
|------|------------|
| Auth / RBAC | Login success/fail; role cannot call forbidden routes |
| STA | `142+50`, `142.50`, invalid; LF × conversion factor |
| Manual footage | STA not required; tagged manual |
| Submit lock | Submitted report not editable by field lead |
| Return | Comment required; becomes editable; resubmit → queue |
| Admin visibility | Pending/returned detail → 403 for Project Admin |
| CSV import | Valid upsert; invalid columns rejected |
| Audit | Submit/approve/return create audit rows |
| Export | Only approved lines in CSV |

## Suggested folders

```
apps/api/src/**/__tests__/
packages/shared/src/**/*.test.ts
apps/web/src/**/*.test.tsx
```

## Template — shared unit

```ts
import { describe, it, expect } from "vitest";
import { normalizeSta, calcReportedLf } from "../lib/sta";

describe("FR-FLD-005 STA normalization", () => {
  it("accepts plus-sign format", () => {
    expect(normalizeSta("142+50")).toBe("142+50");
  });
  it("accepts decimal format", () => {
    expect(normalizeSta("142.50")).toBe("142+50");
  });
  it("rejects invalid input", () => {
    expect(() => normalizeSta("abc")).toThrow();
  });
});

describe("BR-005 STA calculation", () => {
  it("multiplies physical LF by conversion factor", () => {
    expect(calcReportedLf({ begin: "100+00", end: "101+00", factor: 2 })).toBe(200);
  });
});
```

## Template — API

```ts
import request from "supertest";
import { app } from "../../app";

describe("FR-MGR-005 return for correction", () => {
  it("requires comment", async () => {
    const res = await request(app)
      .post("/api/v1/reports/:id/return")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ comment: "" });
    expect(res.status).toBe(400);
  });
});
```

## Template — UI

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("FR-FLD-006 manual footage", () => {
  it("hides STA required when toggle enabled", async () => {
    const user = userEvent.setup();
    render(<StaRangeForm />);
    await user.click(screen.getByLabelText(/enter footage directly/i));
    expect(screen.queryByLabelText(/begin sta/i)).not.toBeRequired();
  });
});
```

## Definition of done

- [ ] Happy path + at least one failure path
- [ ] RBAC negative test for mutating routes
- [ ] Calculation tests if quantities involved
- [ ] No real external network; mock storage/email

## Related

- [validation](../validation/SKILL.md)
- [code-reviewer](../code-reviewer/SKILL.md)
