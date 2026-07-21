import { test, expect } from "../helpers/fixtures";

test.describe("Projects workspace (System Admin)", () => {
  test.beforeEach(async ({ page, adminPage }) => {
    await page.goto("/system/projects");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("projects list loads", async ({ page }) => {
    await expect(page.getByRole("button", { name: /add project/i })).toBeVisible();
  });

  test("units master loads with rows", async ({ page }) => {
    await page.goto("/system/units");
    await expect(page.getByRole("heading", { name: "Units" })).toBeVisible();
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("project detail opens create task modal with unit dropdown", async ({
    page,
  }) => {
    const firstRow = page.locator("table tbody tr").first();
    if ((await firstRow.count()) === 0) {
      test.skip(true, "No projects in seed data");
      return;
    }

    await firstRow.click();
    await page.waitForURL(/\/system\/projects\//, { timeout: 15_000 });
    await page.getByRole("button", { name: /add task/i }).click();

    const modal = page.locator("#project-task-form-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Unit", { exact: true })).toBeVisible();

    const unitSelect = modal.locator("select").filter({ hasText: "LF" });
    const optionCount = await unitSelect.locator("option").count();
    expect(optionCount).toBeGreaterThan(0);

    await modal.getByRole("button", { name: /cancel/i }).click();
  });
});
