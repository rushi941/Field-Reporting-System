import { test, expect } from "../helpers/fixtures";

test.describe("Manager approvals", () => {
  test.beforeEach(async ({ page, managerPage }) => {
    await expect(page).toHaveURL(/\/approvals/);
  });

  test("pending queue page loads", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Pending approval" }),
    ).toBeVisible();
    await expect(
      page.getByText(/review quantities|queue is clear/i).first(),
    ).toBeVisible();
  });

  test("project history page loads", async ({ page }) => {
    await page.goto("/approvals/history");
    await expect(
      page.getByRole("heading", { name: "Project report history" }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("pending report opens detail when queue has items", async ({ page }) => {
    const pendingLink = page.locator('main a[href^="/approvals/"]').first();

    if ((await pendingLink.count()) === 0) {
      test.skip(true, "No pending reports in queue");
      return;
    }

    await pendingLink.click();
    await page.waitForURL(/\/approvals\/[^/]+$/);
    await expect(page.getByText(/bid items|quantities/i).first()).toBeVisible();
  });
});
