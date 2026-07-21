import { test, expect } from "../helpers/fixtures";

test.describe("Field Lead mobile workspace", () => {
  test.beforeEach(async ({ page, fieldLeadPage }) => {
    await expect(page).toHaveURL(/\/field\/projects/);
  });

  test("projects page loads", async ({ page }) => {
    await expect(
      page.getByText(/select a project to begin your daily report/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByPlaceholder(/search by job/i),
    ).toBeVisible();
  });

  test("reports list is reachable", async ({ page }) => {
    await page.goto("/field/reports");
    await expect(
      page.getByText(/open a report for full details|no reports yet/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("cannot access system admin routes", async ({ page }) => {
    await page.goto("/system/users");
    await expect(page).not.toHaveURL(/\/system\/users/);
  });
});
