import { test, expect } from "../helpers/fixtures";
import { logout } from "../helpers/navigation";

test.describe("Field Lead — workspace & inputs", () => {
  test.beforeEach(async ({ page, fieldLeadPage }) => {
    await expect(page).toHaveURL(/\/field\/projects/);
  });

  test("projects page search and division filters", async ({ page }) => {
    await expect(
      page.getByPlaceholder(/search by job/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /all divisions/i })).toBeVisible();
    await page.getByRole("button", { name: /pave marking/i }).click();
    await page.getByRole("button", { name: /all divisions/i }).click();
  });

  test("bottom navigation projects and reports", async ({ page }) => {
    await page.getByRole("link", { name: "Reports" }).click();
    await expect(page).toHaveURL(/\/field\/reports/);
    await expect(
      page.getByText(/open a report|no reports yet/i).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page).toHaveURL(/\/field\/projects/);
  });

  test("open project and task entry form when assigned", async ({ page }) => {
    const projectBtn = page.locator('a[href*="/field/projects/"]').first();
    if ((await projectBtn.count()) === 0) {
      test.skip(true, "No projects assigned to field lead — add task with field person on a project");
      return;
    }
    await projectBtn.click();
    await page.waitForURL(/\/field\/projects\/[^/]+$/);
    await expect(page.getByLabel(/report date/i)).toBeVisible();
    await expect(page.getByLabel(/crew size/i)).toBeVisible();

    const taskBtn = page.locator('button').filter({ hasText: /segment|location|#/i }).first();
    if ((await taskBtn.count()) === 0) {
      test.skip(true, "No tasks on project for field lead");
      return;
    }
    await taskBtn.click();
    await page.waitForURL(/\/tasks\//);
    await expect(page.getByText(/task details|back to tasks/i).first()).toBeVisible();
    await expect(page.getByText(/save|submit/i).first()).toBeVisible();
  });

  test("reports list and detail when reports exist", async ({ page }) => {
    await page.goto("/field/reports");
    const reportLink = page.locator('a[href*="/field/reports/"]').first();
    if ((await reportLink.count()) === 0) {
      test.skip(true, "No field reports yet");
      return;
    }
    await reportLink.click();
    await page.waitForURL(/\/field\/reports\/[^/]+$/);
    await expect(page.getByText(/report|status|line/i).first()).toBeVisible();
  });

  test("RBAC blocks admin routes", async ({ page }) => {
    await page.goto("/system/projects");
    await expect(page).not.toHaveURL(/\/system\/projects/);
    await page.goto("/approvals");
    await expect(page).not.toHaveURL(/\/approvals$/);
  });

  test("logout from header", async ({ page }) => {
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
