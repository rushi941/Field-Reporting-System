import { test, expect } from "../helpers/fixtures";
import { expectPageReady, logout } from "../helpers/navigation";

test.describe("Division Manager — approvals workspace", () => {
  test.beforeEach(async ({ page, managerPage }) => {
    await expect(page).toHaveURL(/\/approvals/);
  });

  test("pending queue page", async ({ page }) => {
    await expectPageReady(page, { heading: "Pending approval" });
    await expect(
      page.getByText(/review quantities|queue is clear/i).first(),
    ).toBeVisible();
  });

  test("sidebar navigation queue and history", async ({ page }) => {
    await page.getByRole("link", { name: /pending queue/i }).click();
    await expect(page).toHaveURL(/\/approvals\/?$/);
    await page.getByRole("link", { name: /project history/i }).click();
    await expectPageReady(page, { heading: "Project report history" });
  });

  test("approval detail shows actions when pending exists", async ({ page }) => {
    await page.goto("/approvals");
    const link = page.locator('main a[href^="/approvals/"]').first();
    if ((await link.count()) === 0) {
      test.skip(true, "No pending reports — submit a report as field lead first");
      return;
    }
    await link.click();
    await page.waitForURL(/\/approvals\/[^/]+$/);
    await expect(page.getByText(/bid items|quantities/i).first()).toBeVisible();
    const approve = page.getByRole("button", { name: /^approve$/i });
    const returnBtn = page.getByRole("button", { name: /return/i });
    await expect(approve.or(returnBtn).first()).toBeVisible();
  });

  test("history project picker when projects exist", async ({ page }) => {
    await page.goto("/approvals/history");
    const select = page.locator("#history-project");
    if ((await select.count()) === 0) {
      test.skip(true, "No projects in manager history scope");
      return;
    }
    const options = await select.locator("option").count();
    expect(options).toBeGreaterThan(0);
  });

  test("manager cannot access system users", async ({ page }) => {
    await page.goto("/system/users");
    await expect(page).not.toHaveURL(/\/system\/users/);
  });

  test("logout", async ({ page }) => {
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
