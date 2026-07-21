import { test, expect } from "../helpers/fixtures";
import { expectPageReady, logout } from "../helpers/navigation";

test.describe("Project Admin — all pages", () => {
  test.beforeEach(async ({ page, projectAdminPage }) => {
    await expect(page).toHaveURL(/\/office/);
  });

  test("dashboard overview", async ({ page }) => {
    await page.goto("/office");
    await expectPageReady(page, { heading: "Dashboard" });
  });

  test("projects workspace", async ({ page }) => {
    await page.goto("/office/projects");
    await expectPageReady(page, { heading: "Projects" });
    await expect(page.getByRole("button", { name: /add project/i })).toBeVisible();
  });

  test("project types, units, bid master", async ({ page }) => {
    for (const path of ["/office/project-types", "/office/units", "/office/bids"]) {
      await page.goto(path);
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test("billing rollup and drilldown when project exists", async ({ page }) => {
    await page.goto("/office/billing");
    await expectPageReady(page, { heading: "Billing" });
    const projectLink = page.locator('a[href*="/office/billing/"]').first();
    if ((await projectLink.count()) === 0) {
      test.skip(true, "No projects on billing rollup");
      return;
    }
    await projectLink.click();
    await page.waitForURL(/\/office\/billing\//);
    await expect(page.getByText(/approved|pending|billing/i).first()).toBeVisible();
  });

  test("cannot access system-only users page", async ({ page }) => {
    await page.goto("/system/users");
    await expect(page).not.toHaveURL(/\/system\/users/);
  });

  test("logout returns to login", async ({ page }) => {
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
