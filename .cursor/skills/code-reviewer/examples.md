# Code Review Examples

## Example: Critical — admin sees pending report

**Bad**

```ts
app.get("/api/v1/reports/:id", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  return res.json(report); // no role/status check
});
```

**Finding:** Critical — Project Admin can read pending/returned detail (violates FR-ADM-002).

**Fix:** Branch on role; for Project Admin require `status IN (APPROVED, APPROVED_WITH_NOTES)`.

---

## Example: Suggestion — duplicated Zod

**Bad:** Separate `reportSchema` in web and api with different optional fields.

**Fix:** Export one schema from `@frs/shared` and import in both.

---

## Example: Nice to have

Using `any` on multer file callback — replace with typed `Express.Multer.File`.
