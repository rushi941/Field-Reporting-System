import { test, expect } from "../helpers/fixtures";

test.describe("Project Admin office", () => {
  test.beforeEach(async ({ page, projectAdminPage }) => {
    await expect(page).toHaveURL(/\/office/);
  });

  test("office overview loads", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("billing rollup page loads", async ({ page }) => {
    await page.goto("/office/billing");
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("can open projects workspace", async ({ page }) => {
    await page.goto("/office/projects");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });
});
